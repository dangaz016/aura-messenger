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
 * Plays a pleasant upward chord for message send (like iOS/Telegram).
 * Frequencies: C5 → E5 → G5 (major chord)
 */
export function playMessageSentSound() {
  if (localStorage.getItem('aura_sound_send') === 'false') return;
  const ctx = getCtx();
  if (!ctx) return;

  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;
  const baseVolume = 0.08; // Gentle volume
  
  // Master gain with smooth ADSR envelope
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(baseVolume, now + 0.015); // Attack
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.35); // Decay + Release
  master.connect(ctx.destination);

  // Create three oscillators for a pleasant major chord
  const frequencies = [
    { freq: 523.25, delay: 0.00 },  // C5
    { freq: 659.25, delay: 0.05 },  // E5
    { freq: 783.99, delay: 0.10 },  // G5
  ];

  frequencies.forEach(({ freq, delay }) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    
    // Individual envelope for each note
    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0, now + delay);
    noteGain.gain.linearRampToValueAtTime(0.7, now + delay + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);
    
    osc.connect(noteGain);
    noteGain.connect(master);
    osc.start(now + delay);
    osc.stop(now + delay + 0.3);
  });

  // Subtle high-frequency "sparkle" for polish
  const sparkle = ctx.createOscillator();
  sparkle.type = 'sine';
  sparkle.frequency.setValueAtTime(2093, now + 0.12); // C7
  const sparkleGain = ctx.createGain();
  sparkleGain.gain.setValueAtTime(0, now + 0.12);
  sparkleGain.gain.linearRampToValueAtTime(0.015, now + 0.14);
  sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  sparkle.connect(sparkleGain);
  sparkleGain.connect(ctx.destination);
  sparkle.start(now + 0.12);
  sparkle.stop(now + 0.3);
}

/**
 * Plays a soft downward chord for incoming messages (notification style).
 * Frequencies: A5 → F#5 → D5 (descending triad)
 */
export function playMessageReceivedSound() {
  if (localStorage.getItem('aura_sound_receive') === 'false') return;
  const ctx = getCtx();
  if (!ctx) return;

  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;
  const baseVolume = 0.10;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(baseVolume, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  master.connect(ctx.destination);

  // Descending notes with slight overlap for smooth sound
  const notes = [
    { freq: 880.00, delay: 0.00 },  // A5
    { freq: 739.99, delay: 0.06 },  // F#5  
    { freq: 587.33, delay: 0.12 },  // D5
  ];

  notes.forEach(({ freq, delay }) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);
    
    const noteGain = ctx.createGain();
    noteGain.gain.setValueAtTime(0, now + delay);
    noteGain.gain.linearRampToValueAtTime(0.6, now + delay + 0.025);
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);
    
    osc.connect(noteGain);
    noteGain.connect(master);
    osc.start(now + delay);
    osc.stop(now + delay + 0.35);
  });

  // Add a warm sub-bass for depth
  const bass = ctx.createOscillator();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(146.83, now); // D3
  const bassGain = ctx.createGain();
  bassGain.gain.setValueAtTime(0, now);
  bassGain.gain.linearRampToValueAtTime(0.05, now + 0.03);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  bass.connect(bassGain);
  bassGain.connect(ctx.destination);
  bass.start(now);
  bass.stop(now + 0.35);
}
