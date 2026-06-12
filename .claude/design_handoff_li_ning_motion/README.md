# Handoff: Li-Ning Uzbekistan — Cinematic UX/UI Motion Layer

## Overview
Кинематографичный слой движения и визуальная доводка для интернет-магазина **Li-Ning Uzbekistan** (официальный дистрибьютор). Цель — превратить рабочий магазин в премиальный, «дышащий» сайт: экран загрузки при первом заходе, плавные появления при скролле, расхлопывающаяся лента коллекций, переходы между страницами, оживающий hero и счётчики.

Целевой сайт — **мультистраничный статический сайт** (vanilla HTML + CSS + один `js/main.js`), товары/слайды/отзывы тянутся из **Supabase**. Никакого фреймворка нет — реализация остаётся на vanilla JS, как в существующем коде.

## About the Design Files
Файлы в папке `reference_demo/` — это **дизайн-референс, собранный на HTML** (один самодостаточный прототип всех экранов в одном файле с переключением вью). Это **не** код для копирования один-в-один. Задача — **перенести визуал и анимации этого референса в существующий кодовый сайт** (`CODE/`), используя его уже сложившиеся паттерны: те же CSS-переменные, классы Supabase-рендеринга, структуру `js/main.js`.

Большая часть работы по интеграции **уже выполнена** (см. раздел «Что уже внедрено»). Этот пакет фиксирует систему целиком и оставшиеся задачи, чтобы разработчик мог завершить и поддерживать её без участия автора.

## Fidelity
**High-fidelity (hifi).** Точные цвета, типографика, тайминги и easing. Палитра и шрифты целевого сайта и референса **идентичны** (см. Design Tokens) — поэтому перенос сводится к добавлению движения и пары визуальных правок hero, а не к рестайлингу.

---

## Что уже внедрено в `CODE/` (на момент передачи)
Эти части уже вставлены в `CODE/index.html` и `CODE/css/styles.css` и работают:

1. **Загрузчик «Ink»** — `CODE/index.html`, блок `<!-- LI-NING CINEMATIC LOADER -->` сразу после `<body>`. Самодостаточный (свой HTML+CSS+JS). Логотип «протекает» слева направо через `clip-path`, счётчик 0→100 %, затем раскрытие шторкой из 5 панелей. Показывается один раз за сессию вкладки (`sessionStorage('ln_intro_seen')`).
2. **Reveal при скролле + прогресс-бар** — CSS-классы `.ln-mo .ln-rev` / `.ln-prog` (конец `styles.css`) + IIFE `<!-- LI-NING MOTION -->` перед `</body>`. Вешает `.ln-rev` на список селекторов (`SEL`), показывает их по `IntersectionObserver` с ручным фолбэком. Тонкий красный прогресс-бар сверху.
3. **Page wipe** — CSS `.ln-wipe` + IIFE `<!-- LI-NING PAGE WIPE -->`. Перехватывает клики по внутренним `<a>`, проигрывает шторку с логотипом, координирует раскрытие на новой странице через `sessionStorage('ln_wipe_in')`. Кнопки и `[data-no-wipe]` игнорируются.
4. **Word-reveal + count-up** — CSS `.ln-words .ln-w > i` + IIFE `<!-- LI-NING: word-reveal + count-up -->`. `window.lnWords(el)` разбивает текст на слова в масках и выезжает их снизу. `[data-count]` отматывает числа при попадании в зону видимости.
5. **Аккордеон коллекций** — CSS-блок `@media (hover:hover) and (min-width:769px)` в конце `styles.css`: при наведении карточка расширяется (`flex-grow`), соседи сжимаются, лента подрастает по высоте.

## Что осталось доделать (оставшиеся задачи)
Эти правки делают hero «как в референсе». Точные диффы — в разделе «Migration map» ниже.

- **A. Hero Ken Burns + кинематографичный скрим** — `styles.css` ~2064–2091. Заменить статичный фон на медленный «наезд камеры» и тёмный градиент слева под текст.
- **B. Мягкая смена слайдов** — `styles.css` ~2059–2062. Заменить `@keyframes slideIn` (сдвиг вбок) на проявление + лёгкий зум.
- **C. Word-reveal заголовка hero** — `js/main.js`: добавить класс `ln-words` заголовку слайда (~1782), вызвать `lnReveal()` при смене слайда (`goTo`, ~1801–1814) и для первого слайда (конец `renderSlides`, ~1798).
- **D. Count-up рейтинга** — `js/main.js` ~1595–1596: анимировать `#rating-big-value` от 0 к среднему баллу.
- **E. (Опционально) тёмная секция отзывов** — `.reviews-section` сейчас светлая (`--cream-dark`); референс — тёмная (`--black`). Решение за владельцем бренда.

