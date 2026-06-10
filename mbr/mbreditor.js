/* =========================================================
   MBR · Editor — личный кабинет (mbr-editor.html)
   Каждый пользователь видит и редактирует только свою секцию,
   admin может переключаться между любыми.
   ========================================================= */

let _profile = null;
let _period  = null;
let _section = null;     // выбранная секция
let _state   = {};       // текущее значение редактируемой секции
let _dirty   = false;

/* ---------- Init ---------------------------------------- */
(async function init() {
  const user = await sbRequireAuth();
  if (!user) return;

  _profile = await sbGetProfile();
  if (!_profile) {
    document.getElementById('edForm').innerHTML =
      `<div class="ed-empty">У вашей учётной записи нет привязанной роли.
       Попросите администратора назначить роль в таблице <code>profiles</code>.</div>`;
    return;
  }

  _period = await sbGetCurrentPeriod();
  if (!_period) {
    document.getElementById('edForm').innerHTML =
      `<div class="ed-empty">Не задан текущий период. Откройте Supabase →
       таблица <code>mbr_periods</code> → проставьте <code>is_current = true</code>
       нужной строке.</div>`;
    return;
  }

  document.getElementById('edPeriod').textContent = 'Период: ' + _period.name;
  document.getElementById('edUser').innerHTML = `
    <div class="ed-user-name">${escapeHtml(_profile.full_name)}</div>
    <div class="ed-user-role">${ROLE_LABEL[_profile.role] || _profile.role}</div>
  `;

  // Меню секций
  renderNav();

  // Выбрать стартовую секцию
  const own = sectionForProfile(_profile);
  setSection(own || (_profile.role === 'admin' ? 'meta' : null));

  // Сохранение
  document.getElementById('saveBtn').addEventListener('click', save);
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sbSignOut();
    location.replace('mbr-login.html');
  });

  // Не дать уйти без сохранения
  window.addEventListener('beforeunload', (e) => {
    if (_dirty) { e.preventDefault(); e.returnValue = ''; }
  });
})();

/* ---------- Sidebar nav --------------------------------- */
function renderNav() {
  const nav = document.getElementById('edNav');
  const items = [];

  if (_profile.role === 'admin') {
    items.push(navItem('meta',        'Период и регионы',     'Шапка презентации'));
    items.push(navItem('director_1',  'Директор 1 (Ташкент-Центр)', '5 магазинов'));
    items.push(navItem('director_2',  'Директор 2 (Юг · Самарканд)', '5 магазинов'));
    items.push(navItem('director_3',  'Директор 3 (Север · Андижан)', '4 магазина'));
    items.push(navItem('product',     'Продукт-менеджер',     'Топ SKU, категории'));
    items.push(navItem('hr',          'HR',                    'Кадры, обучение'));
    items.push(navItem('warehouse',   'Склад',                 'Остатки, поставки'));
    items.push(navItem('marketing',   'Маркетинг',             'Бюджеты, CAC'));
  } else {
    const own = sectionForProfile(_profile);
    items.push(navItem(own, sectionTitle(own), sectionHint(own)));
  }

  nav.innerHTML = items.join('');
  nav.querySelectorAll('[data-sec]').forEach(b => {
    b.addEventListener('click', () => {
      if (_dirty && !confirm('У вас есть несохранённые правки. Перейти, потеряв их?')) return;
      setSection(b.dataset.sec);
    });
  });
}
function navItem(sec, title, hint) {
  return `<button class="ed-nav-item" data-sec="${sec}">
    <div class="ed-nav-title">${title}</div>
    <div class="ed-nav-hint">${hint || ''}</div>
  </button>`;
}
function sectionTitle(sec) {
  return ({
    meta: 'Период и регионы',
    director_1: 'Мои магазины',
    director_2: 'Мои магазины',
    director_3: 'Мои магазины',
    product: 'Продуктовая аналитика',
    hr: 'HR · кадры и обучение',
    warehouse: 'Склад и поставки',
    marketing: 'Маркетинг · трафик и кампании'
  })[sec] || sec;
}
function sectionHint(sec) {
  return ({
    meta: 'Шапка презентации',
    director_1: 'Карточки магазинов + KPI',
    director_2: 'Карточки магазинов + KPI',
    director_3: 'Карточки магазинов + KPI',
    product: 'Топ-категории, новинки',
    hr: 'Численность, текучесть',
    warehouse: 'Остатки, время поставки',
    marketing: 'Кампании, бюджет, CAC'
  })[sec] || '';
}

