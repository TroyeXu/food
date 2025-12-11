import Dexie, { type EntityTable } from 'dexie';
import type { Plan, Vendor, Extraction, ScraperJob, ScraperBatch } from '@/types';

// 定義資料庫
const db = new Dexie('LunarNewYearMealsDB') as Dexie & {
  vendors: EntityTable<Vendor, 'id'>;
  plans: EntityTable<Plan, 'id'>;
  extractions: EntityTable<Extraction, 'id'>;
  scraperJobs: EntityTable<ScraperJob, 'id'>;
  scraperBatches: EntityTable<ScraperBatch, 'id'>;
};

// 定義 schema - 使用 version 2 增加新表
db.version(1).stores({
  vendors: 'id, name, createdAt, updatedAt',
  plans: 'id, vendorId, vendorName, title, priceDiscount, shippingType, storageType, servingsMin, servingsMax, orderDeadline, status, createdAt, updatedAt, *tags',
  extractions: 'id, planId, createdAt',
});

db.version(2).stores({
  vendors: 'id, name, createdAt, updatedAt',
  plans: 'id, vendorId, vendorName, title, priceDiscount, shippingType, storageType, servingsMin, servingsMax, orderDeadline, status, createdAt, updatedAt, *tags',
  extractions: 'id, planId, createdAt',
  scraperJobs: 'id, url, status, startedAt, completedAt, planId, createdAt, updatedAt',
  scraperBatches: 'id, name, status, startedAt, completedAt, createdAt',
});

export { db };

// 輔助函數
export async function getAllPlans(): Promise<Plan[]> {
  return db.plans.toArray();
}

export async function getPlansByStatus(status: Plan['status']): Promise<Plan[]> {
  return db.plans.where('status').equals(status).toArray();
}

export async function getPlanById(id: string): Promise<Plan | undefined> {
  return db.plans.get(id);
}

export async function addPlan(plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.plans.add({
    ...plan,
    id,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updatePlan(id: string, updates: Partial<Omit<Plan, 'id' | 'createdAt'>>): Promise<void> {
  await db.plans.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deletePlan(id: string): Promise<void> {
  await db.plans.delete(id);
}

export async function getAllVendors(): Promise<Vendor[]> {
  return db.vendors.toArray();
}

export async function addVendor(vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.vendors.add({
    ...vendor,
    id,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function addExtraction(extraction: Omit<Extraction, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.extractions.add({
    ...extraction,
    id,
    createdAt: new Date(),
  });
  return id;
}

export async function getExtractionsByPlanId(planId: string): Promise<Extraction[]> {
  return db.extractions.where('planId').equals(planId).toArray();
}

// 清除所有資料
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.plans, db.vendors, db.extractions], async () => {
    await db.plans.clear();
    await db.vendors.clear();
    await db.extractions.clear();
  });

  // 同時清除 localStorage 中的相關資料
  if (typeof window !== 'undefined') {
    localStorage.removeItem('favoriteIds');
    localStorage.removeItem('historyIds');
    localStorage.removeItem('planNotes');
  }
}

// 計數函數
export async function countPlansByStatus(): Promise<{ draft: number; published: number; needs_review: number }> {
  const [draft, published, needs_review] = await Promise.all([
    db.plans.where('status').equals('draft').count(),
    db.plans.where('status').equals('published').count(),
    db.plans.where('status').equals('needs_review').count(),
  ]);
  return { draft, published, needs_review };
}

// ==================== 爬蟲相關函數 ====================

// 爬蟲任務
export async function getAllScraperJobs(): Promise<ScraperJob[]> {
  return db.scraperJobs.orderBy('createdAt').reverse().toArray();
}

export async function getScraperJobById(id: string): Promise<ScraperJob | undefined> {
  return db.scraperJobs.get(id);
}

export async function getScraperJobsByStatus(status: ScraperJob['status']): Promise<ScraperJob[]> {
  return db.scraperJobs.where('status').equals(status).toArray();
}

export async function createScraperJob(job: Omit<ScraperJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.scraperJobs.add({
    ...job,
    id,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateScraperJob(id: string, updates: Partial<Omit<ScraperJob, 'id' | 'createdAt'>>): Promise<void> {
  await db.scraperJobs.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deleteScraperJob(id: string): Promise<void> {
  await db.scraperJobs.delete(id);
}

export async function clearScraperJobs(): Promise<void> {
  await db.scraperJobs.clear();
}

// Alias for clearScraperJobs
export const clearAllScraperJobs = clearScraperJobs;

// 爬蟲批次
export async function getAllScraperBatches(): Promise<ScraperBatch[]> {
  return db.scraperBatches.orderBy('createdAt').reverse().toArray();
}

export async function createScraperBatch(batch: Omit<ScraperBatch, 'id' | 'createdAt'>): Promise<string> {
  const id = crypto.randomUUID();
  await db.scraperBatches.add({
    ...batch,
    id,
    createdAt: new Date(),
  });
  return id;
}

export async function updateScraperBatch(id: string, updates: Partial<Omit<ScraperBatch, 'id' | 'createdAt'>>): Promise<void> {
  await db.scraperBatches.update(id, updates);
}

export async function getScraperStats(): Promise<{
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  successJobs: number;
  failedJobs: number;
}> {
  const [total, pending, running, success, failed] = await Promise.all([
    db.scraperJobs.count(),
    db.scraperJobs.where('status').equals('pending').count(),
    db.scraperJobs.where('status').equals('running').count(),
    db.scraperJobs.where('status').equals('success').count(),
    db.scraperJobs.where('status').equals('failed').count(),
  ]);
  return {
    totalJobs: total,
    pendingJobs: pending,
    runningJobs: running,
    successJobs: success,
    failedJobs: failed,
  };
}
