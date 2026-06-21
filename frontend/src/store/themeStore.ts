import { create } from 'zustand';

export type EnterpriseTheme = 'light' | 'dark' | 'enterprise-blue' | 'professional-gray' | 'high-contrast';

interface ThemeState {
  theme: EnterpriseTheme;
  setTheme: (theme: EnterpriseTheme) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const getStoredTheme = (): EnterpriseTheme => {
    try {
      const raw = localStorage.getItem('erp-enterprise-theme');
      return (raw as EnterpriseTheme) || 'light';
    } catch {
      return 'light';
    }
  };

  return {
    theme: getStoredTheme(),
    setTheme: (theme) => {
      set({ theme });
      try {
        localStorage.setItem('erp-enterprise-theme', theme);
      } catch (e) {
        console.error('Failed to store theme preference:', e);
      }
    }
  };
});
