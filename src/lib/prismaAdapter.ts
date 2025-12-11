/**
 * Prisma 與 TypeScript 類型適配器
 *
 * 用途：
 * - 轉換 Prisma 枚舉（大寫）到 TypeScript 類型（小寫）
 * - 轉換 TypeScript 類型到 Prisma 枚舉
 * - 確保兩個系統類型同步
 */

import type {
  PlanStatus as PrismaStatus,
  ShippingType as PrismaShippingType,
  StorageType as PrismaStorageType,
  VendorType as PrismaVendorType,
  ProductType as PrismaProductType,
  CuisineStyle as PrismaCuisineStyle,
  PriceLevel as PrismaPriceLevel,
  FamilySize as PrismaFamilySize,
  TaiwanRegion as PrismaTaiwanRegion,
  TaiwanCity as PrismaTaiwanCity,
  ReviewStatus as PrismaReviewStatus,
  ScraperJobStatus as PrismaScraperJobStatus,
} from '@prisma/client';

import type {
  PlanStatus,
  ShippingType,
  StorageType,
  VendorType,
  ProductType,
  CuisineStyle,
  PriceLevel,
  FamilySize,
  TaiwanRegion,
  TaiwanCity,
  ReviewDimension,
} from '@/types/index';

// ====== 狀態枚舉轉換 ======

export const planStatusMap: Record<PlanStatus, PrismaStatus> = {
  'draft': 'DRAFT',
  'needs_review': 'NEEDS_REVIEW',
  'published': 'PUBLISHED',
};

export const planStatusReverseMap: Record<PrismaStatus, PlanStatus> = {
  'DRAFT': 'draft',
  'NEEDS_REVIEW': 'needs_review',
  'PUBLISHED': 'published',
};

// ====== 配送類型轉換 ======

export const shippingTypeMap: Record<ShippingType, PrismaShippingType> = {
  'delivery': 'DELIVERY',
  'pickup': 'PICKUP',
  'both': 'BOTH',
};

export const shippingTypeReverseMap: Record<PrismaShippingType, ShippingType> = {
  'DELIVERY': 'delivery',
  'PICKUP': 'pickup',
  'BOTH': 'both',
};

// ====== 儲存類型轉換 ======

export const storageTypeMap: Record<StorageType, PrismaStorageType> = {
  'frozen': 'FROZEN',
  'chilled': 'CHILLED',
  'room_temp': 'ROOM_TEMP',
  'unknown': 'UNKNOWN',
};

export const storageTypeReverseMap: Record<PrismaStorageType, StorageType> = {
  'FROZEN': 'frozen',
  'CHILLED': 'chilled',
  'ROOM_TEMP': 'room_temp',
  'UNKNOWN': 'unknown',
};

// ====== 廠商類型轉換 ======

export const vendorTypeMap: Record<VendorType, PrismaVendorType> = {
  'hotel': 'HOTEL',
  'restaurant': 'RESTAURANT',
  'brand': 'BRAND',
  'convenience': 'CONVENIENCE',
  'hypermarket': 'HYPERMARKET',
  'vegetarian': 'VEGETARIAN',
  'other': 'OTHER',
};

export const vendorTypeReverseMap: Record<PrismaVendorType, VendorType> = {
  'HOTEL': 'hotel',
  'RESTAURANT': 'restaurant',
  'BRAND': 'brand',
  'CONVENIENCE': 'convenience',
  'HYPERMARKET': 'hypermarket',
  'VEGETARIAN': 'vegetarian',
  'OTHER': 'other',
};

// ====== 產品類型轉換 ======

export const productTypeMap: Record<ProductType, PrismaProductType> = {
  'set_meal': 'SET_MEAL',
  'single_dish': 'SINGLE_DISH',
  'dessert': 'DESSERT',
  'gift_box': 'GIFT_BOX',
  'soup': 'SOUP',
  'other': 'OTHER',
};

export const productTypeReverseMap: Record<PrismaProductType, ProductType> = {
  'SET_MEAL': 'set_meal',
  'SINGLE_DISH': 'single_dish',
  'DESSERT': 'dessert',
  'GIFT_BOX': 'gift_box',
  'SOUP': 'soup',
  'OTHER': 'other',
};

