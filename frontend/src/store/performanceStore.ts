import { create } from 'zustand';

export interface PerformanceMetric {
  id: string;
  category: 'initial_load' | 'tab_switch' | 'module_switch' | 'search' | 'ribbon_switch' | 'render';
  action: string;
  duration: number; // milliseconds
  timestamp: number;
}

interface PerformanceState {
  metrics: PerformanceMetric[];
  addMetric: (category: PerformanceMetric['category'], action: string, duration: number) => void;
  clearMetrics: () => void;
}

export const usePerformanceStore = create<PerformanceState>((set) => ({
  metrics: [],

  addMetric: (category, action, duration) => {
    const id = `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMetric: PerformanceMetric = {
      id,
      category,
      action,
      duration: Math.round(duration * 100) / 100, // round to 2 decimal places
      timestamp: Date.now()
    };
    
    set((state) => ({
      metrics: [newMetric, ...state.metrics].slice(0, 100) // Keep last 100 logs
    }));

    // Output performance details to developer console
    if (process.env.NODE_ENV !== 'production' || window.location.hostname === 'localhost') {
      console.log(`[Perf telemtry] [${category.toUpperCase()}] ${action} completed in ${newMetric.duration}ms`);
    }
  },

  clearMetrics: () => set({ metrics: [] })
}));
