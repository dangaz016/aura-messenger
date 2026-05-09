/** Sound utilities for Aura messenger */

// Preload the notification sound
let notificationAudio: HTMLAudioElement | null = null;

function getNotificationAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!notificationAudio) {
    notificationAudio = new Audio('/sounds/notification.mp3');
    notificationAudio.volume = 0.5;
    notificationAudio.preload = 'auto';
  }
  return notificationAudio;
}

/**
 * Plays the Fears to Fathom notification sound for sent messages.
 */
export function playMessageSentSound() {
  if (localStorage.getItem('aura_sound_send') === 'false') return;
  const audio = getNotificationAudio();
  if (!audio) return;
  // Clone so overlapping plays work
  const clone = audio.cloneNode() as HTMLAudioElement;
  clone.volume = 0.4;
  clone.play().catch(() => {});
}

/**
 * Plays the Fears to Fathom notification sound for incoming messages.
 */
export function playMessageReceivedSound() {
  if (localStorage.getItem('aura_sound_receive') === 'false') return;
  const audio = getNotificationAudio();
  if (!audio) return;
  const clone = audio.cloneNode() as HTMLAudioElement;
  clone.volume = 0.6;
  clone.play().catch(() => {});
}
