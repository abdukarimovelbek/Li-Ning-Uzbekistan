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
      let res;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          res = await fetch(
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
          break; // успех — выходим из retry loop
        } catch (err) {
          console.log(`    ⚠️  Попытка ${attempt}/3 — сетевая ошибка: ${err.message}`);
          if (attempt === 3) throw err;
          await new Promise(r => setTimeout(r, 3000 * attempt)); // 3с, 6с, 9с
        }
      }

      if (!res.ok) {
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
      const d = data?.payload || data || {};
      console.log('=== ДЕТАЛИ: ключи верхнего уровня ===', Object.keys(d));
      const sku0 = d?.skuList?.[0];
      if (sku0) console.log('=== ПЕРВЫЙ SKU: ключи ===', Object.keys(sku0));
      console.log('=== ПОЛНЫЙ JSON (3000 chars) ===', JSON.stringify(d).substring(0, 3000));
    }
    return data?.payload || data;
  } catch(e) { 
    console.log(`  Ошибка деталей:`, e.message);
    return null; 
  }
}

// ── 3. Преобразуем формат Узум → формат нашей БД ────────────
// Details API возвращает 403 — берём всё из skuList листинга.
// Каждый SKU имеет characteristics ("40, Белый") и previewImage.
function mapUzumToSupabase(uzumProduct) {
  const p = uzumProduct;
  const makeUrl = raw => raw.startsWith('http')
    ? `${raw}/original.jpg`
    : `https://images.uzum.uz/${raw}/original.jpg`;

  // Собираем уникальные цвета → изображения + размеры из skuList
  const sizesSet = new Set();
  const colorVariants = {};  // color → { images: [] }
  const colorsArr = [];      // порядок добавления цветов

  // Паттерн размеров — чтобы не путать их с цветами
  const SIZE_RE = /^(\d+(\.\d+)?|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL)$/i;

  if (p.skuList?.length) {
      p.skuList.forEach(sku => {
          const chars = (sku.characteristics || '').split(',').map(s => s.trim());
          const size  = chars[0];
          const color = chars[1];
          if (size) sizesSet.add(size);
          // пропускаем если цвет — число, пустая строка или паттерн размера
          if (color && !SIZE_RE.test(color)) {
              if (!colorVariants[color]) {
                  colorVariants[color] = { images: [] };
                  colorsArr.push(color);
              }
              if (sku.previewImage) {
                  const url = makeUrl(sku.previewImage);
                  if (!colorVariants[color].images.includes(url)) {
                      colorVariants[color].images.push(url);
                  }
              }
          }
          // если цвета нет — изображение всё равно сохраняем в запасной массив
          if ((!color || SIZE_RE.test(color)) && sku.previewImage) {
              const url = makeUrl(sku.previewImage);
              if (!colorVariants['__default__']) {
                  colorVariants['__default__'] = { images: [] };
              }
              if (!colorVariants['__default__'].images.includes(url)) {
                  colorVariants['__default__'].images.push(url);
              }
          }
      });
  }

  // если нет ни одного цвета — берём фото из запасного массива
  const hasColors = colorsArr.length > 0;
  const fallbackImages = colorVariants['__default__']?.images || [];

  const sizes    = [...sizesSet];
  const colors   = colorsArr;
  const variants = colors.map(c => ({
      color: c,
      code: c,
      images: colorVariants[c].images
  }));
  const images = variants[0]?.images?.length
      ? variants[0].images
      : (fallbackImages.length ? [fallbackImages[0]] : null);

  const article = String(p.productId);
  const name    = p.skuList?.[0]?.productTitle || p.title || 'Товар Li-Ning';

  const categoryMap = {
    'Кроссовки': 'shoes', 'Обувь': 'shoes', 'Кеды': 'shoes', 'Шлепанцы': 'shoes', 'Сабо': 'shoes',
    'Футболка': 'clothing', 'Штаны': 'clothing', 'Шорты': 'clothing',
    'Брюки': 'clothing', 'Лонгслив': 'clothing', 'Поло': 'clothing',
    'Куртка': 'clothing', 'Пуховик': 'clothing', 'Форма': 'clothing', 'Трико': 'clothing',
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
    name,
    description: p.description || p.fullDescription || p.skuList?.[0]?.description || null,
    category,
    gender,
    brand: 'Li Ning',
    price: 0,
    old_price: null,
    sizes: sizes.length > 0 ? sizes : null,
    colors: colors.length > 0 ? colors : null,
    images,
    variants: variants.length > 0 ? variants : null,
    badge: null,
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
    const res = await fetch(`${SB_URL}/rest/v1/products?on_conflict=article`, {
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
    
    console.log('\n🔄 Обрабатываем товары...');
    const products = [];

    for (let i = 0; i < uzumList.length; i++) {
      const item = uzumList[i];
      process.stdout.write(`  ${i + 1}/${uzumList.length} - ${item.title || item.name}... `);
      const mapped = mapUzumToSupabase(item);
      products.push(mapped);
      console.log(`✓ (${mapped.images?.length || 0} фото, цветов: ${mapped.colors?.length || 0}: ${(mapped.colors || []).join(', ')})`);
    }

    console.log(`\n✅ Итого: ${products.length} товаров`);
    const result = await saveToSupabase(products);

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