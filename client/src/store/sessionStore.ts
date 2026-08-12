import { create } from 'zustand'; import type { User } from '../types/api'; interface State { user: User | null; loaded: boolean; setUser: (user: User | null) => void; setLoaded: () => void; } export const useSessionStore = create<State>(set => ({ user: null, loaded: false, setUser: user => set({ user }), setLoaded: () => set({ loaded: true }) }));

