import { create } from 'zustand';

interface RecentPage {
  path: string;
  title: string;
  timestamp: number;
}

interface NavigationState {
  favorites: string[];
  recents: RecentPage[];
  toggleFavorite: (path: string) => void;
  addRecent: (path: string, title: string) => void;
}

export const useNavigationStore = create<NavigationState>((set) => {
  // Load initial state from localStorage safely
  const getStoredFavorites = (): string[] => {
    try {
      const raw = localStorage.getItem('erp-favorites');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const getStoredRecents = (): RecentPage[] => {
    try {
      const raw = localStorage.getItem('erp-recents');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  return {
    favorites: getStoredFavorites(),
    recents: getStoredRecents(),

    toggleFavorite: (path: string) => {
      set((state) => {
        const isFav = state.favorites.includes(path);
        const nextFavorites = isFav
          ? state.favorites.filter((p) => p !== path)
          : [...state.favorites, path];
        
        localStorage.setItem('erp-favorites', JSON.stringify(nextFavorites));
        return { favorites: nextFavorites };
      });
    },

    addRecent: (path: string, title: string) => {
      // Avoid tracking dynamic sub-routes or duplicate entries
      set((state) => {
        const timestamp = Date.now();
        const cleanRecents = state.recents.filter((r) => r.path !== path);
        const nextRecents = [{ path, title, timestamp }, ...cleanRecents].slice(0, 20);

        localStorage.setItem('erp-recents', JSON.stringify(nextRecents));
        return { recents: nextRecents };
      });
    }
  };
});
