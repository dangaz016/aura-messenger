import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';

// Конфигурация AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'aura-app-backups';

export async function uploadFileToS3(localPath: string, s3Key: string): Promise<string> {
  const fileContent = fs.readFileSync(localPath);
  
  const params = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileContent,
    ContentType: getContentType(localPath),
  };

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (err: any) {
    console.error('[S3] Upload failed:', err.message);
    throw err;
  }
}

export async function downloadFileFromS3(s3Key: string, localPath: string): Promise<void> {
  const params = {
    Bucket: BUCKET_NAME,
    Key: s3Key,
  };

  try {
    const result = await s3.getObject(params).promise();
    if (result.Body) {
      fs.writeFileSync(localPath, result.Body as Buffer);
    }
  } catch (err: any) {
    console.error('[S3] Download failed:', err.message);
    throw err;
  }
}

export async function backupDatabaseToCloud(dbPath: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const s3Key = `backups/aura-db-${timestamp}.db.gz`;
  
  // Создать локальную резервную копию
  const tempBackupPath = path.join(path.dirname(dbPath), `backup-${timestamp}.db`);
  await execAsync(`sqlite3 "${dbPath}" ".backup '${tempBackupPath}'"`);
  
  // Сжать резервную копию
  const compressedPath = `${tempBackupPath}.gz`;
  await execAsync(`gzip -f "${tempBackupPath}"`);
  
  // Проверка целостности локальной резервной копии
  if (!fs.existsSync(compressedPath)) {
    throw new Error('Failed to create compressed backup file');
  }
  
  // Загрузить в облако с повторными попытками
  let uploadSuccessful = false;
  let retryCount = 0;
  const maxRetries = 3;
  
  while (!uploadSuccessful && retryCount < maxRetries) {
    try {
      await uploadFileToS3(compressedPath, s3Key);
      uploadSuccessful = true;
      console.log(`[Cloud Backup] Uploaded to ${s3Key}`);
    } catch (err: any) {
      retryCount++;
      console.error(`[Cloud Backup] Upload attempt ${retryCount} failed:`, err.message);
      if (retryCount >= maxRetries) {
        throw new Error(`Failed to upload backup after ${maxRetries} attempts`);
      }
      // Ждать перед повторной попыткой
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Удалить локальную копию
  fs.unlinkSync(compressedPath);
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.db': return 'application/octet-stream';
    case '.gz': return 'application/gzip';
    default: return 'application/octet-stream';
  }
}

// Helper function for exec
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export async function restoreFromCloud(dbPath: string, timestamp: string): Promise<void> {
  const s3Key = `backups/aura-db-${timestamp}.db.gz`;
  const tempBackupPath = path.join(path.dirname(dbPath), `restore-${timestamp}.db.gz`);
  
  try {
    // Скачать резервную копию из облака
    await downloadFileFromS3(s3Key, tempBackupPath);
    
    // Проверка целостности скачанного файла
    if (!fs.existsSync(tempBackupPath)) {
      throw new Error('Failed to download backup file from cloud');
    }
    
    // Распаковать резервную копию
    const tempDbPath = path.join(path.dirname(dbPath), `restore-${timestamp}.db`);
    await execAsync(`gunzip -c "${tempBackupPath}" > "${tempDbPath}"`);
    
    // Проверка целостности распакованной базы данных
    if (!fs.existsSync(tempDbPath)) {
      throw new Error('Failed to decompress backup file');
    }
    
    // Восстановить базу данных
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    fs.copyFileSync(tempDbPath, dbPath);
    
    // Удалить временные файлы
    fs.unlinkSync(tempBackupPath);
    fs.unlinkSync(tempDbPath);
    
    console.log(`[Cloud Restore] Restored database from ${s3Key}`);
  } catch (err: any) {
    console.error('[Cloud Restore] Failed to restore from cloud:', err.message);
    throw err;
  }
}