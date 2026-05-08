import { format, formatDistanceToNow, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import { ru, enUS } from 'date-fns/locale';
import { Lang } from '../i18n/translations';

function getLocale(lang: Lang) {
  return lang === 'ru' ? ru : enUS;
}

export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return format(date, 'HH:mm');
}

export function formatChatListTime(timestamp: number, lang: Lang = 'en'): string {
  const date = new Date(timestamp * 1000);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return lang === 'ru' ? 'Вчера' : 'Yesterday';
  return format(date, 'dd.MM.yy');
}

export function formatLastSeen(timestamp: number, isOnline: boolean, lang: Lang = 'en'): string {
  if (isOnline) return lang === 'ru' ? 'в сети' : 'online';
  const date = new Date(timestamp * 1000);
  const minsAgo = differenceInMinutes(new Date(), date);
  if (minsAgo < 1) return lang === 'ru' ? 'только что' : 'just now';
  if (minsAgo < 60) return lang === 'ru' ? `${minsAgo} мин назад` : `${minsAgo} min ago`;
  const distance = formatDistanceToNow(date, { addSuffix: true, locale: getLocale(lang) });
  return lang === 'ru' ? `был(а) ${distance}` : `last seen ${distance}`;
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