// ====== 料理風格轉換 ======

export const cuisineStyleMap: Record<CuisineStyle, PrismaCuisineStyle> = {
  'taiwanese': 'TAIWANESE',
  'cantonese': 'CANTONESE',
  'shanghainese': 'SHANGHAINESE',
  'szechuan': 'SZECHUAN',
  'japanese': 'JAPANESE',
  'vegetarian': 'VEGETARIAN',
  'fusion': 'FUSION',
  'western': 'WESTERN',
  'other': 'OTHER',
};

export const cuisineStyleReverseMap: Record<PrismaCuisineStyle, CuisineStyle> = {
  'TAIWANESE': 'taiwanese',
  'CANTONESE': 'cantonese',
  'SHANGHAINESE': 'shanghainese',
  'SZECHUAN': 'szechuan',
  'JAPANESE': 'japanese',
  'VEGETARIAN': 'vegetarian',
  'FUSION': 'fusion',
  'WESTERN': 'western',
  'OTHER': 'other',
};

// ====== 價格等級轉換 ======

export const priceLevelMap: Record<PriceLevel, PrismaPriceLevel> = {
  'budget': 'BUDGET',
  'mid_range': 'MID_RANGE',
  'premium': 'PREMIUM',
  'luxury': 'LUXURY',
};

export const priceLevelReverseMap: Record<PrismaPriceLevel, PriceLevel> = {
  'BUDGET': 'budget',
  'MID_RANGE': 'mid_range',
  'PREMIUM': 'premium',
  'LUXURY': 'luxury',
};

// ====== 家庭規模轉換 ======

export const familySizeMap: Record<FamilySize, PrismaFamilySize> = {
  'couple': 'COUPLE',
  'small': 'SMALL',
  'medium': 'MEDIUM',
  'large': 'LARGE',
};

export const familySizeReverseMap: Record<PrismaFamilySize, FamilySize> = {
  'COUPLE': 'couple',
  'SMALL': 'small',
  'MEDIUM': 'medium',
  'LARGE': 'large',
};

// ====== 台灣地區轉換 ======

export const taiwanRegionMap: Record<TaiwanRegion, PrismaTaiwanRegion> = {
  'north': 'NORTH',
  'central': 'CENTRAL',
  'south': 'SOUTH',
  'east': 'EAST',
  'islands': 'ISLANDS',
  'nationwide': 'NATIONWIDE',
};

export const taiwanRegionReverseMap: Record<PrismaTaiwanRegion, TaiwanRegion> = {
  'NORTH': 'north',
  'CENTRAL': 'central',
  'SOUTH': 'south',
  'EAST': 'east',
  'ISLANDS': 'islands',
  'NATIONWIDE': 'nationwide',
};

// ====== 台灣縣市轉換 ======

const cityMap: Record<string, PrismaTaiwanCity> = {
  '台北市': 'TAIPEI',
  '新北市': 'NEW_TAIPEI',
  '基隆市': 'TAIPEI', // 歸類到北部
  '桃園市': 'TAOYUAN',
  '新竹市': 'HSINCHU_CITY',
  '新竹縣': 'HSINCHU_COUNTY',
  '宜蘭縣': 'YILAN',
  '苗栗縣': 'MIAOLI',
  '台中市': 'TAICHUNG',
  '彰化縣': 'CHANGHUA',
  '南投縣': 'NANTOU',
  '雲林縣': 'YUNLIN',
  '嘉義市': 'CHIAYI_CITY',
  '嘉義縣': 'CHIAYI_COUNTY',
  '台南市': 'TAINAN',
  '高雄市': 'KAOHSIUNG',
  '屏東縣': 'PINGTUNG',
  '花蓮縣': 'HUALIEN',
  '台東縣': 'TAITUNG',
  '澎湖縣': 'PENGHU',
  '金門縣': 'KINMEN',
  '連江縣': 'LIENCHIANG',
};

