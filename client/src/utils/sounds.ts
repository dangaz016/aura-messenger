/** Web Audio API sound utilities for Aura messenger */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/**
 * Plays a soft "whoosh" send-sound (two quick sine tones, Telegram-style).
 * Volume is kept low (~15%) so it doesn't startle the user.
 */
export function playMessageSentSound() {
  if (localStorage.getItem('aura_sound_send') === 'false') return;
  const ctx = getCtx();
  if (!ctx) return;

  // Resume if suspended (browser policy)
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.13, now + 0.01);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  master.connect(ctx.destination);

  // First tone: short click (600 Hz → 800 Hz)
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(600, now);
  osc1.frequency.linearRampToValueAtTime(800, now + 0.08);
  osc1.connect(master);
  osc1.start(now);
  osc1.stop(now + 0.1);

  // Second tone: slight swoosh (400 Hz → 300 Hz)
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(400, now + 0.06);
  osc2.frequency.linearRampToValueAtTime(300, now + 0.22);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.07, now + 0.06);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc2.connect(g2);
  g2.connect(ctx.destination);
  osc2.start(now + 0.06);
  osc2.stop(now + 0.22);
}

/**
 * Plays a soft incoming message notification sound.
 */
export function playMessageReceivedSound() {
  if (localStorage.getItem('aura_sound_receive') === 'false') return;
  const ctx = getCtx();
  if (!ctx) return;

  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.10, now + 0.015);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  master.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.setValueAtTime(1100, now + 0.05);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
  osc.connect(master);
  osc.start(now);
  osc.stop(now + 0.3);
}
