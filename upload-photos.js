require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const SB_URL = process.env.SB_URL || 'https://dgyirginrefvjsbhhooi.supabase.co';
const SB_KEY = process.env.SB_KEY;
const PHOTOS_DIR = path.join(__dirname, 'admin', 'Photos');

if (!SB_KEY) {
  console.error('❌ SB_KEY не найден! Создай файл .env с переменной SB_KEY=твой_ключ');
  process.exit(1);
}
async function uploadFile(filePath, storageKey) {
    const body = fs.readFileSync(filePath);
    const res = await fetch(`${SB_URL}/storage/v1/object/product-images/${storageKey}`, {
        method: 'POST',
        headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
            'Content-Type': 'image/jpeg',
        },
        body
    });
    if (!res.ok) {
        const text = await res.text();
        if (text.includes('Duplicate') || text.includes('"409"')) {
            return `${SB_URL}/storage/v1/object/public/product-images/${storageKey}`;
        }
        throw new Error(`${res.status}: ${text}`);
    }
    return `${SB_URL}/storage/v1/object/public/product-images/${storageKey}`;
}

async function getProduct(article) {
    const res = await fetch(
        `${SB_URL}/rest/v1/products?article=eq.${encodeURIComponent(article)}&select=id,variants`,
        { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }
    );
    const data = await res.json();
    return data?.[0] || null;
}

async function updateProduct(productId, variants) {
    const res = await fetch(`${SB_URL}/rest/v1/products?id=eq.${productId}`, {
        method: 'PATCH',
        headers: {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
            variants,
            images: variants[0]?.images || []
        })
    });
    return res.ok;
}

async function main() {

    const folders = fs.readdirSync(PHOTOS_DIR)
        .filter(f => fs.statSync(path.join(PHOTOS_DIR, f)).isDirectory());

    console.log(`📁 Папок найдено: ${folders.length}\n`);

    for (const folder of folders) {
        // ARBW007-10 → article=ARBW007, colorCode=10
        // ARPV013    → article=ARPV013,  colorCode=null
        const match = folder.match(/^(.+?)-(\d+)$/);
        const article   = match ? match[1] : folder;
        const colorCode = match ? match[2] : null;

        console.log(`📦 ${folder}  →  article="${article}" colorCode="${colorCode || 'нет'}"`);

        const product = await getProduct(article);
        if (!product) {
            console.log(`   ⚠️  Товар "${article}" не найден в базе — пропуск\n`);
            continue;
        }

        const files = fs.readdirSync(path.join(PHOTOS_DIR, folder))
            .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
            .sort((a, b) => {
                // берём число ПЕРЕД расширением (после пробела): "ARBW007-25 10.jpg" → 10
                const numA = parseInt(a.match(/ (\d+)\.[^.]+$/)?.[1] || '0');
                const numB = parseInt(b.match(/ (\d+)\.[^.]+$/)?.[1] || '0');
                return numA - numB;
            });

        console.log(`   📷 Файлов: ${files.length}`);

        const urls = [];
        for (const file of files) {
            const filePath   = path.join(PHOTOS_DIR, folder, file);
            const storageKey = `${folder}/${file}`.replace(/\s/g, '_');
            try {
                const url = await uploadFile(filePath, storageKey);
                urls.push(url);
                console.log(`   ✓ ${file}`);
            } catch(e) {
                console.log(`   ✗ ${file}: ${e.message}`);
            }
        }

        if (!urls.length) { console.log('   ⚠️  Нет загруженных файлов\n'); continue; }

        const variants = Array.isArray(product.variants) ? [...product.variants] : [];

        if (colorCode) {
            const idx = variants.findIndex(v => String(v.code) === colorCode);
            if (idx >= 0) {
                variants[idx] = { ...variants[idx], images: urls };
            } else {
                console.log(`   ⚠️  Вариант с кодом "${colorCode}" не найден`);
                console.log(`   💡 Открой товар "${article}" в дашборде → задай код "${colorCode}" нужному цвету → запусти скрипт снова\n`);
                continue;
            }
        } else {
            if (variants.length > 0) variants[0] = { ...variants[0], images: urls };
        }

        const ok = await updateProduct(product.id, variants);
        console.log(`   ${ok ? '✅ Обновлено' : '❌ Ошибка обновления'}\n`);
    }

    console.log('✅ Готово!');
}

main().catch(console.error);