---

## Screens / Views
Все экраны используют общий nav (тёмный, прозрачный над hero → плотный при скролле), общий футер и каркас секций (`.section` / `.section-inner` / `.section-head` / `.section-label` / `.section-title` / `.see-all`).

### 1. Home — Hero (`index.html`)
- **Purpose**: первый экран, переключаемые промо-слайды из Supabase.
- **Layout**: `.hero-slider` высотой `100vh`, `margin-top: calc(-1 * var(--nav-h))` (под прозрачный nav). Контент — flex-колонка, выровнен по центру по вертикали, паддинг `0 4rem`. Точки слайдера — `.slider-controls` внизу по центру.
- **Components**:
  - Фон `.hero-slide-bg` (`background-image` из `slide.bg_image`), скрим `.hero-slide-bg-overlay`.
  - `.hero-tag` — надзаголовок, `0.74rem`, `letter-spacing .34em`, uppercase, с красной чертой 42×1px перед текстом.
  - `.hero-h1` — `font-family: Bebas Neue`, `clamp(4rem,10vw,9rem)`, `line-height ~.86`. `em` внутри → красный. **Анимация**: слова выезжают снизу из масок, задержка `i*0.07s`, transform `translateY(110%)→0`, `.9s cubic-bezier(.22,1,.36,1)`.
  - `.hero-cta` — кнопки `.btn .btn-primary` (красная) / `.btn-ghost`.
  - **Ken Burns**: `.hero-slide.active .hero-slide-bg` → `@keyframes kenburns 9s ease-out forwards` (scale 1.16→1.03 + лёгкий translate).
- **Behavior**: авто-смена каждые `4000ms` (`startTimer`), точки/стрелки — `goToSlide/prevSlide/nextSlide`. При каждой смене заново проигрывается word-reveal заголовка.

### 2. Home — Collections strip (`index.html`, `.collections-grid`)
- **Purpose**: 5 коллекций (Баскетбол, Wade, Бег, Фитнес, Sportstyle) → ссылки на `catalog.html?collection=…`.
- **Layout**: `display:flex`, высота `520px`, фон `--black`. Слева вертикальный лейбл `.collections-side-label` (`writing-mode: vertical-rl; rotate(180deg)`). Карточки `.collection-card` — `flex:1`, разделены бордером `rgba(255,255,255,.08)`.
- **Components**: `.collection-img-wrap img` (`object-fit:cover`, `brightness(.85)`), `.collection-label` (Oswald 700, `1.4rem`, в левом верхнем углу), стрелка `↗` `.collection-card::after` в правом нижнем углу (появляется на hover).
- **Behavior (аккордеон)**: на десктопе при `.collections-grid:hover` соседи `flex-grow:.7`, наведённая `flex-grow:1.5`, высота ленты `→550px`, картинка `translateY(-8px) scale(1.03)` + `brightness(1)`, лейбл → красный. Тайминг `.75s var(--ease)`. На `≤768px` — горизонтальный свайп-рейл (`flex:0 0 72vw`, scroll-snap), лейбл скрыт.

### 3. Home — Popular products (`index.html`, `#home-products`)
- **Purpose**: сетка хитов, рендер из Supabase через `buildCard()` в `main.js`.
- **Layout**: `.products-grid` — `grid`, `repeat(auto-fill,minmax(280px,1fr))`, `gap 1.8rem`.
- **Components**: `.product-card` (бордер `--gray-100`, radius `--radius-md`); hover → `translateY(-6px)` + `--shadow-md` + бордер `--red`; `.product-img` scale `1.06`; swap картинки `.has-hover-img .img-main↔.img-hover` (`opacity .4s`); бейджи `.badge-new/.badge-sale/.badge-hot` и со «срезом» `.badge--50/.badge--70/.badge-1eq3` (`clip-path: polygon(0 0,100% 0,100% 72%,50% 100%,0 72%)`); `.quick-view-btn` — тёмная плашка, выезжает снизу на hover.
- **Reveal**: карточки используют собственный `card-animate` (НЕ трогать через `.ln-rev`).

### 4. Home — Reviews (`index.html`, `.reviews-section`)
- **Purpose**: средний рейтинг + распределение по звёздам + карточки отзывов (Supabase).
- **Layout**: `.reviews-summary` (крупный балл + `.rating-bars`), `.reviews-grid` `repeat(auto-fill,minmax(320px,1fr))`.
- **Components**: `#rating-big-value` (Bebas Neue, крупный) — **count-up от 0**; `.rating-bar-fill` — ширина в % анимируется; `.review-card` (белая, верхний градиентный бордер `red→gold` на hover, lift `-4px`).
- **Текущее vs референс**: сейчас фон `--cream-dark` (светлый). В референсе — `--black` (тёмный, карточки полупрозрачные). Опционально.

