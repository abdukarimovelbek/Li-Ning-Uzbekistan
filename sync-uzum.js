/**
 * ─────────────────────────────────────────────
 *  UZUM MARKET → SUPABASE SYNC SCRIPT
 *  Запуск: node sync-uzum.js
 *  Или автоматически через GitHub Actions
 * ─────────────────────────────────────────────
 */

const UZUM_TOKEN   = process.env.UZUM_TOKEN;    // из GitHub Secrets
console.log('Token length:', UZUM_TOKEN?.length || 0);
console.log('Token start:', UZUM_TOKEN?.substring(0, 5) || 'EMPTY');
const UZUM_SHOP_ID = process.env.UZUM_SHOP_ID;  // ID вашего магазина
const SB_URL       = process.env.SB_URL || 'https://dgyirginrefvjsbhhooi.supabase.co';
const SB_KEY       = process.env.SB_KEY;         // из GitHub Secrets

const UZUM_API = 'https://api-seller.uzum.uz/api/seller-openapi';

// ── 1. Получаем все товары из Узум ──────────────────────────
async function getUzumProducts() {
  let allProducts = [];
  let page = 0;
  const size = 100;

  console.log('📦 Получаем товары из Узум...');

  while (true) {
    const res = await fetch(`${UZUM_API}/v1/product/shop/${UZUM_SHOP_ID}?page=${page}&size=${size}&filter=ALL&order=ASC&sortBy=DEFAULT&productRank=A`, {
      headers: {
        'Authorization': UZUM_TOKEN,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Language': 'ru-RU',
      }
    });

    if (!res.ok) {
      console.error('❌ Ошибка Узум API:', res.status, await res.text());
      break;
    }

    const data = await res.json();
    console.log('Узум ответ:', JSON.stringify(data).substring(0, 500));
    const items = data?.productList || data?.payload?.products || data?.products || data?.content || [];
    if (items.length > 0) {
      console.log('ПЕРВЫЙ ТОВАР ПОЛНЫЙ:', JSON.stringify(items[0]).substring(0, 1500));
    }
    if (items.length === 0) break;

    allProducts = allProducts.concat(items);
    console.log(`  Загружено: ${allProducts.length} товаров...`);

    // Если получили меньше чем size — это последняя страница
    if (items.length < size) break;
    page++;
  }

  console.log(`✅ Всего из Узум: ${allProducts.length} товаров`);
  return allProducts;
}

// ── 2. Получаем детали одного товара (фото, размеры, цвета) ─
async function getProductDetails(productId) {
  try {
    const res = await fetch(`${UZUM_API}/v1/product/${productId}`, {
      headers: { 
        'Authorization': UZUM_TOKEN,
        'Accept-Language': 'ru-RU',
      }
    });
    if (!res.ok) {
      console.log(`  Детали ${productId}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (productId === 1530792) {
      console.log('ДЕТАЛИ:', JSON.stringify(data).substring(0, 800));
    }
    return data?.payload || data;
  } catch(e) { 
    console.log(`  Ошибка деталей:`, e.message);
    return null; 
  }
}

// ── 3. Преобразуем формат Узум → формат нашей БД ────────────
function mapUzumToSupabase(uzumProduct) {
  const p = uzumProduct;

  // Фото — берём из previewImage каждого SKU
  const images = [];
  if (p.skuList?.length) {
    p.skuList.forEach(sku => {
      if (sku.previewImage && !images.includes(sku.previewImage)) {
        const imgUrl = sku.previewImage?.startsWith('http') 
        ? `${sku.previewImage}/original.jpg`
        : `https://images.uzum.uz/${sku.previewImage}/original.jpg`;
      if (!images.includes(imgUrl)) images.push(imgUrl);
      }
    });
  }

  // Размеры и цвета из characteristics ("10, Бирюзовый")
  const sizes = [];
  const colors = [];
  if (p.skuList?.length) {
    p.skuList.forEach(sku => {
      const chars = sku.characteristics || '';
      const parts = chars.split(',').map(s => s.trim());
      if (parts[0] && !sizes.includes(parts[0])) sizes.push(parts[0]);
      if (parts[1] && !colors.includes(parts[1])) colors.push(parts[1]);
    });
  }

  // Цена — делим на 100 (тийины → сумы)
  const prices = p.skuList?.map(s => s.price).filter(Boolean) || [];
  const price = prices.length > 0 ? Math.round(Math.min(...prices)) : 0;
  const maxPrice = prices.length > 0 ? Math.round(Math.max(...prices)) : 0;
  const oldPrice = maxPrice > price ? maxPrice : null;

  // Артикул из skuFullTitle: "LINING1-ABFT027-БИРЮЗ-10" → берём часть
  const skuFull = p.skuList?.[0]?.skuFullTitle || '';
  const parts = skuFull.split('-');
  const article = parts.length >= 2 ? parts[1] : String(p.productId);

  // Название — берём из первого SKU
  const name = p.skuList?.[0]?.productTitle || p.title || 'Товар Li-Ning';

  // Категория
  const categoryMap = {
    'Кроссовки': 'shoes', 'Обувь': 'shoes', 'Кеды': 'shoes', 'Шлепанцы': 'shoes',
    'Футболка': 'clothing', 'Штаны': 'clothing', 'Шорты': 'clothing',
    'Брюки': 'clothing', 'Лонгслив': 'clothing', 'Поло': 'clothing',
    'Сумка': 'accessories', 'Рюкзак': 'accessories', 'Бейсболка': 'accessories',
  };
  let category = 'shoes';
  for (const [key, val] of Object.entries(categoryMap)) {
    if ((p.category || '').includes(key) || name.includes(key)) {
      category = val; break;
    }
  }

  // Определяем пол по названию
  let gender = 'uni';
  const nameLower = name.toLowerCase();
  if (nameLower.includes('мужск') || nameLower.includes('erkak') || nameLower.includes('мужчин')) {
    gender = 'male';
  } else if (nameLower.includes('женск') || nameLower.includes('ayol') || nameLower.includes('женщин') || nameLower.includes('болалар') || nameLower.includes('детск')) {
    gender = 'female';
  }

  return {
    article,
    name,
    description: null,
    category,
    gender,
    brand: 'Li Ning',
    price,
    old_price: oldPrice,
    sizes: sizes.length > 0 ? sizes : null,
    colors: colors.length > 0 ? colors : null,
    images: images.length > 0 ? images : null,
    badge: oldPrice ? 'SALE' : null,
    is_active: true,
  };
}

