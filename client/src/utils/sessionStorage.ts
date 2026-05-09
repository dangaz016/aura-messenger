// Session state persistence (survives page refresh)

const ACTIVE_CHAT_KEY = 'aura_active_chat';
const DRAFTS_KEY = 'aura_drafts';
const SCROLL_POSITIONS_KEY = 'aura_scroll_positions';

// ── Active chat ────────────────────────────────────────────────────────────

export function saveActiveChat(chatId: string | null) {
  if (chatId) {
    localStorage.setItem(ACTIVE_CHAT_KEY, chatId);
  } else {
    localStorage.removeItem(ACTIVE_CHAT_KEY);
  }
}

export function loadActiveChat(): string | null {
  return localStorage.getItem(ACTIVE_CHAT_KEY);
}

// ── Draft messages ─────────────────────────────────────────────────────────

export function saveDraft(chatId: string, text: string) {
  try {
    const drafts = loadAllDrafts();
    if (text.trim()) {
      drafts[chatId] = text;
    } else {
      delete drafts[chatId];
    }
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch (err) {
    console.error('Failed to save draft', err);
  }
}

export function loadDraft(chatId: string): string {
  try {
    const drafts = loadAllDrafts();
    return drafts[chatId] || '';
  } catch {
    return '';
  }
}

export function clearDraft(chatId: string) {
  saveDraft(chatId, '');
}

function loadAllDrafts(): Record<string, string> {
  try {
    const json = localStorage.getItem(DRAFTS_KEY);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

// ── Scroll positions ───────────────────────────────────────────────────────

export function saveScrollPosition(chatId: string, position: number) {
  try {
    const positions = loadAllScrollPositions();
    positions[chatId] = position;
    localStorage.setItem(SCROLL_POSITIONS_KEY, JSON.stringify(positions));
  } catch (err) {
    console.error('Failed to save scroll position', err);
  }
}

export function loadScrollPosition(chatId: string): number {
  try {
    const positions = loadAllScrollPositions();
    return positions[chatId] || 0;
  } catch {
    return 0;
  }
}

function loadAllScrollPositions(): Record<string, number> {
  try {
    const json = localStorage.getItem(SCROLL_POSITIONS_KEY);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

// ── Cleanup (call on logout) ───────────────────────────────────────────────

export function clearSessionState() {
  localStorage.removeItem(ACTIVE_CHAT_KEY);
  localStorage.removeItem(DRAFTS_KEY);
  localStorage.removeItem(SCROLL_POSITIONS_KEY);
}