/* ---------- Section load -------------------------------- */
async function setSection(sec) {
  _section = sec;
  if (!sec) {
    document.getElementById('edForm').innerHTML = `<div class="ed-empty">Выберите секцию в меню слева.</div>`;
    document.getElementById('edTitle').textContent = '—';
    document.getElementById('saveBtn').disabled = true;
    return;
  }
  document.getElementById('saveBtn').disabled = false;
  document.querySelectorAll('.ed-nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.sec === sec));
  document.getElementById('edTitle').textContent = sectionTitle(sec);

  const sections = await sbLoadAllSections(_period.id);
  _state = sections[sec] || defaultForSection(sec);
  _dirty = false;
  setStatus('');
  renderForm();
}

function defaultForSection(sec) {
  if (sec.startsWith('director_')) {
    return { name:'', role:'Региональный директор', region:'', photo:'', stores:[] };
  }
  if (sec === 'meta') {
    return { period: _period.name, regions: [{name:'Ташкент',count:11},{name:'Самарканд',count:2},{name:'Андижан',count:1}], summary:{ totalStores:14, totalRegions:3, note:'' } };
  }
  if (sec === 'product')   return { topCategories:[], newSku:0, topProduct:{name:'',units:0,revenue:''}, turnover:0, notes:'' };
  if (sec === 'hr')        return { headcountPlan:0, headcountFact:0, turnover:0, trained:0, openVacancies:0, enps:0, topTeam:'', notes:'' };
  if (sec === 'warehouse') return { stockUnits:0, stockValue:'', cover30:0, cover60:0, cover90:0, leadTime:0, writeOffs:'', topShortage:'', notes:'' };
  if (sec === 'marketing') return { budget:'', reach:0, visits:0, cac:0, convOnline:0, bestCampaign:'', socialFollowers:0, notes:'' };
  return {};
}

/* ---------- Form rendering ------------------------------ */
function renderForm() {
  const root = document.getElementById('edForm');
  let html = '';
  if (_section === 'meta')                  html = formMeta(_state);
  else if (_section.startsWith('director_'))html = formDirector(_state);
  else if (_section === 'product')          html = formProduct(_state);
  else if (_section === 'hr')               html = formHR(_state);
  else if (_section === 'warehouse')        html = formWarehouse(_state);
  else if (_section === 'marketing')        html = formMarketing(_state);
  root.innerHTML = html;
  wireFormInputs(root);
}

function formMeta(d) {
  return `
    <div class="card">
      <h3>Период</h3>
      <div class="grid g2">
        <label class="f"><span>Название периода</span><input data-p="period" value="${attr(d.period)}"></label>
        <label class="f"><span>Магазинов всего</span><input type="number" data-p="summary.totalStores" value="${attr(d.summary?.totalStores)}"></label>
      </div>
    </div>
    <div class="card">
      <h3>Регионы</h3>
      <div id="metaRegions" class="grid g3">
        ${(d.regions||[]).map((r,i) => regionRow(i, r)).join('')}
      </div>
      <button class="btn-add" type="button" onclick="addRegion()">+ Добавить регион</button>
    </div>
    <div class="card">
      <h3>Подпись на обложке</h3>
      <label class="f"><span>Комментарий</span>
        <textarea data-p="summary.note" rows="3">${escapeHtml(d.summary?.note||'')}</textarea>
      </label>
    </div>
  `;
}
function regionRow(i, r) {
  return `
    <div class="region-row">
      <label class="f"><span>Регион</span><input data-p="regions.${i}.name" value="${attr(r.name)}"></label>
      <label class="f"><span>Магазинов</span><input type="number" data-p="regions.${i}.count" value="${attr(r.count)}"></label>
      <button type="button" class="btn-del" onclick="delRegion(${i})">×</button>
    </div>
  `;
}
window.addRegion = () => { _state.regions = _state.regions || []; _state.regions.push({name:'',count:0}); markDirty(); renderForm(); };
window.delRegion = (i) => { _state.regions.splice(i,1); markDirty(); renderForm(); };

function formDirector(d) {
  return `
    <div class="card">
      <h3>О директоре</h3>
      <div class="grid g2">
        <label class="f"><span>ФИО</span><input data-p="name" value="${attr(d.name)}"></label>
        <label class="f"><span>Регион (подпись)</span><input data-p="region" value="${attr(d.region)}"></label>
        <label class="f"><span>Должность</span><input data-p="role" value="${attr(d.role)}"></label>
        <label class="f"><span>Фото (URL)</span><input data-p="photo" value="${attr(d.photo)}" placeholder="https://..."></label>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <h3>Магазины (${(d.stores||[]).length})</h3>
        <button class="btn-add" type="button" onclick="addStore()">+ Добавить магазин</button>
      </div>
      <div id="storesList" class="stores-edit">
        ${(d.stores||[]).map((s,i) => storeCard(i, s)).join('')}
      </div>
    </div>
  `;
}
function storeCard(i, s) {
  const tr = (s.traffic || {});
  const trafficKeys = ['план','трафик','конверсия','средний чек','возвраты','персонал'];
  return `
    <div class="store-card">
      <div class="store-card-hd">
        <input class="store-card-name" data-p="stores.${i}.name" value="${attr(s.name)}" placeholder="Название магазина">
        <input class="store-card-mall" data-p="stores.${i}.mall" value="${attr(s.mall)}" placeholder="ТРЦ / адрес">
        <button type="button" class="btn-del" onclick="delStore(${i})" title="Удалить магазин">×</button>
      </div>

      <div class="grid g4">
        <label class="f"><span>% выполнения плана</span><input type="number" data-p="stores.${i}.planPercent" value="${attr(s.planPercent)}"></label>
        <label class="f"><span>Светофор статуса</span>
          <select data-p="stores.${i}.status">
            ${['green','yellow','red'].map(v=>`<option value="${v}" ${s.status===v?'selected':''}>${v}</option>`).join('')}
          </select>
        </label>
        <label class="f"><span>UPT (товаров в чеке)</span><input type="number" step="0.1" data-p="stores.${i}.upt" value="${attr(s.upt)}"></label>
        <label class="f"><span>Конверсия, %</span><input type="number" data-p="stores.${i}.conversion" value="${attr(s.conversion)}"></label>
      </div>

      <h4>Выручка</h4>
      <div class="grid g4">
        <label class="f"><span>Факт</span><input data-p="stores.${i}.revenue.value" value="${attr(s.revenue?.value)}"></label>
        <label class="f"><span>Ед. изм</span><input data-p="stores.${i}.revenue.unit" value="${attr(s.revenue?.unit)}"></label>
        <label class="f"><span>MoM, %</span><input type="number" data-p="stores.${i}.revenue.mom" value="${attr(s.revenue?.mom)}"></label>
        <label class="f"><span>YoY, %</span><input type="number" data-p="stores.${i}.revenue.yoy" value="${attr(s.revenue?.yoy)}"></label>
      </div>

      <h4>Пары / Чеки / Средний чек</h4>
      <div class="grid g4">
        <label class="f"><span>Пар / шт</span><input type="number" data-p="stores.${i}.pairs.value" value="${attr(s.pairs?.value)}"></label>
        <label class="f"><span>Пары · MoM</span><input type="number" data-p="stores.${i}.pairs.mom" value="${attr(s.pairs?.mom)}"></label>
        <label class="f"><span>Чеков</span><input type="number" data-p="stores.${i}.tx.value" value="${attr(s.tx?.value)}"></label>
        <label class="f"><span>Чеки · MoM</span><input type="number" data-p="stores.${i}.tx.mom" value="${attr(s.tx?.mom)}"></label>
        <label class="f"><span>Средн. чек</span><input data-p="stores.${i}.avg.value" value="${attr(s.avg?.value)}"></label>
        <label class="f"><span>Ед. изм</span><input data-p="stores.${i}.avg.unit" value="${attr(s.avg?.unit)}"></label>
        <label class="f"><span>Средн. чек · MoM</span><input type="number" data-p="stores.${i}.avg.mom" value="${attr(s.avg?.mom)}"></label>
        <label class="f"><span>Возвраты, %</span><input type="number" step="0.1" data-p="stores.${i}.returns" value="${attr(s.returns)}"></label>
      </div>

      <h4>На сотрудника</h4>
      <div class="grid g2">
        <label class="f"><span>Продажи / сотр.</span><input data-p="stores.${i}.spe.value" value="${attr(s.spe?.value)}"></label>
        <label class="f"><span>Ед. изм</span><input data-p="stores.${i}.spe.unit" value="${attr(s.spe?.unit)}"></label>
      </div>

      <h4>Тренд выручки · 6 месяцев</h4>
      <div class="grid g6">
        ${[0,1,2,3,4,5].map(j=>`<label class="f"><span>М${j+1}</span><input type="number" data-p="stores.${i}.trend.${j}" value="${attr((s.trend||[])[j])}"></label>`).join('')}
      </div>
      <h4>Прошлый год (YoY) · 6 месяцев</h4>
      <div class="grid g6">
        ${[0,1,2,3,4,5].map(j=>`<label class="f"><span>М${j+1}</span><input type="number" data-p="stores.${i}.trendPy.${j}" value="${attr((s.trendPy||[])[j])}"></label>`).join('')}
      </div>

      <h4>План / Факт по неделям</h4>
      <div class="grid g4">
        ${[0,1,2,3].map(j => `
          <div class="weeks-pair">
            <div class="weeks-lbl">Неделя ${j+1}</div>
            <label class="f"><span>План</span><input type="number" data-p="stores.${i}.weeks.${j}.0" value="${attr((s.weeks?.[j]||[])[0])}"></label>
            <label class="f"><span>Факт</span><input type="number" data-p="stores.${i}.weeks.${j}.1" value="${attr((s.weeks?.[j]||[])[1])}"></label>
          </div>`).join('')}
      </div>

      <h4>Светофор</h4>
      <div class="traffic-edit">
        ${trafficKeys.map(k=>`
          <label class="f"><span>${k}</span>
            <select data-p="stores.${i}.traffic.${k}">
              ${['green','yellow','red'].map(v=>`<option value="${v}" ${tr[k]===v?'selected':''}>${v}</option>`).join('')}
            </select>
          </label>`).join('')}
      </div>
    </div>
  `;
}
window.addStore = () => {
  _state.stores = _state.stores || [];
  _state.stores.push({
    name:'', mall:'', status:'yellow', planPercent:100,
    revenue:{value:'0',unit:'млрд сум',mom:0,yoy:0},
    pairs:{value:0,mom:0}, tx:{value:0,mom:0},
    avg:{value:'0',unit:'тыс',mom:0},
    upt:1.7, conversion:30, returns:2.0,
    spe:{value:'0',unit:'млн'},
    trend:[0,0,0,0,0,0], trendPy:[0,0,0,0,0,0],
    weeks:[[0,0],[0,0],[0,0],[0,0]],
    traffic:{'план':'yellow','трафик':'green','конверсия':'yellow','средний чек':'green','возвраты':'green','персонал':'yellow'}
  });
  markDirty(); renderForm();
};
window.delStore = (i) => {
  if (!confirm('Удалить этот магазин из вашей секции?')) return;
  _state.stores.splice(i,1); markDirty(); renderForm();
};

function formProduct(d) {
  return `
    <div class="card">
      <h3>Топ-категории</h3>
      <div id="topCats" class="cats-edit">
        ${(d.topCategories||[]).map((c,i)=>`
          <div class="cat-row">
            <label class="f"><span>Категория</span><input data-p="topCategories.${i}.name" value="${attr(c.name)}"></label>
            <label class="f"><span>Выручка</span><input data-p="topCategories.${i}.revenue" value="${attr(c.revenue)}"></label>
            <label class="f"><span>Доля, %</span><input type="number" data-p="topCategories.${i}.share" value="${attr(c.share)}"></label>
            <button type="button" class="btn-del" onclick="delCat(${i})">×</button>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn-add" onclick="addCat()">+ Добавить категорию</button>
    </div>
    <div class="card">
      <h3>Топ-продукт месяца</h3>
      <div class="grid g3">
        <label class="f"><span>Название</span><input data-p="topProduct.name" value="${attr(d.topProduct?.name)}"></label>
        <label class="f"><span>Продано, шт</span><input type="number" data-p="topProduct.units" value="${attr(d.topProduct?.units)}"></label>
        <label class="f"><span>Выручка</span><input data-p="topProduct.revenue" value="${attr(d.topProduct?.revenue)}"></label>
      </div>
    </div>
    <div class="card">
      <h3>Прочее</h3>
      <div class="grid g2">
        <label class="f"><span>Новых SKU введено</span><input type="number" data-p="newSku" value="${attr(d.newSku)}"></label>
        <label class="f"><span>Оборачиваемость, дней</span><input type="number" data-p="turnover" value="${attr(d.turnover)}"></label>
      </div>
      <label class="f"><span>Заметки / выводы</span><textarea data-p="notes" rows="4">${escapeHtml(d.notes||'')}</textarea></label>
    </div>
  `;
}
window.addCat = () => { _state.topCategories = _state.topCategories||[]; _state.topCategories.push({name:'',revenue:'',share:0}); markDirty(); renderForm(); };
window.delCat = (i) => { _state.topCategories.splice(i,1); markDirty(); renderForm(); };

function formHR(d) {
  return `
    <div class="card">
      <h3>Численность и текучесть</h3>
      <div class="grid g3">
        <label class="f"><span>План штата</span><input type="number" data-p="headcountPlan" value="${attr(d.headcountPlan)}"></label>
        <label class="f"><span>Факт штата</span><input type="number" data-p="headcountFact" value="${attr(d.headcountFact)}"></label>
        <label class="f"><span>Текучесть, %</span><input type="number" step="0.1" data-p="turnover" value="${attr(d.turnover)}"></label>
      </div>
    </div>
    <div class="card">
      <h3>Обучение и вакансии</h3>
      <div class="grid g3">
        <label class="f"><span>Обучено сотрудников</span><input type="number" data-p="trained" value="${attr(d.trained)}"></label>
        <label class="f"><span>Открытых вакансий</span><input type="number" data-p="openVacancies" value="${attr(d.openVacancies)}"></label>
        <label class="f"><span>eNPS</span><input type="number" data-p="enps" value="${attr(d.enps)}"></label>
      </div>
      <label class="f"><span>Лучшая команда месяца</span><input data-p="topTeam" value="${attr(d.topTeam)}"></label>
    </div>
    <div class="card">
      <h3>Заметки</h3>
      <label class="f"><textarea data-p="notes" rows="5">${escapeHtml(d.notes||'')}</textarea></label>
    </div>
  `;
}

function formWarehouse(d) {
  return `
    <div class="card">
      <h3>Остатки</h3>
      <div class="grid g2">
        <label class="f"><span>Остатки, шт</span><input type="number" data-p="stockUnits" value="${attr(d.stockUnits)}"></label>
        <label class="f"><span>Стоимость остатков</span><input data-p="stockValue" value="${attr(d.stockValue)}" placeholder="напр. 4.8 млрд"></label>
      </div>
    </div>
    <div class="card">
      <h3>Покрытие</h3>
      <div class="grid g3">
        <label class="f"><span>Покрытие 30 дн., %</span><input type="number" data-p="cover30" value="${attr(d.cover30)}"></label>
        <label class="f"><span>Покрытие 60 дн., %</span><input type="number" data-p="cover60" value="${attr(d.cover60)}"></label>
        <label class="f"><span>Покрытие 90 дн., %</span><input type="number" data-p="cover90" value="${attr(d.cover90)}"></label>
      </div>
    </div>
    <div class="card">
      <h3>Поставки и потери</h3>
      <div class="grid g3">
        <label class="f"><span>Среднее время поставки, дн.</span><input type="number" data-p="leadTime" value="${attr(d.leadTime)}"></label>
        <label class="f"><span>Списания</span><input data-p="writeOffs" value="${attr(d.writeOffs)}"></label>
        <label class="f"><span>Топ-дефицит</span><input data-p="topShortage" value="${attr(d.topShortage)}"></label>
      </div>
      <label class="f"><span>Заметки</span><textarea data-p="notes" rows="4">${escapeHtml(d.notes||'')}</textarea></label>
    </div>
  `;
}

function formMarketing(d) {
  return `
    <div class="card">
      <h3>Бюджет и охват</h3>
      <div class="grid g3">
        <label class="f"><span>Рекл. бюджет</span><input data-p="budget" value="${attr(d.budget)}" placeholder="напр. 0.31 млрд"></label>
        <label class="f"><span>Охват, млн</span><input type="number" step="0.01" data-p="reach" value="${attr(d.reach)}"></label>
        <label class="f"><span>Подписчиков, ед.</span><input type="number" data-p="socialFollowers" value="${attr(d.socialFollowers)}"></label>
      </div>
    </div>
    <div class="card">
      <h3>Трафик и конверсия</h3>
      <div class="grid g3">
        <label class="f"><span>Визитов на сайт</span><input type="number" data-p="visits" value="${attr(d.visits)}"></label>
        <label class="f"><span>CAC, сум</span><input type="number" data-p="cac" value="${attr(d.cac)}"></label>
        <label class="f"><span>Конверсия онлайн, %</span><input type="number" step="0.1" data-p="convOnline" value="${attr(d.convOnline)}"></label>
      </div>
    </div>
    <div class="card">
      <h3>Кампании и заметки</h3>
      <label class="f"><span>Лучшая кампания</span><input data-p="bestCampaign" value="${attr(d.bestCampaign)}"></label>
      <label class="f"><span>Заметки</span><textarea data-p="notes" rows="4">${escapeHtml(d.notes||'')}</textarea></label>
    </div>
  `;
}

/* ---------- Inputs wiring ------------------------------- */
function wireFormInputs(root) {
  root.querySelectorAll('[data-p]').forEach(el => {
    el.addEventListener('input', () => {
      const path = el.dataset.p;
      let v = el.value;
      if (el.type === 'number') { v = (v === '' || isNaN(+v)) ? 0 : +v; }
      setByPath(_state, path, v);
      markDirty();
    });
  });
}

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const nextIsIdx = /^\d+$/.test(parts[i+1]);
    if (cur[k] == null) cur[k] = nextIsIdx ? [] : {};
    cur = cur[k];
  }
  const last = parts[parts.length-1];
  if (Array.isArray(cur) && /^\d+$/.test(last)) cur[+last] = value;
  else cur[last] = value;
}

function markDirty() {
  _dirty = true;
  setStatus('Есть несохранённые изменения');
}
function setStatus(t) { document.getElementById('edStatus').textContent = t; }

/* ---------- Save ---------------------------------------- */
async function save() {
  if (!_section) return;
  const btn = document.getElementById('saveBtn');
  btn.disabled = true; btn.textContent = 'Сохраняем…';
  try {
    await sbSaveSection(_period.id, _section, _state);
    _dirty = false;
    setStatus('Сохранено · ' + new Date().toLocaleTimeString('ru-RU'));
    toast('Сохранено — данные уже в презентации');
  } catch (e) {
    setStatus('Ошибка: ' + (e?.message || e));
    alert('Не удалось сохранить: ' + (e?.message || e) + '\n\nВозможно, у вашей роли нет прав на эту секцию. Проверьте RLS-политику can_edit_section() в Supabase.');
  } finally {
    btn.disabled = false; btn.textContent = 'Сохранить';
  }
}

/* ---------- Helpers ------------------------------------- */
function escapeHtml(s) {
  if (s == null) return '';
  return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function attr(s) { return escapeHtml(s == null ? '' : s); }

let _toastT;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => t.classList.remove('show'), 2200);
}