const cityReverseMap: Record<PrismaTaiwanCity, TaiwanCity> = {
  'TAIPEI': '台北市',
  'NEW_TAIPEI': '新北市',
  'TAOYUAN': '桃園市',
  'HSINCHU_CITY': '新竹市',
  'HSINCHU_COUNTY': '新竹縣',
  'YILAN': '宜蘭縣',
  'MIAOLI': '苗栗縣',
  'TAICHUNG': '台中市',
  'CHANGHUA': '彰化縣',
  'NANTOU': '南投縣',
  'YUNLIN': '雲林縣',
  'CHIAYI_CITY': '嘉義市',
  'CHIAYI_COUNTY': '嘉義縣',
  'TAINAN': '台南市',
  'KAOHSIUNG': '高雄市',
  'PINGTUNG': '屏東縣',
  'HUALIEN': '花蓮縣',
  'TAITUNG': '台東縣',
  'PENGHU': '澎湖縣',
  'KINMEN': '金門縣',
  'LIENCHIANG': '連江縣',
};

export function taiwanCityToPrisma(city: TaiwanCity): PrismaTaiwanCity {
  return cityMap[city] as PrismaTaiwanCity;
}

export function taiwanCityFromPrisma(city: PrismaTaiwanCity): TaiwanCity {
  return cityReverseMap[city] as TaiwanCity;
}

// ====== 評價狀態轉換 ======

const reviewStatusMap: Record<string, PrismaReviewStatus> = {
  'pending': 'PENDING',
  'published': 'PUBLISHED',
  'rejected': 'REJECTED',
  'flagged': 'FLAGGED',
};

const reviewStatusReverseMap: Record<PrismaReviewStatus, string> = {
  'PENDING': 'pending',
  'PUBLISHED': 'published',
  'REJECTED': 'rejected',
  'FLAGGED': 'flagged',
};

export function reviewStatusToPrisma(status: string): PrismaReviewStatus {
  return reviewStatusMap[status] as PrismaReviewStatus;
}

export function reviewStatusFromPrisma(status: PrismaReviewStatus): string {
  return reviewStatusReverseMap[status];
}

// ====== 爬蟲狀態轉換 ======

export const scraperStatusMap: Record<string, PrismaScraperJobStatus> = {
  'pending': 'PENDING',
  'running': 'RUNNING',
  'success': 'SUCCESS',
  'failed': 'FAILED',
  'cancelled': 'CANCELLED',
};

export const scraperStatusReverseMap: Record<PrismaScraperJobStatus, string> = {
  'PENDING': 'pending',
  'RUNNING': 'running',
  'SUCCESS': 'success',
  'FAILED': 'failed',
  'CANCELLED': 'cancelled',
};

/**
 * 類型守衛函數
 */

export function isPlanStatus(value: string): value is PlanStatus {
  return ['draft', 'needs_review', 'published'].includes(value);
}

export function isShippingType(value: string): value is ShippingType {
  return ['delivery', 'pickup', 'both'].includes(value);
}

export function isStorageType(value: string): value is StorageType {
  return ['frozen', 'chilled', 'room_temp', 'unknown'].includes(value);
}

export function isVendorType(value: string): value is VendorType {
  return ['hotel', 'restaurant', 'brand', 'convenience', 'hypermarket', 'vegetarian', 'other'].includes(value);
}

export function isProductType(value: string): value is ProductType {
  return ['set_meal', 'single_dish', 'dessert', 'gift_box', 'soup', 'other'].includes(value);
}

export function isCuisineStyle(value: string): value is CuisineStyle {
  return ['taiwanese', 'cantonese', 'shanghainese', 'szechuan', 'japanese', 'vegetarian', 'fusion', 'western', 'other'].includes(value);
}

export function isPriceLevel(value: string): value is PriceLevel {
  return ['budget', 'mid_range', 'premium', 'luxury'].includes(value);
}

export function isFamilySize(value: string): value is FamilySize {
  return ['couple', 'small', 'medium', 'large'].includes(value);
}

export function isTaiwanRegion(value: string): value is TaiwanRegion {
  return ['north', 'central', 'south', 'east', 'islands', 'nationwide'].includes(value);
}

export function isTaiwanCity(value: string): value is TaiwanCity {
  return Object.keys(cityMap).includes(value);
}
