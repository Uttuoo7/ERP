import { create } from 'zustand';
import React from 'react';
import type { Breadcrumb } from '../components/layout/PageHeader';

interface HeaderState {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  recentItems?: React.ReactNode;
  setHeader: (data: Omit<HeaderState, 'setHeader' | 'clearHeader'>) => void;
  clearHeader: () => void;
}

export const useHeaderStore = create<HeaderState>((set) => ({
  title: '',
  setHeader: (data) => set(data),
  clearHeader: () => set({ 
    title: '', 
    description: undefined, 
    breadcrumbs: undefined, 
    actions: undefined, 
    secondaryActions: undefined, 
    recentItems: undefined 
  }),
}));
