import { create } from 'zustand';
import type { Review, ReviewStats, ReviewDimension } from '@/types';

interface ReviewState {
  // 評價數據
  reviews: Map<string, Review[]>;
  stats: Map<string, ReviewStats>;
  loading: boolean;
  error: string | null;

  // 操作
  fetchReviews: (planId: string, sort?: string, limit?: number) => Promise<void>;
  fetchStats: (planId: string) => Promise<ReviewStats | null>;
  submitReview: (
    planId: string,
    rating: number,
    title: string,
    content: string,
    dimensionRatings?: Partial<Record<ReviewDimension, number>>,
    userName?: string
  ) => Promise<Review | null>;
  markHelpful: (reviewId: string) => Promise<void>;
  markUnhelpful: (reviewId: string) => Promise<void>;
  replyToReview: (reviewId: string, vendorReply: string) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  reviews: new Map(),
  stats: new Map(),
  loading: false,
  error: null,

  fetchReviews: async (planId: string, sort = 'recent', limit = 10) => {
    set({ loading: true });
    try {
      const response = await fetch(
        `/api/reviews?planId=${planId}&sort=${sort}&limit=${limit}`
      );

      if (!response.ok) throw new Error('Failed to fetch reviews');

      const data = await response.json();
      const reviews = data.reviews || [];
      const stats = data.stats;

      set((state) => ({
        reviews: new Map(state.reviews).set(planId, reviews),
        stats: new Map(state.stats).set(planId, stats),
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async (planId: string) => {
    try {
      const response = await fetch('/api/reviews');
      if (!response.ok) throw new Error('Failed to fetch stats');

      const statsData = await response.json();
      const stats = statsData[planId];

      if (stats) {
        set((state) => ({
          stats: new Map(state.stats).set(planId, stats),
          error: null,
        }));
        return stats;
      }

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
      return null;
    }
  },

  submitReview: async (
    planId: string,
    rating: number,
    title: string,
    content: string,
    dimensionRatings?: Partial<Record<ReviewDimension, number>>,
    userName?: string
  ) => {
    set({ loading: true });
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          rating,
          title,
          content,
          dimensionRatings,
          userName,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit review');

      const newReview = await response.json() as Review;

      // 更新本地快取
      set((state) => {
        const planReviews = state.reviews.get(planId) || [];
        return {
          reviews: new Map(state.reviews).set(planId, [newReview, ...planReviews]),
          error: null,
        };
      });

      // 重新取得統計
      get().fetchStats(planId);

      return newReview;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  markHelpful: async (reviewId: string) => {
    try {
      const response = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          action: 'helpful',
        }),
      });

      if (!response.ok) throw new Error('Failed to mark helpful');

      const updated = await response.json();

      // 更新本地快取
      set((state) => {
        const newReviews = new Map(state.reviews);
        for (const [planId, reviews] of newReviews.entries()) {
          const idx = reviews.findIndex((r) => r.id === reviewId);
          if (idx !== -1) {
            reviews[idx] = updated;
            break;
          }
        }
        return { reviews: newReviews, error: null };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  markUnhelpful: async (reviewId: string) => {
    try {
      const response = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          action: 'unhelpful',
        }),
      });

      if (!response.ok) throw new Error('Failed to mark unhelpful');

      const updated = await response.json();

      set((state) => {
        const newReviews = new Map(state.reviews);
        for (const [planId, reviews] of newReviews.entries()) {
          const idx = reviews.findIndex((r) => r.id === reviewId);
          if (idx !== -1) {
            reviews[idx] = updated;
            break;
          }
        }
        return { reviews: newReviews, error: null };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  replyToReview: async (reviewId: string, vendorReply: string) => {
    try {
      const response = await fetch('/api/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          action: 'reply',
          vendorReply,
        }),
      });

      if (!response.ok) throw new Error('Failed to reply');

      const updated = await response.json();

      set((state) => {
        const newReviews = new Map(state.reviews);
        for (const [planId, reviews] of newReviews.entries()) {
          const idx = reviews.findIndex((r) => r.id === reviewId);
          if (idx !== -1) {
            reviews[idx] = updated;
            break;
          }
        }
        return { reviews: newReviews, error: null };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  setError: (error: string | null) => set({ error }),
}));