// ── 4. Сохраняем в Supabase (upsert по артикулу) ────────────
async function upsertToSupabase(products) {
  console.log(`\n💾 Сохраняем ${products.length} товаров в Supabase...`);

  const chunkSize = 50;
  let saved = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);

    const res = await fetch(`${SB_URL}/rest/v1/products`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(chunk)
    });

    if (res.ok) {
      saved += chunk.length;
      console.log(`  ✅ Сохранено: ${saved}/${products.length}`);
    } else {
      const err = await res.text();
      console.error(`  ❌ Ошибка сохранения чанка ${i}:`, err);
      errors += chunk.length;
    }
  }

  return { saved, errors };
}

// ── 5. MAIN ──────────────────────────────────────────────────
async function main() {
  console.log('🚀 Запуск синхронизации Узум → Supabase');
  console.log('━'.repeat(50));

  if (!UZUM_TOKEN) { console.error('❌ UZUM_TOKEN не задан!'); process.exit(1); }
  if (!SB_KEY)     { console.error('❌ SB_KEY не задан!');    process.exit(1); }

  try {
    // Получаем список товаров
    const uzumList = await getUzumProducts();
    if (uzumList.length === 0) {
      console.log('⚠️  Товары не найдены в Узум');
      return;
    }

    // Получаем детали каждого товара (фото, размеры, цвета)
    console.log('\n🔍 Получаем детали товаров...');
    const detailedProducts = [];

    for (let i = 0; i < uzumList.length; i++) {
      const item = uzumList[i];
      const productId = item.id || item.productId;

      process.stdout.write(`  ${i + 1}/${uzumList.length} - ${item.title || item.name}... `);

      const details = await getProductDetails(productId);
      const mapped = mapUzumToSupabase(item);
      detailedProducts.push(mapped);

      console.log(`✓ (${mapped.images?.length || 0} фото, ${mapped.sizes?.length || 0} размеров)`);

      // Задержка чтобы не превысить лимит запросов
      await new Promise(r => setTimeout(r, 300));
    }

    // Сохраняем в Supabase
    const result = await upsertToSupabase(detailedProducts);

    console.log('\n' + '━'.repeat(50));
    console.log('📊 РЕЗУЛЬТАТ СИНХРОНИЗАЦИИ:');
    console.log(`  ✅ Сохранено: ${result.saved} товаров`);
    console.log(`  ❌ Ошибок:   ${result.errors}`);
    console.log('━'.repeat(50));

  } catch(e) {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
  }
}

main();
