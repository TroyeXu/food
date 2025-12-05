// 年菜比較系統資料模型

export type PlanStatus = 'draft' | 'published' | 'needs_review';
export type ShippingType = 'delivery' | 'pickup' | 'both';
export type StorageType = 'frozen' | 'chilled' | 'room_temp' | 'unknown';
export type FieldSource = 'dom' | 'api' | 'ocr' | 'manual';

// 台灣地區
export type TaiwanRegion =
  | 'north' // 北部：台北、新北、基隆、桃園、新竹、宜蘭
  | 'central' // 中部：苗栗、台中、彰化、南投、雲林
  | 'south' // 南部：嘉義、台南、高雄、屏東
  | 'east' // 東部：花蓮、台東
  | 'islands' // 離島：澎湖、金門、馬祖
  | 'nationwide'; // 全台

// 台灣縣市
export type TaiwanCity =
  | '台北市' | '新北市' | '基隆市' | '桃園市' | '新竹市' | '新竹縣' | '宜蘭縣'
  | '苗栗縣' | '台中市' | '彰化縣' | '南投縣' | '雲林縣'
  | '嘉義市' | '嘉義縣' | '台南市' | '高雄市' | '屏東縣'
  | '花蓮縣' | '台東縣'
  | '澎湖縣' | '金門縣' | '連江縣';

// 地區對應縣市
export const REGION_CITIES: Record<TaiwanRegion, TaiwanCity[]> = {
  north: ['台北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '宜蘭縣'],
  central: ['苗栗縣', '台中市', '彰化縣', '南投縣', '雲林縣'],
  south: ['嘉義市', '嘉義縣', '台南市', '高雄市', '屏東縣'],
  east: ['花蓮縣', '台東縣'],
  islands: ['澎湖縣', '金門縣', '連江縣'],
  nationwide: [],
};

export const REGION_LABELS: Record<TaiwanRegion, string> = {
  north: '北部',
  central: '中部',
  south: '南部',
  east: '東部',
  islands: '離島',
  nationwide: '全台配送',
};

// 縣市對應行政區（主要都會區）
export const CITY_DISTRICTS: Partial<Record<TaiwanCity, string[]>> = {
  '台北市': ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'],
  '新北市': ['板橋區', '三重區', '中和區', '永和區', '新莊區', '新店區', '土城區', '蘆洲區', '樹林區', '汐止區', '鶯歌區', '三峽區', '淡水區', '林口區'],
  '桃園市': ['桃園區', '中壢區', '平鎮區', '八德區', '楊梅區', '蘆竹區', '龜山區', '龍潭區', '大溪區'],
  '台中市': ['中區', '東區', '南區', '西區', '北區', '北屯區', '西屯區', '南屯區', '太平區', '大里區', '霧峰區', '烏日區', '豐原區', '大雅區'],
  '台南市': ['中西區', '東區', '南區', '北區', '安平區', '安南區', '永康區', '新營區', '仁德區', '歸仁區'],
  '高雄市': ['楠梓區', '左營區', '鼓山區', '三民區', '鹽埕區', '前金區', '新興區', '苓雅區', '前鎮區', '小港區', '鳳山區', '大寮區', '岡山區'],
};

// 取貨點
export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  city?: TaiwanCity;
  lat?: number;
  lng?: number;
  phone?: string;
  notes?: string;
  availableDates?: string[]; // ISO date strings
}

// 欄位信心度
export interface FieldConfidence {
  value: unknown;
  source: FieldSource;
  confidence: number; // 0-1
}

// 廠商/餐廳
export interface Vendor {
  id: string;
  name: string;
  website?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 年菜方案（核心）
export interface Plan {
  id: string;
  vendorId: string;
  vendorName: string; // 冗餘存儲方便顯示

  // 基本資訊
  title: string;
  description?: string;
  imageUrl?: string;
  images?: string[];

  // 價格
  priceOriginal?: number;
  priceDiscount: number;
  shippingFee?: number;

  // 配送
  shippingType: ShippingType;
  storageType: StorageType;
  pickupPoints?: PickupPoint[];
  deliveryAreas?: string[]; // 可配送區域

  // 地點
  region?: TaiwanRegion; // 地區（北/中/南/東/離島/全台）
  city?: TaiwanCity; // 縣市（餐廳/取貨點所在地）
  address?: string; // 詳細地址

  // 份量
  servingsMin: number;
  servingsMax?: number;

  // 日期
  orderDeadline?: string; // ISO date
  fulfillStart?: string; // 到貨/取貨開始日 ISO date
  fulfillEnd?: string; // 到貨/取貨結束日 ISO date
  canSelectDate?: boolean; // 是否可指定到貨日

  // 內容
  tags: string[]; // 標籤：台式、粵式、海鮮、蔬食等
  dishes: string[]; // 菜色列表
  allergens?: string[]; // 過敏原

  // 來源
  sourceUrl?: string;

  // 狀態
  status: PlanStatus;

  // 欄位信心度（可選，用於追蹤抽取品質）
  fieldConfidence?: Record<string, FieldConfidence>;

  // 時間戳
  createdAt: Date;
  updatedAt: Date;
}

// 抽取紀錄（用於追溯）
export interface Extraction {
  id: string;
  planId: string;
  rawText?: string;
  ocrText?: string;
  images?: string[];
  parsedFields?: Record<string, unknown>;
  confidenceByField?: Record<string, number>;
  createdAt: Date;
}

// 篩選條件
export interface FilterState {
  priceMin?: number;
  priceMax?: number;
  pricePerPersonMax?: number; // 每人價格上限
  servingsMin?: number;
  servingsMax?: number;
  shippingType?: ShippingType | 'all';
  shippingTypes?: ShippingType[]; // 多選
  storageType?: StorageType | 'all';
  storageTypes?: StorageType[]; // 多選
  targetDate?: string; // 用餐日期
  mustBeBeforeDeadline?: boolean;
  canSelectDate?: boolean;
  tags?: string[];
  tagLogic?: 'AND' | 'OR'; // 標籤邏輯：AND 同時包含 / OR 包含任一
  searchQuery?: string;
  onlyPublished?: boolean;
  region?: TaiwanRegion | 'all'; // 地區篩選
  city?: TaiwanCity | 'all'; // 縣市篩選
  district?: string | 'all'; // 行政區篩選
  showFavoritesOnly?: boolean; // 只顯示收藏
  showHistoryOnly?: boolean; // 只顯示最近瀏覽
  excludeKeywords?: string[]; // 排除關鍵字（不吃牛、不吃海鮮等）
  mapBounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

// 排序選項
export type SortOption =
  | 'price_asc'
  | 'price_desc'
  | 'price_per_person_asc'
  | 'servings_asc'
  | 'servings_desc'
  | 'deadline_asc'
  | 'fulfill_asc'
  | 'updated_desc'
  | 'vendor_asc'
  | 'distance_asc'
  | 'relevance';

// 用戶位置
export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

// 視圖模式
export type ViewMode = 'list' | 'grid' | 'map' | 'split';
export type EditMode = 'browse' | 'edit';

// 比對盤狀態
export interface ComparisonState {
  selectedPlanIds: string[];
  isDrawerOpen: boolean;
  isCompareModalOpen: boolean;
}
