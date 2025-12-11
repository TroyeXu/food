'use client';

import React, { useEffect, useState } from 'react';
import { useReviewStore } from '@/stores/reviewStore';
import { REVIEW_DIMENSION_LABELS } from '@/types';
import type { Review, ReviewStats } from '@/types';

interface ReviewSectionProps {
  planId: string;
}

export const ReviewSection: React.FC<ReviewSectionProps> = ({ planId }) => {
  const { reviews, stats, loading, fetchReviews, markHelpful, markUnhelpful } =
    useReviewStore();

  const [sort, setSort] = useState<'recent' | 'helpful' | 'rating_high' | 'rating_low'>(
    'recent'
  );
  const [showForm, setShowForm] = useState(false);

  const planReviews = reviews.get(planId) || [];
  const planStats = stats.get(planId);

  useEffect(() => {
    fetchReviews(planId, sort);
  }, [planId, sort, fetchReviews]);

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-300'}>
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 rounded-lg border border-gray-200 p-6">
      {/* 標題和統計 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">用戶評價</h2>

        {planStats && (
          <div className="mt-4 flex items-start justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-900">
                  {planStats.averageRating.toFixed(1)}
                </span>
                <span className="text-gray-500">分 / 5 分</span>
              </div>
              <div className="mt-1">{renderStars(Math.round(planStats.averageRating))}</div>
              <p className="mt-1 text-sm text-gray-600">
                基於 {planStats.totalReviews} 條評價
              </p>
            </div>

            {/* 評分分佈 */}
            <div className="space-y-1 text-right">
              {[5, 4, 3, 2, 1].map((rating) => (
                <div key={rating} className="flex items-center justify-end gap-2 text-sm">
                  <span className="w-8 text-gray-600">{rating} ⭐</span>
                  <div className="h-2 w-24 rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-yellow-400"
                      style={{
                        width: `${(planStats.ratingDistribution[rating] / planStats.totalReviews) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-gray-500">
                    {planStats.ratingDistribution[rating]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 維度評分 */}
        {planStats?.dimensionAverages && Object.keys(planStats.dimensionAverages).length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {Object.entries(planStats.dimensionAverages).map(([dimension, score]) => (
              <div key={dimension}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {REVIEW_DIMENSION_LABELS[dimension as any]}
                  </span>
                  <span className="font-medium text-gray-900">{score.toFixed(1)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(score / 5) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 發表評價按鈕 */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600"
      >
        {showForm ? '取消' : '發表評價'}
      </button>

      {/* 評價表單 */}
      {showForm && (
        <ReviewForm planId={planId} onSuccess={() => setShowForm(false)} />
      )}

      {/* 排序選項 */}
      <div className="flex gap-2 border-b border-gray-200 pb-4">
        {(['recent', 'helpful', 'rating_high', 'rating_low'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              sort === s
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {s === 'recent' && '最新'}
            {s === 'helpful' && '最有用'}
            {s === 'rating_high' && '最高分'}
            {s === 'rating_low' && '最低分'}
          </button>
        ))}
      </div>

      {/* 評價列表 */}
      {loading ? (
        <div className="py-8 text-center text-gray-500">載入中...</div>
      ) : planReviews.length === 0 ? (
        <div className="py-8 text-center text-gray-500">還沒有評價，成為第一位評価者吧！</div>
      ) : (
        <div className="space-y-4">
          {planReviews.map((review: Review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onHelpful={() => markHelpful(review.id)}
              onUnhelpful={() => markUnhelpful(review.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 評價卡片
interface ReviewCardProps {
  review: Review;
  onHelpful: () => void;
  onUnhelpful: () => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, onHelpful, onUnhelpful }) => {
  return (
    <div className="space-y-3 border-b border-gray-200 pb-4 last:border-0">
      {/* 標題和評分 */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-900">{review.title}</p>
          <div className="mt-1 flex gap-4 text-sm text-gray-600">
            <span>{review.userName}</span>
            <span>
              {new Date(review.createdAt).toLocaleDateString('zh-TW')}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={i <= review.rating ? 'text-yellow-400' : 'text-gray-300'}>
              ★
            </span>
          ))}
        </div>
      </div>

      {/* 維度評分 */}
      {review.dimensionRatings && Object.keys(review.dimensionRatings).length > 0 && (
        <div className="grid gap-2 text-sm">
          {Object.entries(review.dimensionRatings).map(([dimension, rating]) => (
            <div key={dimension} className="flex items-center justify-between">
              <span className="text-gray-600">
                {REVIEW_DIMENSION_LABELS[dimension as any]}
              </span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className={i <= (rating as number) ? 'text-blue-400' : 'text-gray-300'}
                  >
                    ●
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 內容 */}
      <p className="text-gray-700">{review.content}</p>

      {/* 賣家回覆 */}
      {review.vendorReply && (
        <div className="rounded bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">賣家回覆:</p>
          <p className="mt-1 text-sm text-blue-800">{review.vendorReply.content}</p>
          <p className="mt-1 text-xs text-blue-600">
            {new Date(review.vendorReply.respondedAt).toLocaleDateString('zh-TW')}
          </p>
        </div>
      )}

      {/* 互動按鈕 */}
      <div className="flex gap-4">
        <button
          onClick={onHelpful}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          👍 有用 ({review.helpful})
        </button>
        <button
          onClick={onUnhelpful}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          👎 無用 ({review.unhelpful})
        </button>
      </div>
    </div>
  );
};

// 評價表單
interface ReviewFormProps {
  planId: string;
  onSuccess: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ planId, onSuccess }) => {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [userName, setUserName] = useState('');
  const [dimensionRatings, setDimensionRatings] = useState<Record<string, number>>({
    taste: 5,
    value: 5,
    delivery: 5,
  });
  const [submitting, setSubmitting] = useState(false);

  const { submitReview } = useReviewStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      alert('請填寫標題和內容');
      return;
    }

    setSubmitting(true);
    const result = await submitReview(planId, rating, title, content, dimensionRatings, userName);
    setSubmitting(false);

    if (result) {
      alert('評價已發表！');
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-gray-50 p-4">
      {/* 昵稱 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">昵稱 (可選)</label>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="匿名用戶"
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>

      {/* 整體評分 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">整體評分</label>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRating(r)}
              className={`text-3xl transition-colors ${
                r <= rating ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-200'
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* 維度評分 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">各項評分 (可選)</label>
        {['taste', 'value', 'delivery'].map((dimension) => (
          <div key={dimension} className="flex items-center justify-between">
            <label className="text-sm text-gray-600">
              {REVIEW_DIMENSION_LABELS[dimension as any]}
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() =>
                    setDimensionRatings({ ...dimensionRatings, [dimension]: r })
                  }
                  className={`text-lg transition-colors ${
                    r <= (dimensionRatings[dimension] || 0)
                      ? 'text-blue-400'
                      : 'text-gray-300 hover:text-blue-200'
                  }`}
                >
                  ●
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 標題 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">評價標題</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="用一句話總結您的體驗"
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          required
        />
      </div>

      {/* 內容 */}
      <div>
        <label className="block text-sm font-medium text-gray-700">評價內容</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="分享您的詳細體驗..."
          rows={4}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          required
        />
      </div>

      {/* 按鈕 */}
      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {submitting ? '提交中...' : '發表評價'}
        </button>
      </div>
    </form>
  );
};
