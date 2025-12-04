import Dexie, { type EntityTable } from 'dexie';
import type { Plan, Vendor, Extraction } from '@/types';

// 定義資料庫
const db = new Dexie('LunarNewYearMealsDB') as Dexie & {
  vendors: EntityTable<Vendor, 'id'>;
  plans: EntityTable<Plan, 'id'>;
  extractions: EntityTable<Extraction, 'id'>;
};

// 定義 schema
db.version(1).stores({
  vendors: 'id, name, createdAt, updatedAt',
  plans: 'id, vendorId, vendorName, title, priceDiscount, shippingType, storageType, servingsMin, servingsMax, orderDeadline, status, createdAt, updatedAt, *tags',
  extractions: 'id, planId, createdAt',
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

// 計數函數
export async function countPlansByStatus(): Promise<{ draft: number; published: number; needs_review: number }> {
  const [draft, published, needs_review] = await Promise.all([
    db.plans.where('status').equals('draft').count(),
    db.plans.where('status').equals('published').count(),
    db.plans.where('status').equals('needs_review').count(),
  ]);
  return { draft, published, needs_review };
}
