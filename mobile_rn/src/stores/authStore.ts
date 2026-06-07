// stores/authStore.ts — PostureAI Mobile
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const mmkvStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  photoURL?: string;
  plan: 'starter' | 'growth' | 'scale' | 'enterprise';
  orgId?: string;
  orgName?: string;
  role: 'admin' | 'manager' | 'user';
  streak: number;
  totalSessions: number;
  avgScore: number;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  hasSeenOnboarding: boolean;
  setUser: (u: UserProfile | null) => void;
  setToken: (t: string | null) => void;
  setLoading: (v: boolean) => void;
  setHasSeenOnboarding: (v: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:               null,
      token:              null,
      loading:            true,
      hasSeenOnboarding:  false,
      setUser:            (user)  => set({ user, loading: false }),
      setToken:           (token) => set({ token }),
      setLoading:         (loading) => set({ loading }),
      setHasSeenOnboarding: (v) => set({ hasSeenOnboarding: v }),
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'postureai-auth',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (s) => ({ user: s.user, token: s.token, hasSeenOnboarding: s.hasSeenOnboarding }),
    }
  )
);
