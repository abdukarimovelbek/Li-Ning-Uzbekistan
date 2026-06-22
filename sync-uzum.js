/**
 * ─────────────────────────────────────────────
 *  UZUM MARKET → SUPABASE SYNC SCRIPT
 *  Запуск: node sync-uzum.js
 *  Или автоматически через GitHub Actions
 * ─────────────────────────────────────────────
 */

const UZUM_TOKEN   = process.env.UZUM_TOKEN;
console.log('Token length:', UZUM_TOKEN?.length || 0);
console.log('Token start:', UZUM_TOKEN?.substring(0, 5) || 'EMPTY');
const UZUM_SHOP_ID = process.env.UZUM_SHOP_ID;
const SB_URL       = process.env.SB_URL || 'https://dgyirginrefvjsbhhooi.supabase.co';
const SB_KEY       = process.env.SB_KEY;

const UZUM_API = 'https://api-seller.uzum.uz/api/seller-openapi';

// ── 1. Получаем все товары из Узум (все статусы) ────────────
async function getUzumProducts() {
  // Uzum разбивает товары по фильтрам-статусам
  // filter=ALL даёт только IN_STOCK (~69 шт)
  // Перебираем все возможные фильтры чтобы получить все товары
  const FILTERS = ['IN_STOCK', 'ACTIVE', 'INACTIVE', 'ARCHIVED', 'MODERATION', 'BLOCKED'];

  const seenIds = new Set();      // защита от дублей между фильтрами
  let allProducts = [];
  const size = 24;

  console.log('📦 Получаем товары из Узум (все статусы)...');

  for (const filter of FILTERS) {
    console.log(`\n  🔍 Фильтр: ${filter}`);
    let page = 0;
    let filterCount = 0;

    while (true) {
      const res = await fetch(
        `${UZUM_API}/v1/product/shop/${UZUM_SHOP_ID}?page=${page}&size=${size}&filter=${filter}&order=ASC&sortBy=DEFAULT&productRank=A`,
        {
          headers: {
            'Authorization': UZUM_TOKEN,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Language': 'ru-RU',
          }
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.log(`    ⚠️  Фильтр ${filter} стр.${page}: ${res.status} — пропускаем`);
        break;
      }

      const data = await res.json();
      const items = data?.productList || data?.payload?.products || data?.products || data?.content || [];

      if (items.length === 0) break;

      // Добавляем только новые (по productId) чтобы не дублировать между фильтрами
      let addedThisPage = 0;
      for (const item of items) {
        const id = item.productId || item.id;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          allProducts.push(item);
          addedThisPage++;
        }
      }

      filterCount += addedThisPage;
      console.log(`    Стр.${page + 1}: +${addedThisPage} новых (всего по фильтру: ${filterCount}, итого: ${allProducts.length})`);

      page++;
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`  ✅ Фильтр ${filter}: итого ${filterCount} товаров`);
  }

  console.log(`\n✅ Всего уникальных товаров из Узум: ${allProducts.length}`);
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
    if (productId === 5032478) {
      console.log('ДЕТАЛИ:', JSON.stringify(data).substring(0, 800));
    }
    return data?.payload || data;
  } catch(e) { 
    console.log(`  Ошибка деталей:`, e.message);
    return null; 
  }
}

