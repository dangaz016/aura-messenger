import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getDb } from './database';

const execAsync = promisify(exec);

export async function backupDatabase(dbPath: string, backupDir: string): Promise<void> {
  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file does not exist');
  }

  // Создать резервную копию
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `aura-backup-${timestamp}.db`);

  // Использовать sqlite3 CLI для создания резервной копии
  try {
    await execAsync(`sqlite3 "${dbPath}" ".backup '${backupPath}'"`);

    // Сжать резервную копию
    const compressedPath = `${backupPath}.gz`;
    await execAsync(`gzip -f "${backupPath}"`);

    // Удалить старые резервные копии (оставить последние 7)
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('aura-backup-') && f.endsWith('.db.gz'))
      .sort()
      .reverse();

    if (backups.length > 7) {
      const toDelete = backups.slice(7);
      toDelete.forEach(file => {
        fs.unlinkSync(path.join(backupDir, file));
      });
    }

    console.log(`[Backup] Created backup: ${compressedPath}`);
  } catch (err: any) {
    console.error('[Backup] Failed to create backup:', err.message);
    throw err;
  }
}

export async function backupMediaFiles(uploadDir: string, backupDir: string): Promise<void> {
  const db = getDb();
  const files = db.prepare('SELECT * FROM files').all() as unknown as { id: string; filename: string }[];

  // Create media backup directory
  const mediaBackupDir = path.join(backupDir, 'media');
  if (!fs.existsSync(mediaBackupDir)) {
    fs.mkdirSync(mediaBackupDir, { recursive: true });
  }

  for (const file of files) {
    const filePath = path.join(uploadDir, file.filename);
    if (fs.existsSync(filePath)) {
      const backupFilePath = path.join(mediaBackupDir, file.filename);
      fs.copyFileSync(filePath, backupFilePath);
    }
  }

  console.log(`[Backup] Media backup completed to ${mediaBackupDir}`);
}

export async function restoreFromBackup(dbPath: string, backupDir: string): Promise<void> {
  // Найти последнюю резервную копию
  const backups = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('aura-backup-') && f.endsWith('.db.gz'))
    .sort()
    .reverse();

  if (backups.length === 0) {
    throw new Error('No backups found');
  }

  const latestBackup = backups[0];
  const backupPath = path.join(backupDir, latestBackup);
  const tempRestorePath = path.join(backupDir, 'restore-temp.db');

  try {
    // Распаковать резервную копию
    await execAsync(`gunzip -c "${backupPath}" > "${tempRestorePath}"`);
    
    // Восстановить базу данных
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    fs.copyFileSync(tempRestorePath, dbPath);
    fs.unlinkSync(tempRestorePath);
    
    console.log(`[Backup] Restored database from ${latestBackup}`);
  } catch (err: any) {
    console.error('[Backup] Failed to restore from backup:', err.message);
    throw err;
  }
}