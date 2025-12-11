/**
 * Prisma 種子腳本
 *
 * 用途：
 * - 初始化開發數據庫
 * - 創建測試數據
 * - 演示數據結構
 *
 * 運行：
 * npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 開始為數據庫種子...');

  try {
    // 清除現有數據
    console.log('清除現有數據...');
    await prisma.review.deleteMany({});
    await prisma.shoppingListItem.deleteMany({});
    await prisma.shoppingList.deleteMany({});
    await prisma.pickupPoint.deleteMany({});
    await prisma.extraction.deleteMany({});
    await prisma.plan.deleteMany({});
    await prisma.vendor.deleteMany({});

    // 創建廠商
    console.log('建立廠商...');
    const vendor1 = await prisma.vendor.create({
      data: {
        name: '台北寒舍艾美酒店',
        website: 'https://taipei.leshermes-taipei.com',
        phone: '(02) 6655-0000',
      },
    });

    const vendor2 = await prisma.vendor.create({
      data: {
        name: '頂鮮101餐飲',
        website: 'https://www.top-fresh.com.tw',
        phone: '(02) 8101-2000',
      },
    });

    const vendor3 = await prisma.vendor.create({
      data: {
        name: '美威鮭魚',
        website: 'https://www.mowi.com.tw',
        phone: '(02) 2508-0000',
      },
    });

    // 創建計劃
    console.log('建立年菜計劃...');
    const plan1 = await prisma.plan.create({
      data: {
        vendorId: vendor1.id,
        vendorName: vendor1.name,
        title: '2024 寒舍艾美尾牙年菜套餐',
        description:
          '精選頂級食材，由米其林星級主廚親自設計的新年大菜。包含佛跳牆、紅燒蹄膀、烏魚子等經典年菜。',
        priceOriginal: 12800,
        priceDiscount: 11800,
        shippingFee: 300,
        shippingType: 'DELIVERY',
        storageType: 'CHILLED',
        servingsMin: 8,
        servingsMax: 10,
        region: 'NORTH',
        city: 'TAIPEI',
        address: '台北市信義區松壽路 20 號',
        tags: ['飯店級', '米其林', '海鮮', '高級'],
        dishes: ['佛跳牆', '紅燒蹄膀', '烏魚子', '扣肉', '蒸鮑魚'],
        vendorType: 'HOTEL',
        productType: 'SET_MEAL',
        cuisineStyle: 'TAIWANESE',
        priceLevel: 'LUXURY',
        familySize: 'LARGE',
        status: 'PUBLISHED',
        orderDeadline: '2024-01-20',
        fulfillStart: '2024-01-26',
        fulfillEnd: '2024-01-29',
      },
    });

    const plan2 = await prisma.plan.create({
      data: {
        vendorId: vendor2.id,
        vendorName: vendor2.name,
        title: '頂鮮 101 年菜禮盒',
        description: '新鮮海鮮、自製醬料，適合送禮。可冷凍保存，隨時享用。',
        priceOriginal: 3980,
        priceDiscount: 3480,
        shippingFee: 100,
        shippingType: 'BOTH',
        storageType: 'FROZEN',
        servingsMin: 3,
        servingsMax: 4,
        region: 'NATIONWIDE',
        tags: ['禮盒', '海鮮', '平價'],
        dishes: ['干貝', '蝦仁', '魷魚', '螺肉'],
        vendorType: 'BRAND',
        productType: 'GIFT_BOX',
        cuisineStyle: 'TAIWANESE',
        priceLevel: 'MID_RANGE',
        familySize: 'SMALL',
        status: 'PUBLISHED',
        orderDeadline: '2024-01-22',
      },
    });

    const plan3 = await prisma.plan.create({
      data: {
        vendorId: vendor3.id,
        vendorName: vendor3.name,
        title: '美威鮭魚年菜組合',
        description: '高級挪威鮭魚配日式美食，結合東西方精緻餐飲。',
        priceOriginal: 4980,
        priceDiscount: 4280,
        shippingFee: 200,
        shippingType: 'DELIVERY',
        storageType: 'FROZEN',
        servingsMin: 4,
        servingsMax: 6,
        region: 'NORTH',
        tags: ['海鮮', '高級', '健康'],
        dishes: ['鮭魚排', '魚卵', '海膽', '干貝'],
        vendorType: 'BRAND',
        productType: 'SET_MEAL',
        cuisineStyle: 'JAPANESE',
        priceLevel: 'PREMIUM',
        familySize: 'MEDIUM',
        status: 'PUBLISHED',
        orderDeadline: '2024-01-25',
      },
    });

    // 添加取貨點
    console.log('添加取貨點...');
    await prisma.pickupPoint.create({
      data: {
        planId: plan1.id,
        name: '台北101',
        address: '台北市信義區信義路五段 7 號',
        phone: '(02) 8101-8101',
        latitude: 25.0338,
        longitude: 121.5645,
      },
    });

    // 創建評價
    console.log('建立用戶評價...');
    const review1 = await prisma.review.create({
      data: {
        planId: plan1.id,
        userId: 'user_hash_001',
        userName: '美食家小李',
        rating: 5,
        title: '絕對值得！',
        content: '食材新鮮，料理精緻，家人都讚不絕口。下年繼續訂購！',
        status: 'PUBLISHED',
      },
    });

    const review2 = await prisma.review.create({
      data: {
        planId: plan2.id,
        userId: 'user_hash_002',
        userName: '健身愛好者',
        rating: 4,
        title: '新鮮美味',
        content: '海鮮很新鮮，但運費有點貴。整體還是不錯的選擇。',
        status: 'PUBLISHED',
      },
    });

    // 創建購物清單
    console.log('建立購物清單...');
    const shoppingList = await prisma.shoppingList.create({
      data: {
        name: '2024 農曆新年年菜購物清單',
        description: '為家人精心挑選的新年大菜',
        isShared: false,
      },
    });

    await prisma.shoppingListItem.create({
      data: {
        listId: shoppingList.id,
        planId: plan1.id,
        quantity: 1,
        notes: '2024/1/28 交貨',
      },
    });

    await prisma.shoppingListItem.create({
      data: {
        listId: shoppingList.id,
        planId: plan2.id,
        quantity: 2,
        notes: '作為備用菜品',
      },
    });

    console.log('\n✅ 種子數據建立成功！');
    console.log('\n📊 建立的數據：');
    console.log(`  - ${3} 家廠商`);
    console.log(`  - ${3} 個年菜計劃`);
    console.log(`  - ${2} 個評價`);
    console.log(`  - ${1} 個購物清單`);
    console.log(`  - ${2} 個清單項目`);
    console.log(`\n提示：運行 'npx prisma studio' 查看數據`);
  } catch (error) {
    console.error('❌ 種子數據建立失敗：', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
