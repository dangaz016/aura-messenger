import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { cryptoService } from '../services/crypto';
import { clearSessionState } from '../utils/sessionStorage';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithToken: (token: string, user: User) => Promise<void>;
  register: (username: string, password: string, displayName?: string, captchaId?: string, captchaAnswer?: string, behaviorScore?: number, timeOnPage?: number) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  // ban/freeze state (updated in real time)
  isBanned: boolean;
  banReason: string | null;
  isFrozen: boolean;
  freezeUntil: number;
  freezeReason: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezeUntil, setFreezeUntil] = useState(0);
  const [freezeReason, setFreezeReason] = useState<string | null>(null);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.me()
      .then(async (u) => {
        setUser(u);
        // Restore ban/freeze state from server
        if (u.isBanned) { setIsBanned(true); setBanReason(u.banReason ?? null); }
        if (u.isFrozen && u.freezeUntil && u.freezeUntil > Math.floor(Date.now() / 1000)) {
          setIsFrozen(true);
          setFreezeUntil(u.freezeUntil);
          setFreezeReason(u.freezeReason ?? null);
        }
        await ensurePublicKey(u);
        socketService.connect(token);
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          api.clearToken();
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Subscribe to real-time ban/freeze socket events
  useEffect(() => {
    const offBanned = socketService.onUserBanned(({ reason }) => {
      setIsBanned(true);
      setBanReason(reason);
    });
    const offUnbanned = socketService.onUserUnbanned(() => {
      setIsBanned(false);
      setBanReason(null);
    });
    const offFrozen = socketService.onUserFrozen(({ freezeUntil: until, reason }) => {
      setIsFrozen(true);
      setFreezeUntil(until);
      setFreezeReason(reason);
    });
    const offUnfrozen = socketService.onUserUnfrozen(() => {
      setIsFrozen(false);
      setFreezeUntil(0);
      setFreezeReason(null);
    });
    return () => { offBanned(); offUnbanned(); offFrozen(); offUnfrozen(); };
  }, []);

  async function ensurePublicKey(u: User) {
    const kp = cryptoService.getOrCreateKeyPair();
    if (u.publicKey !== kp.publicKey) {
      const updated = await api.updateProfile({ publicKey: kp.publicKey });
      setUser(updated);
    }
  }

  async function login(username: string, password: string) {
    const { token, user: u } = await api.login(username, password);
    setUser(u);
    await ensurePublicKey(u);
    socketService.connect(token);
  }

  async function loginWithToken(token: string, u: User) {
    api.setToken(token);
    setUser(u);
    await ensurePublicKey(u);
    socketService.connect(token);
  }

  async function register(
    username: string, password: string, displayName?: string,
    captchaId?: string, captchaAnswer?: string,
    behaviorScore?: number, timeOnPage?: number,
  ) {
    const { token, user: u } = await api.register(
      username, password, displayName,
      captchaId, captchaAnswer,
      behaviorScore, timeOnPage,
    );
    setUser(u);
    await ensurePublicKey(u);
    socketService.connect(token);
  }

  function logout() {
    api.clearToken();
    cryptoService.clearKeys();
    socketService.disconnect();
    clearSessionState();
    setUser(null);
  }

  function updateUser(u: User) {
    setUser(u);
  }

  return (
    <AuthContext.Provider value={{
      user, loading, login, loginWithToken, register, logout, updateUser,
      isBanned, banReason, isFrozen, freezeUntil, freezeReason,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
