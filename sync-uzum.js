/**
 * ─────────────────────────────────────────────
 *  UZUM MARKET → SUPABASE SYNC SCRIPT
 *  Запуск: node sync-uzum.js
 *  Или автоматически через GitHub Actions
 * ─────────────────────────────────────────────
 */

const UZUM_TOKEN   = process.env.UZUM_TOKEN;    // из GitHub Secrets
const UZUM_SHOP_ID = process.env.UZUM_SHOP_ID;  // ID вашего магазина
const SB_URL       = process.env.SB_URL || 'https://dgyirginrefvjsbhhooi.supabase.co';
const SB_KEY       = process.env.SB_KEY;         // из GitHub Secrets

const UZUM_API = 'https://api-seller.uzum.uz/api/seller';

// ── 1. Получаем все товары из Узум ──────────────────────────
async function getUzumProducts() {
  let allProducts = [];
  let page = 0;
  const size = 100;

  console.log('📦 Получаем товары из Узум...');

  while (true) {
    const res = await fetch(`${UZUM_API}/product/list?page=${page}&size=${size}`, {
      headers: {
        'Authorization': UZUM_TOKEN,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      console.error('❌ Ошибка Узум API:', res.status, await res.text());
      break;
    }

    const data = await res.json();
    const items = data?.payload?.products || data?.products || data?.content || [];

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
    const res = await fetch(`${UZUM_API}/product/${productId}`, {
      headers: {
        'Authorization': UZUM_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.payload || data;
  } catch(e) {
    console.error(`  Ошибка деталей товара ${productId}:`, e.message);
    return null;
  }
}

// ── 3. Преобразуем формат Узум → формат нашей БД ────────────
function mapUzumToSupabase(uzumProduct, details) {
  const p = details || uzumProduct;

  // Фотографии
  const images = [];
  if (p.photos?.length) {
    p.photos.forEach(photo => {
      const url = photo.url || photo.photoUrl || photo;
      if (url) images.push(url);
    });
  } else if (p.photo) {
    images.push(p.photo);
  }

  // Размеры
  const sizes = [];
  if (p.skuList?.length) {
    p.skuList.forEach(sku => {
      if (sku.characteristics) {
        sku.characteristics.forEach(ch => {
          if (ch.title?.toLowerCase().includes('размер') ||
              ch.title?.toLowerCase().includes('size') ||
              ch.title?.toLowerCase() === 'razmer') {
            if (ch.value && !sizes.includes(ch.value)) {
              sizes.push(ch.value);
            }
          }
        });
      }
    });
  }

  // Цвета
  const colors = [];
  if (p.skuList?.length) {
    p.skuList.forEach(sku => {
      if (sku.characteristics) {
        sku.characteristics.forEach(ch => {
          if (ch.title?.toLowerCase().includes('цвет') ||
              ch.title?.toLowerCase().includes('color') ||
              ch.title?.toLowerCase() === 'rang') {
            if (ch.value && !colors.includes(ch.value)) {
              colors.push(ch.value);
            }
          }
        });
      }
    });
  }

  // Цена (в тийинах → сумы)
  const price    = Math.round((p.sellPrice || p.minSellPrice || p.price || 0) / 100);
  const oldPrice = p.fullPrice ? Math.round(p.fullPrice / 100) : null;

  // Категория
  const categoryMap = {
    'Обувь': 'shoes', 'Кроссовки': 'shoes', 'Кеды': 'shoes',
    'Одежда': 'clothing', 'Футболки': 'clothing', 'Шорты': 'clothing',
    'Куртки': 'clothing', 'Худи': 'clothing',
    'Бег': 'running', 'Беговые': 'running',
    'Тренировка': 'training', 'Фитнес': 'training',
    'Аксессуары': 'accessories',
  };

  const categoryName = p.category?.title || p.categoryName || '';
  let category = 'shoes'; // по умолчанию
  for (const [key, val] of Object.entries(categoryMap)) {
    if (categoryName.includes(key)) { category = val; break; }
  }

  return {
    article:     p.skuCode || p.article || String(p.id),
    name:        p.title || p.name || 'Товар Li-Ning',
    description: p.description || p.longDescription || null,
    category,
    brand:       p.brand || 'Li Ning',
    price,
    old_price:   oldPrice && oldPrice > price ? oldPrice : null,
    sizes:       sizes.length > 0 ? sizes : null,
    colors:      colors.length > 0 ? colors : null,
    images:      images.length > 0 ? images : null,
    badge:       oldPrice && oldPrice > price ? 'SALE' : null,
    is_active:   true,
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
      const mapped = mapUzumToSupabase(item, details);
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