// ── 3. Преобразуем формат Узум → формат нашей БД ────────────
function mapUzumToSupabase(uzumProduct, details) {
  const p = uzumProduct;

  // Галерея из детальной страницы Узума — первые 3 фото
  const images = [];
  const photoSrc = details?.photos || details?.images || details?.media ||
                   details?.photoList || details?.skuImageUrlList || [];
  if (Array.isArray(photoSrc)) {
    for (const photo of photoSrc.slice(0, 3)) {
      const raw = typeof photo === 'string' ? photo
                : (photo?.url || photo?.src || photo?.previewImage || '');
      if (!raw) continue;
      const full = raw.startsWith('http')
        ? `${raw}/original.jpg`
        : `https://images.uzum.uz/${raw}/original.jpg`;
      images.push(full);
    }
  }
  // Fallback — если детали не дали фото, берём из skuList
  if (images.length === 0 && p.skuList?.length) {
    for (const sku of p.skuList) {
      if (images.length >= 3) break;
      if (!sku.previewImage) continue;
      const full = sku.previewImage.startsWith('http')
        ? `${sku.previewImage}/original.jpg`
        : `https://images.uzum.uz/${sku.previewImage}/original.jpg`;
      if (!images.includes(full)) images.push(full);
    }
  }

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

  const price = 0;
  const oldPrice = null;

  const skuFull = p.skuList?.[0]?.skuFullTitle || '';
  const parts = skuFull.split('-');
  const article   = parts.length >= 2 ? parts[1] : String(p.productId);
  const colorCode = parts.length >= 3 ? `${parts[1]}-${parts[2]}` : article;
  const colorName = (() => {
    for (const sku of (p.skuList || [])) {
      const c = (sku.characteristics || '').split(',').map(s => s.trim())[1];
      if (c) return c;
    }
    return null;
  })();

  const name = p.skuList?.[0]?.productTitle || p.title || 'Товар Li-Ning';

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

  let gender = 'uni';
  const nameLower = name.toLowerCase();
  if (nameLower.includes('мужск') || nameLower.includes('erkak') || nameLower.includes('мужчин')) {
    gender = 'male';
  } else if (nameLower.includes('женск') || nameLower.includes('ayol') || nameLower.includes('женщин') || nameLower.includes('болалар') || nameLower.includes('детск')) {
    gender = 'female';
  }

  return {
    article,
    _colorCode: colorCode,   // временные поля с _ — не пишутся в базу напрямую
    _colorName: colorName,
    name,
    description: p.description || p.fullDescription || p.skuList?.[0]?.description || null,
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

// ── 4. Получаем все article которые уже есть в Supabase ─────
async function getExistingArticles() {
  console.log('\n🔎 Проверяем какие article уже есть в базе...');
  const existing = new Set();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const res = await fetch(
      `${SB_URL}/rest/v1/products?select=article&limit=${pageSize}&offset=${from}`,
      {
        headers: {
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
        }
      }
    );

    if (!res.ok) {
      console.error('❌ Ошибка получения article из Supabase:', await res.text());
      break;
    }

    const rows = await res.json();
    rows.forEach(r => existing.add(r.article));

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  console.log(`✅ В базе уже есть: ${existing.size} уникальных article`);
  return existing;
}

// ── 5. Сохраняем в Supabase — только НОВЫЕ товары ───────────
async function saveToSupabase(products) {
  console.log(`\n💾 Upsert ${products.length} товаров в Supabase...`);
  const chunkSize = 50;
  let saved = 0, errors = 0;

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
      console.log(`  ✅ Upsert: ${saved}/${products.length}`);
    } else {
      console.error(`  ❌ Ошибка чанка ${i}:`, await res.text());
      errors += chunk.length;
    }
  }
  return { saved, skipped: 0, errors };

// Функцию getExistingArticles() можно удалить — она больше не нужна

    if (res.ok) {
      saved += chunk.length;
      console.log(`  ✅ Сохранено: ${saved}/${newProducts.length}`);
    } else {
      const err = await res.text();
      console.error(`  ❌ Ошибка сохранения чанка ${i}:`, err);
      errors += chunk.length;
    }
  

  return { saved, skipped: skipped.length, errors };
}

// ── 6. MAIN ──────────────────────────────────────────────────
async function main() {
  console.log('🚀 Запуск синхронизации Узум → Supabase');
  console.log('━'.repeat(50));

  if (!UZUM_TOKEN) { console.error('❌ UZUM_TOKEN не задан!'); process.exit(1); }
  if (!SB_KEY)     { console.error('❌ SB_KEY не задан!');    process.exit(1); }

  try {
    const uzumList = await getUzumProducts();
    if (uzumList.length === 0) {
      console.log('⚠️  Товары не найдены в Узум');
      return;
    }

    console.log('\n🔍 Получаем детали товаров...');
    const detailedProducts = [];

    for (let i = 0; i < uzumList.length; i++) {
      const item = uzumList[i];
      const productId = item.id || item.productId;
      process.stdout.write(`  ${i + 1}/${uzumList.length} - ${item.title || item.name}... `);
      const details = await getProductDetails(productId);
      const mapped = mapUzumToSupabase(item, details);   // ← передаём details
      detailedProducts.push(mapped);
      console.log(`✓ (${mapped.images?.length || 0} фото, цвет: ${mapped._colorName || mapped._colorCode || '?'})`);
      await new Promise(r => setTimeout(r, 300));
    }

    // Группируем: ARMT015-20 + ARMT015-25 + ARMT015-4 → один товар ARMT015
    console.log('\n🎨 Группируем варианты по артикулу...');
    const groupMap = {};
    for (const mapped of detailedProducts) {
      const base = mapped.article;
      if (!groupMap[base]) {
        const { _colorCode, _colorName, ...rest } = mapped;
        groupMap[base] = { ...rest, variants: [], colors: [] };
      }
      groupMap[base].variants.push({
        color:  mapped._colorName || mapped._colorCode,
        code:   mapped._colorCode,
        images: mapped.images || []
      });
      if (mapped._colorName && !groupMap[base].colors.includes(mapped._colorName)) {
        groupMap[base].colors.push(mapped._colorName);
      }
      // Мержим размеры всех цветов
      groupMap[base].sizes = [...new Set([...(groupMap[base].sizes || []), ...(mapped.sizes || [])])];
      // Главные фото = фото первого варианта
      if (!groupMap[base].images?.length) groupMap[base].images = mapped.images;
    }
    const groupedProducts = Object.values(groupMap);
    console.log(`✅ ${detailedProducts.length} записей → ${groupedProducts.length} товаров`);

    const result = await saveToSupabase(groupedProducts);   // ← новое название

    console.log('\n' + '━'.repeat(50));
    console.log('📊 РЕЗУЛЬТАТ СИНХРОНИЗАЦИИ:');
    console.log(`  ✅ Добавлено новых: ${result.saved} товаров`);
    console.log(`  ⏭️  Пропущено дублей: ${result.skipped} товаров`);
    console.log(`  ❌ Ошибок:          ${result.errors}`);
    console.log('━'.repeat(50));

  } catch(e) {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
  }
}

main();