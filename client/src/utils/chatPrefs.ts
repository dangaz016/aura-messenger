/** Per-chat local preferences: pin, mute, archive */

function getSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { return new Set(); }
}
function saveSet(key: string, s: Set<string>) {
  localStorage.setItem(key, JSON.stringify(Array.from(s)));
}

const PINNED_KEY  = 'aura_pinned';
const MUTED_KEY   = 'aura_muted';
const ARCHIVED_KEY = 'aura_archived';

export const chatPrefs = {
  // ── Pinned ─────────────────────────────────────────────────────────────
  getPinned():  Set<string> { return getSet(PINNED_KEY); },
  isPinned(id: string): boolean { return getSet(PINNED_KEY).has(id); },
  togglePin(id: string): boolean {
    const s = getSet(PINNED_KEY);
    if (s.has(id)) { s.delete(id); saveSet(PINNED_KEY, s); return false; }
    else { s.add(id); saveSet(PINNED_KEY, s); return true; }
  },

  // ── Muted ──────────────────────────────────────────────────────────────
  getMuted(): Set<string> { return getSet(MUTED_KEY); },
  isMuted(id: string): boolean { return getSet(MUTED_KEY).has(id); },
  toggleMute(id: string): boolean {
    const s = getSet(MUTED_KEY);
    if (s.has(id)) { s.delete(id); saveSet(MUTED_KEY, s); return false; }
    else { s.add(id); saveSet(MUTED_KEY, s); return true; }
  },

  // ── Archived ───────────────────────────────────────────────────────────
  getArchived(): Set<string> { return getSet(ARCHIVED_KEY); },
  isArchived(id: string): boolean { return getSet(ARCHIVED_KEY).has(id); },
  toggleArchive(id: string): boolean {
    const s = getSet(ARCHIVED_KEY);
    if (s.has(id)) { s.delete(id); saveSet(ARCHIVED_KEY, s); return false; }
    else { s.add(id); saveSet(ARCHIVED_KEY, s); return true; }
  },
};
