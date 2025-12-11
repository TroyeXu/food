/**
 * 數據層抽象 - 支持數據庫和 JSON 兩種方式
 *
 * 開發模式：通過 API 連接 PostgreSQL
 * 生產模式：直接讀取靜態 JSON 文件
 */

import type { Plan, Vendor } from '@/types';
import { isDevelopment, isProduction } from './config';

export interface DataLayer {
  // Plans
  getAllPlans: () => Promise<Plan[]>;
  getPlanById: (id: string) => Promise<Plan | undefined>;
  getPlansByStatus: (status: Plan['status']) => Promise<Plan[]>;
  addPlan: (plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updatePlan: (id: string, updates: Partial<Omit<Plan, 'id' | 'createdAt'>>) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;

  // Vendors
  getAllVendors: () => Promise<Vendor[]>;
  addVendor: (vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  deleteVendor: (id: string) => Promise<void>;
}

/**
 * 開發模式數據層 - 通過 API 連接數據庫
 */
class DevelopmentDataLayer implements DataLayer {
  private apiUrl: string;

  constructor(apiUrl: string = '/api') {
    this.apiUrl = apiUrl;
  }

  async getAllPlans(): Promise<Plan[]> {
    const response = await fetch(`${this.apiUrl}/plans`);
    if (!response.ok) throw new Error('Failed to fetch plans');
    const data = await response.json();
    return data.plans || [];
  }

  async getPlanById(id: string): Promise<Plan | undefined> {
    const response = await fetch(`${this.apiUrl}/plans?id=${id}`);
    if (!response.ok) return undefined;
    return await response.json();
  }

  async getPlansByStatus(status: Plan['status']): Promise<Plan[]> {
    const response = await fetch(`${this.apiUrl}/plans?status=${status}`);
    if (!response.ok) throw new Error('Failed to fetch plans');
    const data = await response.json();
    return data.plans || [];
  }

  async addPlan(plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const response = await fetch(`${this.apiUrl}/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    if (!response.ok) throw new Error('Failed to add plan');
    const data = await response.json();
    return data.id;
  }

  async updatePlan(id: string, updates: Partial<Omit<Plan, 'id' | 'createdAt'>>): Promise<void> {
    const response = await fetch(`${this.apiUrl}/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update plan');
  }

  async deletePlan(id: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/plans/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete plan');
  }

  async getAllVendors(): Promise<Vendor[]> {
    const response = await fetch(`${this.apiUrl}/vendors`);
    if (!response.ok) throw new Error('Failed to fetch vendors');
    const data = await response.json();
    return data.vendors || [];
  }

  async addVendor(vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const response = await fetch(`${this.apiUrl}/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vendor),
    });
    if (!response.ok) throw new Error('Failed to add vendor');
    const data = await response.json();
    return data.id;
  }

  async deleteVendor(id: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/vendors/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete vendor');
  }
}

/**
 * 生產模式數據層 - 讀取靜態 JSON 文件
 */
class ProductionDataLayer implements DataLayer {
  private plansCache: Plan[] | null = null;
  private vendorsCache: Vendor[] | null = null;

  async getAllPlans(): Promise<Plan[]> {
    if (this.plansCache) return this.plansCache;

    try {
      const response = await fetch('/data/plans.json');
      if (!response.ok) throw new Error('Failed to fetch plans.json');
      this.plansCache = await response.json();
      return this.plansCache;
    } catch (error) {
      console.error('Error loading plans from JSON:', error);
      return [];
    }
  }

  async getPlanById(id: string): Promise<Plan | undefined> {
    const plans = await this.getAllPlans();
    return plans.find((p) => p.id === id);
  }

  async getPlansByStatus(status: Plan['status']): Promise<Plan[]> {
    const plans = await this.getAllPlans();
    return plans.filter((p) => p.status === status);
  }

  async addPlan(_plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    console.warn('Cannot add plan in production mode (read-only)');
    throw new Error('Production mode is read-only');
  }

  async updatePlan(_id: string, _updates: Partial<Omit<Plan, 'id' | 'createdAt'>>): Promise<void> {
    console.warn('Cannot update plan in production mode (read-only)');
    throw new Error('Production mode is read-only');
  }

  async deletePlan(_id: string): Promise<void> {
    console.warn('Cannot delete plan in production mode (read-only)');
    throw new Error('Production mode is read-only');
  }

  async getAllVendors(): Promise<Vendor[]> {
    if (this.vendorsCache) return this.vendorsCache;

    try {
      const response = await fetch('/data/vendors.json');
      if (!response.ok) throw new Error('Failed to fetch vendors.json');
      this.vendorsCache = await response.json();
      return this.vendorsCache;
    } catch (error) {
      console.error('Error loading vendors from JSON:', error);
      return [];
    }
  }

  async addVendor(_vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    console.warn('Cannot add vendor in production mode (read-only)');
    throw new Error('Production mode is read-only');
  }

  async deleteVendor(_id: string): Promise<void> {
    console.warn('Cannot delete vendor in production mode (read-only)');
    throw new Error('Production mode is read-only');
  }
}

/**
 * 獲取適當的數據層實現
 */
let dataLayerInstance: DataLayer | null = null;

export function getDataLayer(): DataLayer {
  if (dataLayerInstance) return dataLayerInstance;

  if (isDevelopment()) {
    dataLayerInstance = new DevelopmentDataLayer();
  } else {
    dataLayerInstance = new ProductionDataLayer();
  }

  return dataLayerInstance;
}

/**
 * 重置數據層（用於測試）
 */
export function resetDataLayer(): void {
  dataLayerInstance = null;
}
