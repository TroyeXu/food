'use client';

import React, { useEffect, useState } from 'react';
import { useShoppingListStore } from '@/stores/shoppingListStore';
import { usePlanStore } from '@/stores/planStore';
import type { ShoppingList } from '@/types';

interface ShoppingListPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShoppingListPanel: React.FC<ShoppingListPanelProps> = ({ isOpen, onClose }) => {
  const {
    lists,
    currentList,
    loading,
    fetchLists,
    fetchList,
    createList,
    deleteList,
    addItem,
    removeItem,
    updateItem,
  } = useShoppingListStore();

  const { plans } = usePlanStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchLists();
    }
  }, [isOpen, fetchLists]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const newList = await createList(newListName);
    if (newList) {
      setNewListName('');
      setShowCreateForm(false);
    }
  };

  const handleSelectList = (list: ShoppingList) => {
    fetchList(list.id);
  };

  // 計算清單統計
  const calculateStats = () => {
    if (!currentList) return { totalPrice: 0, totalServings: 0, itemCount: 0 };

    let totalPrice = 0;
    let totalServings = 0;

    currentList.items.forEach((item) => {
      const plan = plans.find((p) => p.id === item.planId);
      if (plan) {
        totalPrice += (plan.priceDiscount || 0) * item.quantity;
        totalServings += (plan.servingsMax || plan.servingsMin || 0) * item.quantity;
      }
    });

    return {
      totalPrice,
      totalServings,
      itemCount: currentList.items.length,
    };
  };

  const stats = calculateStats();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        {/* 標題 */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">購物清單</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* 清單列表 */}
        {!currentList && (
          <div className="space-y-4">
            {/* 建立新清單 */}
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600"
              >
                建立新清單
              </button>
            )}

            {showCreateForm && (
              <form onSubmit={handleCreateList} className="space-y-3 rounded-lg bg-gray-50 p-4">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="清單名稱（例：除夕年菜）"
                  className="w-full rounded border border-gray-300 px-3 py-2"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600"
                  >
                    建立
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    取消
                  </button>
                </div>
              </form>
            )}

            {/* 清單列表 */}
            <div className="space-y-2">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                  onClick={() => handleSelectList(list)}
                >
                  <div>
                    <p className="font-medium text-gray-900">{list.name}</p>
                    <p className="text-sm text-gray-600">{list.items.length} 項商品</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteList(list.id);
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 清單詳情 */}
        {currentList && (
          <div className="space-y-4">
            {/* 返回按鈕 */}
            <button
              onClick={() => fetchLists()}
              className="text-blue-600 hover:text-blue-700"
            >
              ← 返回清單列表
            </button>

            {/* 清單頭部 */}
            <div className="rounded-lg bg-gray-50 p-4">
              <h3 className="text-lg font-bold text-gray-900">{currentList.name}</h3>
              {currentList.description && (
                <p className="mt-1 text-sm text-gray-600">{currentList.description}</p>
              )}
            </div>

            {/* 統計信息 */}
            <div className="grid gap-2 rounded-lg bg-blue-50 p-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-blue-600">商品數量</p>
                <p className="text-2xl font-bold text-blue-900">{stats.itemCount}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600">估計人數</p>
                <p className="text-2xl font-bold text-blue-900">{stats.totalServings}</p>
              </div>
              <div>
                <p className="text-sm text-blue-600">估計總價</p>
                <p className="text-2xl font-bold text-blue-900">
                  NT${stats.totalPrice.toLocaleString('zh-TW')}
                </p>
              </div>
            </div>

            {/* 清單項目 */}
            {currentList.items.length === 0 ? (
              <div className="py-8 text-center text-gray-500">清單為空</div>
            ) : (
              <div className="space-y-3">
                {currentList.items.map((item) => {
                  const plan = plans.find((p) => p.id === item.planId);
                  if (!plan) return null;

                  return (
                    <ShoppingListItemCard
                      key={item.planId}
                      item={item}
                      plan={plan}
                      onRemove={() => removeItem(currentList.id, item.planId)}
                      onUpdateQuantity={(qty) =>
                        updateItem(currentList.id, item.planId, qty)
                      }
                    />
                  );
                })}
              </div>
            )}

            {/* 動作按鈕 */}
            <div className="flex gap-2 border-t border-gray-200 pt-4">
              <button
                onClick={() => {
                  const itemsText = currentList.items
                    .map((item) => {
                      const plan = plans.find((p) => p.id === item.planId);
                      return `${plan?.title} x${item.quantity}`;
                    })
                    .join('\n');
                  const text = `${currentList.name}\n\n${itemsText}\n\n總價: NT$${stats.totalPrice.toLocaleString('zh-TW')}`;
                  navigator.clipboard.writeText(text);
                  alert('已複製到剪貼板');
                }}
                className="flex-1 rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
              >
                複製清單
              </button>
              <button
                onClick={() => deleteList(currentList.id)}
                className="rounded border border-red-300 px-4 py-2 font-medium text-red-700 hover:bg-red-50"
              >
                刪除清單
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 清單項目卡片
interface ShoppingListItemCardProps {
  item: any;
  plan: any;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}

const ShoppingListItemCard: React.FC<ShoppingListItemCardProps> = ({
  item,
  plan,
  onRemove,
  onUpdateQuantity,
}) => {
  return (
    <div className="flex items-start justify-between rounded-lg border border-gray-200 p-3">
      <div className="flex-1">
        <p className="font-medium text-gray-900">{plan.title}</p>
        <p className="text-sm text-gray-600">{plan.vendorName}</p>
        <p className="mt-1 font-bold text-blue-600">
          NT${(plan.priceDiscount * item.quantity).toLocaleString('zh-TW')}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* 數量控制 */}
        <div className="flex items-center rounded border border-gray-300">
          <button
            onClick={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
            className="px-2 py-1 text-gray-600 hover:bg-gray-100"
          >
            −
          </button>
          <span className="px-3 py-1 font-medium">{item.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            className="px-2 py-1 text-gray-600 hover:bg-gray-100"
          >
            +
          </button>
        </div>

        {/* 刪除按鈕 */}
        <button
          onClick={onRemove}
          className="text-red-600 hover:text-red-700"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
