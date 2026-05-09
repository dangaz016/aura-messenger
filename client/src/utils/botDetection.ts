/**
 * Bot Detection Utilities
 * Tracks user behaviour to generate a human-likeness score (0–100)
 */

export interface BehaviorData {
  score: number;           // 0-100, higher = more human
  timeOnPage: number;      // ms since form appeared
  mouseEvents: number;     // number of mouse movements
  keyEvents: number;       // number of key presses
  focusChanges: number;    // number of input focus changes
  hasMouseVariance: boolean; // mouse moved with natural variance (not straight lines)
  autofilledDetected: boolean; // browser autofill detected
}

export class BehaviorTracker {
  private startTime = Date.now();
  private mousePositions: { x: number; y: number; t: number }[] = [];
  private keyTimings: number[] = [];
  private focusChanges = 0;
  private autofilledDetected = false;
  private listeners: (() => void)[] = [];

  constructor() {
    this.attach();
  }

  private attach() {
    const onMouseMove = (e: MouseEvent) => {
      if (this.mousePositions.length < 200) {
        this.mousePositions.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      }
    };
    const onKeyDown = () => {
      this.keyTimings.push(Date.now());
    };
    const onFocus = () => { this.focusChanges++; };

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('keydown', onKeyDown, { passive: true });
    document.addEventListener('focusin', onFocus, { passive: true });

    this.listeners.push(
      () => document.removeEventListener('mousemove', onMouseMove),
      () => document.removeEventListener('keydown', onKeyDown),
      () => document.removeEventListener('focusin', onFocus),
    );
  }

  detectAutofill(input: HTMLInputElement) {
    // Check for browser autofill via animation trick
    input.addEventListener('animationstart', (e: AnimationEvent) => {
      if (e.animationName === 'autofill-detect') {
        this.autofilledDetected = true;
      }
    });
  }

  detach() {
    this.listeners.forEach(fn => fn());
    this.listeners = [];
  }

  /** Check if mouse movements show natural variance (not bot-like straight lines) */
  private hasNaturalMouseVariance(): boolean {
    if (this.mousePositions.length < 5) return false;
    const pts = this.mousePositions;
    // Calculate variance in direction changes
    let directionChanges = 0;
    for (let i = 2; i < pts.length; i++) {
      const dx1 = pts[i-1].x - pts[i-2].x;
      const dy1 = pts[i-1].y - pts[i-2].y;
      const dx2 = pts[i].x - pts[i-1].x;
      const dy2 = pts[i].y - pts[i-1].y;
      // Dot product — if negative, direction changed
      if (dx1 * dx2 + dy1 * dy2 < 0) directionChanges++;
    }
    return directionChanges > pts.length * 0.1;
  }

  /** Check if key timing looks natural (not perfectly uniform) */
  private hasNaturalKeyTiming(): boolean {
    if (this.keyTimings.length < 3) return false;
    const intervals: number[] = [];
    for (let i = 1; i < this.keyTimings.length; i++) {
      intervals.push(this.keyTimings[i] - this.keyTimings[i-1]);
    }
    const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    const variance = intervals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / intervals.length;
    // Human typing has high variance; bots have very low variance
    return variance > 500;
  }

  collect(): BehaviorData {
    const timeOnPage = Date.now() - this.startTime;
    const mouseEvents = this.mousePositions.length;
    const keyEvents = this.keyTimings.length;
    const hasMouseVariance = this.hasNaturalMouseVariance();
    const hasNaturalKeys = this.hasNaturalKeyTiming();

    // Score calculation
    let score = 0;

    // Time on page (max 25 pts)
    if (timeOnPage > 30000) score += 25;
    else if (timeOnPage > 10000) score += 20;
    else if (timeOnPage > 5000) score += 10;
    else if (timeOnPage > 3000) score += 5;

    // Mouse movement (max 25 pts)
    if (mouseEvents > 50) score += 25;
    else if (mouseEvents > 20) score += 15;
    else if (mouseEvents > 5) score += 8;

    // Natural mouse variance (max 15 pts)
    if (hasMouseVariance) score += 15;

    // Keyboard events (max 15 pts)
    if (keyEvents > 20) score += 15;
    else if (keyEvents > 10) score += 10;
    else if (keyEvents > 3) score += 5;

    // Natural key timing (max 10 pts)
    if (hasNaturalKeys) score += 10;

    // Focus changes (max 10 pts)
    if (this.focusChanges >= 3) score += 10;
    else if (this.focusChanges >= 1) score += 5;

    return {
      score: Math.min(100, score),
      timeOnPage,
      mouseEvents,
      keyEvents,
      focusChanges: this.focusChanges,
      hasMouseVariance,
      autofilledDetected: this.autofilledDetected,
    };
  }
}

/** Run Proof-of-Work in a Web Worker */
export function runPoW(challenge: string, difficulty: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/pow-worker.js');
    worker.postMessage({ challenge, difficulty });
    worker.onmessage = (e) => {
      if (e.data.type === 'solved') {
        worker.terminate();
        resolve(e.data.nonce as string);
      }
      // progress updates ignored here
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
  });
}

/** Run PoW with progress callback */
export function runPoWWithProgress(
  challenge: string,
  difficulty: number,
  onProgress: (attempts: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/pow-worker.js');
    worker.postMessage({ challenge, difficulty });
    worker.onmessage = (e) => {
      if (e.data.type === 'solved') {
        worker.terminate();
        resolve(e.data.nonce as string);
      } else if (e.data.type === 'progress') {
        onProgress(e.data.attempts);
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
  });
}
