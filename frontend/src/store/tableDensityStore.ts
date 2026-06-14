import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TableDensity = 'comfortable' | 'compact';

interface TableDensityState {
  density: TableDensity;
  setDensity: (density: TableDensity) => void;
  toggleDensity: () => void;
}

export const useTableDensityStore = create<TableDensityState>()(
  persist(
    (set) => ({
      density: 'comfortable',
      setDensity: (density) => set({ density }),
      toggleDensity: () => set((state) => ({ 
        density: state.density === 'comfortable' ? 'compact' : 'comfortable' 
      })),
    }),
    {
      name: 'erp-table-density-storage',
    }
  )
);
