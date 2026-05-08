import { format, formatDistanceToNow, isToday, isYesterday, differenceInMinutes } from 'date-fns';

export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return format(date, 'HH:mm');
}

export function formatChatListTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd.MM.yy');
}

export function formatLastSeen(timestamp: number, isOnline: boolean): string {
  if (isOnline) return 'online';
  const date = new Date(timestamp * 1000);
  const minsAgo = differenceInMinutes(new Date(), date);
  if (minsAgo < 1) return 'just now';
  if (minsAgo < 60) return `${minsAgo} min ago`;
  return `last seen ${formatDistanceToNow(date, { addSuffix: true })}`;
}

export function formatEchoTime(echoExpiresAt: number): string {
  const remaining = Math.max(0, echoExpiresAt - Math.floor(Date.now() / 1000));
  if (remaining <= 60) return `${remaining}s`;
  if (remaining <= 3600) return `${Math.floor(remaining / 60)}m`;
  return `${Math.floor(remaining / 3600)}h`;
}

export function getInitials(name: string): string {
  return name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
