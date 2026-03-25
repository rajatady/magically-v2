import { create } from 'zustand';

const TOKEN_KEY = 'magically_token';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;

  isAuthenticated: () => boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  restore: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,

  isAuthenticated: () => get().token !== null,

  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null });
  },

  restore: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      set({ token });
    }
  },
}));
