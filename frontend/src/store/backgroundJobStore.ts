import { create } from 'zustand';

export interface BackgroundJob {
  id: string;
  name: string;
  progress: number; // 0 to 100
  status: 'running' | 'completed' | 'failed';
}

interface BackgroundJobState {
  jobs: BackgroundJob[];
  addJob: (name: string) => string;
  updateProgress: (id: string, progress: number) => void;
  completeJob: (id: string) => void;
  failJob: (id: string) => void;
  clearFinishedJobs: () => void;
}

export const useBackgroundJobStore = create<BackgroundJobState>((set) => ({
  jobs: [],

  addJob: (name) => {
    const id = `job-${Date.now()}`;
    set((state) => ({
      jobs: [
        ...state.jobs,
        { id, name, progress: 0, status: 'running' }
      ]
    }));
    return id;
  },

  updateProgress: (id, progress) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? { ...job, progress: Math.min(100, Math.max(0, progress)) } : job
      )
    }));
  },

  completeJob: (id) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? { ...job, progress: 100, status: 'completed' as const } : job
      )
    }));
    // Auto-dismiss completed jobs after 5 seconds to prevent memory bloating
    setTimeout(() => {
      set((state) => ({
        jobs: state.jobs.filter((job) => job.id !== id)
      }));
    }, 5000);
  },

  failJob: (id) => {
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id ? { ...job, status: 'failed' as const } : job
      )
    }));
    // Auto-dismiss failed jobs after 10 seconds
    setTimeout(() => {
      set((state) => ({
        jobs: state.jobs.filter((job) => job.id !== id)
      }));
    }, 10000);
  },

  clearFinishedJobs: () => {
    set((state) => ({
      jobs: state.jobs.filter((job) => job.status === 'running')
    }));
  }
}));
