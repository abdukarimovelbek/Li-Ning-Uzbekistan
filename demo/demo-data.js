/* ============================================================
   LI NING DEMO — DATA
   ============================================================ */
const A = 'assets/';

const HERO_SLIDES = [
  {
    tag:'Новая коллекция · 2026',
    cn:'李宁',
    h1:['СКОРОСТЬ','<em>В КРОВИ</em>'],
    desc:'Профессиональная беговая линейка Li-Ning. Технология ультра-лёгкой амортизации для каждого шага.',
    bg:A+'products/armt015-main.jpg',
    fit:'contain', tint:'#1a1726',
    stats:[['12','Технологий'],['#1','В Азии'],['2026','Новый сезон']]
  },
  {
    tag:'Баскетбол · Street',
    cn:'篮球',
    h1:['ПРАВЬ','<em>ПЛОЩАДКОЙ</em>'],
    desc:'Линейка Wade и баскетбольные силуэты, созданные для взрывной игры на любом покрытии.',
    bg:A+'collections/basketball.png',
    fit:'cover', tint:'#15171a',
    stats:[['40+','Моделей'],['Wade','Signature'],['NBA','Технологии']]
  },
  {
    tag:'Lifestyle · Sportstyle',
    cn:'运动',
    h1:['ГОРОД —','<em>ТВОЙ ЗАЛ</em>'],
    desc:'Спортивный стиль для повседневности. Где бы ты ни был — оставайся в движении.',
    bg:A+'collections/Sportstyle.png',
    fit:'cover', tint:'#181614',
    stats:[['100K+','Клиентов'],['5','Магазинов'],['4.9★','Рейтинг']]
  }
];

const NAMES = [
  ['Беговые ARMT015','Бег','sneakers'],
  ['Wade All City 11','Баскетбол','sneakers'],
  ['Running Cloud 6','Бег','sneakers'],
  ['Essential Tee','Тренировка','clothing'],
  ['Court Vision Low','Lifestyle','sneakers'],
  ['Speed Pro Elite','Бег','sneakers'],
  ['Fitness Short 7"','Фитнес','clothing'],
  ['Sportstyle Hoodie','Lifestyle','clothing'],
  ['Badminton Pro','Бадминтон','sneakers'],
  ['Track Jacket Wind','Бег','clothing'],
  ['Wade Fission VIII','Баскетбол','sneakers'],
  ['Cushion Walker','Lifestyle','sneakers']
];

const IMGS = [
  [A+'products/armt015-main.jpg', A+'products/armt015-side.jpg'],
  [A+'products/arpw003-main.jpg', A+'products/arpw003-side.jpg'],
  [A+'products/arpv013-main.jpg', A+'products/arpv013-side.jpg'],
];

const BADGES = [null,'sale','hot','new',null,'sale',null,'new','hot',null,'sale','new'];

function money(n){ return n.toLocaleString('ru-RU').replace(/,/g,' ')+' сум'; }

const PRODUCTS = NAMES.map((n,i)=>{
  const base = 690000 + (i*47000)%520000;
  const price = Math.round(base/10000)*10000;
  const onSale = BADGES[i]==='sale';
  const img = IMGS[i%IMGS.length];
  return {
    id:'p'+(i+1),
    name:n[0], cat:n[1], type:n[2],
    price: price,
    old: onSale ? Math.round(price*1.4/10000)*10000 : null,
    badge: BADGES[i],
    rating:(4.4 + (i%5)*0.12).toFixed(1),
    reviews: 40 + (i*37)%420,
    imgA: img[0], imgB: img[1],
    sizes:[40,41,42,43,44,45].map(s=>({s, ok:(i+s)%7!==0})),
    fav:false
  };
});

const REVIEW_BARS = [
  [5,86],[4,9],[3,3],[2,1],[1,1]
];

const REVIEWS = [
  {n:'Азиз Р.',d:'3 дня назад',r:5,t:'Заказывал беговые — пришли за 2 дня. Качество огонь, сидят идеально. Li-Ning приятно удивил.'},
  {n:'Дилноза К.',d:'неделю назад',r:5,t:'Очень удобный сайт, всё нашла быстро. Кроссовки Wade просто космос, ношу каждый день.'},
  {n:'Тимур А.',d:'2 недели назад',r:4,t:'Хороший выбор, доставка чёткая. Размер подошёл по таблице. Однозначно вернусь за второй парой.'},
  {n:'Камила Ю.',d:'месяц назад',r:5,t:'Покупаю уже третий раз. Оригинал, чеки, гарантия. Магазин на Амира Темура — топ.'},
];

const STORES = [
  {n:'Li-Ning Compass Mall',addr:'ул. Катартал, 60, Чиланзар',hours:'10:00 – 22:00',open:true,x:34,y:58},
  {n:'Li-Ning Samarqand Darvoza',addr:'ул. Кораташ, 5А',hours:'10:00 – 22:00',open:true,x:52,y:40},
  {n:'Li-Ning Tashkent City Mall',addr:'ул. Олмазор, 1',hours:'10:00 – 23:00',open:true,x:46,y:30},
  {n:'Li-Ning Riviera',addr:'пр. Амира Темура, 107Б',hours:'10:00 – 22:00',open:false,x:64,y:52},
  {n:'Li-Ning Next Mall',addr:'ул. Бабура, 174',hours:'10:00 – 22:00',open:true,x:40,y:72},
];

const ORDERS = [
  { id:'LN-24816', date:'8 июня 2026', status:'processing', stLabel:'В пути', step:2,
    items:[ {p:PRODUCTS[0], size:42, qty:1}, {p:PRODUCTS[3], size:'L', qty:2} ] },
  { id:'LN-24655', date:'27 мая 2026', status:'delivered', stLabel:'Доставлен', step:3,
    items:[ {p:PRODUCTS[1], size:43, qty:1} ] },
  { id:'LN-24390', date:'14 мая 2026', status:'delivered', stLabel:'Доставлен', step:3,
    items:[ {p:PRODUCTS[5], size:41, qty:1}, {p:PRODUCTS[7], size:'M', qty:1} ] },
];

const TRACK_STEPS = ['Принят','Собран','В пути','Доставлен'];
