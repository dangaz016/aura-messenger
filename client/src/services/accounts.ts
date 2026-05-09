export interface StoredAccount {
  token: string;
  userId: string;
  username: string;
  displayName: string;
  avatarColor: string;
  avatarUrl: string | null;
}

const ACCOUNTS_KEY = 'aura_accounts';
const TOKEN_KEY = 'aura_token';

export const accountsService = {
  getAll(): StoredAccount[] {
    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
    } catch {
      return [];
    }
  },

  save(account: StoredAccount): void {
    const all = this.getAll();
    const idx = all.findIndex(a => a.userId === account.userId);
    if (idx >= 0) all[idx] = account;
    else all.push(account);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(all));
  },

  remove(userId: string): void {
    const filtered = this.getAll().filter(a => a.userId !== userId);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(filtered));
  },

  getActiveToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getCurrent(): StoredAccount | null {
    const token = this.getActiveToken();
    if (!token) return null;
    return this.getAll().find(a => a.token === token) ?? null;
  },

  switchTo(account: StoredAccount): void {
    localStorage.setItem(TOKEN_KEY, account.token);
    window.location.reload();
  },

  /** Save current session then clear active token → app shows login page */
  addAccount(): void {
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  },
};
