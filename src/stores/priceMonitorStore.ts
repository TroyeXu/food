import { create } from 'zustand';
import type { MonitorTask, PriceHistory, PriceChangeEvent } from '@/types';

interface PriceMonitorState {
  // 監控任務
  monitors: MonitorTask[];
  loading: boolean;
  error: string | null;

  // 價格歷史
  priceHistory: Map<string, PriceHistory[]>;

  // 統計
  stats: {
    total: number;
    enabled: number;
    changed: number;
    errors: number;
  };

  // 操作
  fetchMonitors: () => Promise<void>;
  addMonitor: (planId: string, sourceUrl: string, checkInterval?: 'daily' | 'weekly' | 'manual') => Promise<void>;
  removeMonitor: (planId: string) => Promise<void>;
  enableMonitor: (planId: string) => Promise<void>;
  disableMonitor: (planId: string) => Promise<void>;
  checkMonitor: (planId: string) => Promise<MonitorTask | null>;
  fetchPriceHistory: (planId: string) => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const usePriceMonitorStore = create<PriceMonitorState>((set, get) => ({
  monitors: [],
  loading: false,
  error: null,
  priceHistory: new Map(),
  stats: {
    total: 0,
    enabled: 0,
    changed: 0,
    errors: 0,
  },

  fetchMonitors: async () => {
    set({ loading: true });
    try {
      const response = await fetch('/api/price-monitor');
      if (!response.ok) throw new Error('Failed to fetch monitors');

      const data = await response.json();
      set({
        monitors: data.monitors || [],
        stats: data.stats || { total: 0, enabled: 0, changed: 0, errors: 0 },
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  addMonitor: async (planId: string, sourceUrl: string, checkInterval = 'daily') => {
    set({ loading: true });
    try {
      const response = await fetch('/api/price-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          planId,
          sourceUrl,
          checkInterval,
        }),
      });

      if (!response.ok) throw new Error('Failed to add monitor');

      const newMonitor = await response.json();

      set((state) => ({
        monitors: [...state.monitors, newMonitor],
        error: null,
      }));

      // 刷新統計
      get().fetchMonitors();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  removeMonitor: async (planId: string) => {
    try {
      const response = await fetch('/api/price-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          planId,
        }),
      });

      if (!response.ok) throw new Error('Failed to remove monitor');

      set((state) => ({
        monitors: state.monitors.filter((m) => m.planId !== planId),
        error: null,
      }));

      // 刷新統計
      get().fetchMonitors();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  enableMonitor: async (planId: string) => {
    try {
      const response = await fetch('/api/price-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enable',
          planId,
        }),
      });

      if (!response.ok) throw new Error('Failed to enable monitor');

      const updated = await response.json();

      set((state) => ({
        monitors: state.monitors.map((m) => (m.planId === planId ? updated : m)),
        error: null,
      }));

      get().fetchMonitors();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  disableMonitor: async (planId: string) => {
    try {
      const response = await fetch('/api/price-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disable',
          planId,
        }),
      });

      if (!response.ok) throw new Error('Failed to disable monitor');

      const updated = await response.json();

      set((state) => ({
        monitors: state.monitors.map((m) => (m.planId === planId ? updated : m)),
        error: null,
      }));

      get().fetchMonitors();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  checkMonitor: async (planId: string) => {
    set({ loading: true });
    try {
      const response = await fetch('/api/price-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          planId,
        }),
      });

      if (!response.ok) throw new Error('Failed to check monitor');

      const updated = await response.json();

      set((state) => ({
        monitors: state.monitors.map((m) => (m.planId === planId ? updated : m)),
        error: null,
      }));

      get().fetchMonitors();
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  fetchPriceHistory: async (planId: string) => {
    try {
      const response = await fetch(`/api/price-monitor?planId=${planId}`);
      if (!response.ok) throw new Error('Failed to fetch history');

      const data = await response.json();
      const history = data.history || [];

      set((state) => ({
        priceHistory: new Map(state.priceHistory).set(planId, history),
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
}));