### 5. Catalog (`catalog.html`)
- Шапка-баннер (тёмная) с хлебными крошками + заголовком. Сайдбар фильтров + `.products-grid`. Reveal крошек/заголовка через `.ln-rev`, карточки — `card-animate`.

### 6. Product (`product.html`)
- Галерея (превью + крупное фото) + блок описания: размеры, «В корзину», избранное, фичи доставки/гарантии. Похожие товары снизу. Клики по размерам/кнопкам — `<button>` (wipe их игнорирует).

### 7. Stores / Map (`stores.html`)
- Карта + список магазинов (`.store-card`). Активный магазин подсвечивается, пины пульсируют. `.store-card` в списке reveal через `.ln-rev`.

### 8. Wishlist (`wishlist.html`) и My Orders (`my-orders.html`)
- Сетки товаров / карточки заказов со статусами и трекингом доставки. Пустые состояния. Reveal через `.ln-rev` (`.wishlist-header`, `.breadcrumb`, карточки).

---

## Interactions & Behavior (сводка таймингов)
- **Loader**: clip-path логотипа `1.1s cubic-bezier(.76,0,.24,1)`; счётчик `DUR=2000ms` (easeOutCubic); шторка `.75s` со ступенью `i*0.07s`; фейл-сейф `DUR+1500ms`.
- **Reveal секций**: `opacity+translateY(38px) → 0`, `.9s cubic-bezier(.22,1,.36,1)`; observer `threshold .12`, `rootMargin '0px 0px -7% 0px'`.
- **Progress bar**: высота `3px`, `linear-gradient(90deg,#C41E3A,#E8354D)`, обновление по scroll.
- **Page wipe**: уход — панели `scaleY(0→1)` `.42s` со ступенью `i*0.05s`, переход через `560ms`; приход — `scaleY(1→0)` `.5s`.
- **Word-reveal**: слово `translateY(110%)→0`, `.9s`, задержка `i*0.07s`.
- **Count-up**: `1200–1400ms`, easeOutCubic; формат RU (`2480 → 2 480`); `data-dec` — знаки после запятой, `data-pre/data-suf` — приписки.
- **Hero Ken Burns**: `9s ease-out forwards`.
- **Hero автослайд**: `4000ms`.
- **Accordion коллекций**: `flex-grow`/`height` `.75s cubic-bezier(.22,1,.36,1)`.
- **prefers-reduced-motion**: все эффекты выключаются (загрузчик скрыт, reveal без сдвига, wipe/word-reveal не вешаются).

## State Management
Состояние — как в текущем `main.js` (никакого фреймворка):
- `sessionStorage('ln_intro_seen')` — загрузчик показан в этой сессии.
- `sessionStorage('ln_wipe_in')` — следующая страница должна раскрыть шторку.
- Слайдер: `current` (индекс), `timer` (интервал автопрокрутки).
- Данные (товары, слайды, отзывы, рейтинг) — из Supabase, рендерятся в существующих функциях `loadSlides/renderSlides`, `buildCard`, `buildReviewCard`, агрегатор рейтинга (~1592).
- `dataset.lnW` / `dataset.lnC` — флаги «уже обработано» для word-reveal/count-up.

## Design Tokens (идентичны в референсе и в `CODE/css/styles.css :root`)
**Colors**
```
--red #C41E3A   --red-dark #A01830   --red-light #E8354D
--black #1A1A1A --gray-900 #2C2C2C   --gray-800 #3D3D3D
--gray-700 #555555 --gray-500 #888888 --gray-300 #BBBBBB
--gray-100 #EDE9E3 --white #FFFFFF
--cream #FAF8F5 --cream-dark #F2EEE8
--gold #B8860B --gold-light #D4A017
ink (скримы/тёмные фоны в референсе): rgba(15,15,15,*) / #141414
```
**Typography**: `--font-display: 'Bebas Neue'`; body `'Plus Jakarta Sans'`; заголовки секций/лейблов — `Oswald` (500–700). Импорт Google Fonts уже подключён.
**Spacing / radius / shadow / ease**
```
--nav-h 68px
--radius-sm 8px  --radius-md 14px  --radius-lg 20px
--shadow-sm 0 2px 16px rgba(0,0,0,.07)
--shadow-md 0 6px 32px rgba(0,0,0,.11)
--shadow-lg 0 16px 60px rgba(0,0,0,.15)
--ease cubic-bezier(.22,1,.36,1)
--ease-io cubic-bezier(.65,.05,.36,1)
--transition .28s var(--ease)
```

