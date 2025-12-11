import { create } from 'zustand';
import type { ShoppingList, ShoppingListItem } from '@/types';

interface ShoppingListState {
  // 清單數據
  lists: ShoppingList[];
  currentList: ShoppingList | null;
  loading: boolean;
  error: string | null;

  // 操作
  fetchLists: () => Promise<void>;
  fetchList: (id: string) => Promise<ShoppingList | null>;
  createList: (name: string, description?: string) => Promise<ShoppingList | null>;
  updateList: (id: string, name?: string, description?: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  addItem: (listId: string, planId: string, quantity?: number) => Promise<void>;
  removeItem: (listId: string, planId: string) => Promise<void>;
  updateItem: (listId: string, planId: string, quantity?: number, notes?: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useShoppingListStore = create<ShoppingListState>((set, get) => ({
  lists: [],
  currentList: null,
  loading: false,
  error: null,

  fetchLists: async () => {
    set({ loading: true });
    try {
      const response = await fetch('/api/shopping-lists');
      if (!response.ok) throw new Error('Failed to fetch lists');

      const data = await response.json();
      set({
        lists: data.lists || [],
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  fetchList: async (id: string) => {
    set({ loading: true });
    try {
      const response = await fetch(`/api/shopping-lists?id=${id}`);
      if (!response.ok) throw new Error('Failed to fetch list');

      const list = (await response.json()) as ShoppingList;
      set({
        currentList: list,
        error: null,
      });
      return list;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  createList: async (name: string, description?: string) => {
    set({ loading: true });
    try {
      const response = await fetch('/api/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) throw new Error('Failed to create list');

      const newList = (await response.json()) as ShoppingList;

      set((state) => ({
        lists: [...state.lists, newList],
        currentList: newList,
        error: null,
      }));

      return newList;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  updateList: async (id: string, name?: string, description?: string) => {
    try {
      const response = await fetch('/api/shopping-lists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, description }),
      });

      if (!response.ok) throw new Error('Failed to update list');

      const updated = (await response.json()) as ShoppingList;

      set((state) => ({
        lists: state.lists.map((l) => (l.id === id ? updated : l)),
        currentList: state.currentList?.id === id ? updated : state.currentList,
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  deleteList: async (id: string) => {
    try {
      const response = await fetch(`/api/shopping-lists?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete list');

      set((state) => ({
        lists: state.lists.filter((l) => l.id !== id),
        currentList: state.currentList?.id === id ? null : state.currentList,
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  addItem: async (listId: string, planId: string, quantity = 1) => {
    set((state) => {
      if (!state.currentList || state.currentList.id !== listId) {
        return {};
      }

      const existingItem = state.currentList.items.find((i) => i.planId === planId);

      const newItems = existingItem
        ? state.currentList.items.map((i) =>
            i.planId === planId ? { ...i, quantity: i.quantity + quantity } : i
          )
        : [
            ...state.currentList.items,
            { planId, quantity, addedAt: new Date() },
          ];

      return {
        currentList: { ...state.currentList, items: newItems },
      };
    });

    // 同步到服務器
    try {
      const state = get();
      if (state.currentList) {
        await fetch('/api/shopping-lists', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: listId,
            items: state.currentList.items,
          }),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  removeItem: async (listId: string, planId: string) => {
    set((state) => {
      if (!state.currentList || state.currentList.id !== listId) {
        return {};
      }

      return {
        currentList: {
          ...state.currentList,
          items: state.currentList.items.filter((i) => i.planId !== planId),
        },
      };
    });

    // 同步到服務器
    try {
      const state = get();
      if (state.currentList) {
        await fetch('/api/shopping-lists', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: listId,
            items: state.currentList.items,
          }),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  updateItem: async (listId: string, planId: string, quantity?: number, notes?: string) => {
    set((state) => {
      if (!state.currentList || state.currentList.id !== listId) {
        return {};
      }

      return {
        currentList: {
          ...state.currentList,
          items: state.currentList.items.map((i) =>
            i.planId === planId
              ? {
                  ...i,
                  quantity: quantity !== undefined ? quantity : i.quantity,
                  notes: notes !== undefined ? notes : i.notes,
                }
              : i
          ),
        },
      };
    });

    // 同步到服務器
    try {
      const state = get();
      if (state.currentList) {
        await fetch('/api/shopping-lists', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: listId,
            items: state.currentList.items,
          }),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  setError: (error: string | null) => set({ error }),
}));
