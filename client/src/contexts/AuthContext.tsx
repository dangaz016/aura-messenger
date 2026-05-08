import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { cryptoService } from '../services/crypto';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.me()
      .then(async (u) => {
        setUser(u);
        await ensurePublicKey(u);
        socketService.connect(token);
      })
      .catch((err) => {
        // Only clear token on auth errors (401/403/404), not network/server errors
        const status = err?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          api.clearToken();
        }
        // For 500 / network errors: keep token, user stays "logged in" on next visit
      })
      .finally(() => setLoading(false));
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

  async function register(username: string, password: string, displayName?: string) {
    const { token, user: u } = await api.register(username, password, displayName);
    setUser(u);
    await ensurePublicKey(u);
    socketService.connect(token);
  }

  function logout() {
    api.clearToken();
    cryptoService.clearKeys();
    socketService.disconnect();
    setUser(null);
  }

  function updateUser(u: User) {
    setUser(u);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
