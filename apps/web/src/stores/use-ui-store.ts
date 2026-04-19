import { create } from 'zustand';

interface UIState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: UIState['theme']) => void;
}

/**
 * Placeholder Zustand store — proves the wiring works end-to-end. Real app
 * state (sidebar, toasts, modals) lands in later modules.
 */
export const useUIStore = create<UIState>((set) => ({
  theme: 'system',
  setTheme: (theme) => {
    set({ theme });
  },
}));