## Migration map (точные диффы «старое → новое»)
> Номера строк — по состоянию `CODE/css/styles.css` (2588 строк) и `CODE/js/main.js` (2083 строки) на момент передачи. Если файлы изменились — ориентируйся по селекторам/якорям, а не по номерам.

### A. Hero Ken Burns + скрим — `css/styles.css` ~2064–2091
Заменить блоки `.hero-slide-bg`, медиазапрос и `.hero-slide-bg-overlay` на версию с:
- `.hero-slide-bg`: `top:-5%; left:-5%; width:110%; height:110%; transform:scale(1.1); will-change:transform;`
- `.hero-slide.active .hero-slide-bg { animation: kenburns 9s ease-out forwards; }`
- `@keyframes kenburns { from{transform:scale(1.16) translate(1.5%,1%);} to{transform:scale(1.03) translate(-1%,-1%);} }`
- мобильный медиазапрос: `.hero-slide-bg{background-size:cover}` (+ прежние высоты `90vh`)
- `.hero-slide-bg-overlay`: `linear-gradient(105deg, rgba(15,15,15,.86) 0%, rgba(15,15,15,.55) 38%, rgba(15,15,15,.12) 70%, rgba(15,15,15,.38) 100%)`

### B. Мягкая смена слайдов — `css/styles.css` ~2059–2062
`@keyframes slideIn` → `from{opacity:0;transform:scale(1.015)} to{opacity:1;transform:scale(1)}`

### C. Word-reveal заголовка hero — `js/main.js`
1. ~1782: `<h1 class="hero-h1">` → `<h1 class="hero-h1 ln-words">`
2. ~1801–1814: добавить хелпер `lnReveal(slideEl)` (если `dataset.lnW` — снять `.in`, reflow, через 2×rAF вернуть `.in`; иначе `window.lnWords(h1)`), и вызвать `lnReveal(slideEls[current])` в конце `goTo`.
3. конец `renderSlides` (~1798, после `startTimer();`): `lnReveal(container.querySelector('.hero-slide.active'));`

### D. Count-up рейтинга — `js/main.js` ~1595–1596
`#rating-big-value` анимировать от 0 к `avg` (easeOutCubic, ~1200ms, `toFixed(1)`), с фолбэком при `avg === '—'`.

### E. (Опц.) Тёмные отзывы — `.reviews-section` фон `--cream-dark` → `--black`/`--ink`, заголовки белые, `.review-card` полупрозрачные на тёмном.

## Assets
- `logo.jpg` (используется в загрузчике, nav, wipe, футере) — уже в корне `CODE/`.
- `images/collections/{basketball,wade,Running,Fitness,Sportstyle}.png` — карточки коллекций.
- `images/noise.png` — текстура зерна (опц., для loader/hero grain).
- Фото товаров и слайдов hero — из Supabase / `admin/Photos`.
- Иконки — инлайн-SVG (heart, cart, search, стрелки), как в текущем коде.
- Шрифты — Google Fonts (Bebas Neue, Plus Jakarta Sans, Oswald), уже подключены.

## Files
**Целевой сайт (правим здесь):**
- `CODE/index.html` — hero, коллекции, popular, reviews + все 4 вставленных моушн-блока.
- `CODE/css/styles.css` — все стили, включая блоки `LI-NING MOTION` / `accordion` / `wipe` / `word-reveal` в конце файла.
- `CODE/js/main.js` — Supabase-рендеринг (`renderSlides`/`goTo` ~1756–1814, `buildCard`, агрегатор рейтинга ~1592).
- Прочие страницы: `catalog.html`, `product.html`, `stores.html`, `wishlist.html`, `my-orders.html` — для них вставляй те же `MOTION` + `PAGE WIPE` блоки перед `</body>`.

**Референс (НЕ деплоить, только смотреть/сверять):**
- `reference_demo/demo-index.html` — все экраны в одном файле (переключение вью).
- `reference_demo/demo-styles.css`, `reference_demo/demo-views.css` — стили референса.
- `reference_demo/demo-app.js`, `reference_demo/demo-data.js` — логика и мок-данные.
- `reference_demo/demo-assets/` — картинки референса.

Открыть референс: `reference_demo/demo-index.html` в браузере (работает офлайн). Hero/коллекции/скролл оживают при наведении и прокрутке в настоящем браузере.
