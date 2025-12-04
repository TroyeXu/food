import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

const getStoredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('theme') as Theme) || 'system';
};

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    // System preference
    root.classList.remove('light', 'dark');
  }
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'system',

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
      applyTheme(theme);
    }
    set({ theme });
  },

  toggleTheme: () => {
    const { theme, setTheme } = get();
    // Cycle: system -> light -> dark -> system
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  },

  initTheme: () => {
    if (typeof window === 'undefined') return;
    const stored = getStoredTheme();
    set({ theme: stored });
    applyTheme(stored);
  },
}));
