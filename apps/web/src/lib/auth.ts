import { create } from 'zustand';
import { disconnectSocket } from './socket';

const TOKEN_KEY = 'magically_token';
const USER_KEY = 'magically_user';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  /** True while we're validating a stored token against the server on startup */
  isRestoring: boolean;

  isAuthenticated: () => boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  setRestoring: (value: boolean) => void;
}

function readStorage<T>(key: string, parse: (raw: string) => T): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parse(raw) : null;
  } catch {
    return null;
  }
}

// Read synchronously at module load time so the first render already has the token
const storedToken = readStorage(TOKEN_KEY, (v) => v);
const storedUser = readStorage(USER_KEY, (v) => JSON.parse(v) as AuthUser);

export const useAuthStore = create<AuthState>((set, get) => ({
  token: storedToken,
  user: storedUser,
  // If we have a stored token we need to validate it with the server before trusting it
  isRestoring: storedToken !== null,

  isAuthenticated: () => get().token !== null,

  setAuth: (token, user) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // TODO: storage quota exceeded or private browsing — degrade gracefully
    }
    set({ token, user, isRestoring: false });
  },

  logout: () => {
    disconnectSocket();
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore
    }
    set({ token: null, user: null, isRestoring: false });
  },

  setRestoring: (value) => set({ isRestoring: value }),
}));
