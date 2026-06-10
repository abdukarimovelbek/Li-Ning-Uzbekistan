/* =========================================================
   MBR — Monthly Business Review · Li-Ning UZ
   Презентационный режим (view-only). Данные тянутся из Supabase,
   подписан live на изменения — кто-то сохранил → экран сам обновился.
   Редактирование — в mbr-editor.html.
   ========================================================= */

let data = null;
let _period = null;
let currentDirectorIdx = null; // null = весь декларадж
let pageIndex = 0;

/* ---------- Init ----------------------------------------- */
(async function init() {
  // Требуем логин — данные internal-only
  const user = await sbRequireAuth();
  if (!user) return;

  const profile = await sbGetProfile();
  _period = await sbGetCurrentPeriod();

  if (!_period) {
    document.getElementById('selectScreen').innerHTML =
      `<div style="margin:auto;color:#fff;padding:40px;max-width:720px;text-align:center">
        <h2>Нет активного периода</h2>
        <p style="opacity:.7">Откройте Supabase → таблица <code>mbr_periods</code> → проставьте <code>is_current = true</code> нужной строке.</p>
        <p><a href="mbr-editor.html" style="color:#e1241c">Открыть личный кабинет</a></p>
      </div>`;
    return;
  }

  await reload();

  // Меню пользователя
  buildSelectScreen(profile);

  // Live-обновления
  sbSubscribeSections(_period.id, async () => {
    await reload();
    if (!document.getElementById('deck').classList.contains('hidden')) render();
    flashLiveUpdate();
  });

  // UI hookups
  document.getElementById('openAllBtn').onclick = () => openDeck(null);
  document.getElementById('prevBtn').onclick = prev;
  document.getElementById('nextBtn').onclick = next;
  document.getElementById('homeBtn').onclick = goHome;
  document.getElementById('resetBtn').onclick = () => location.reload();
  document.getElementById('editBtn').onclick = () => location.href = 'mbreditor.html';
})();

async function reload() {
  const sections = await sbLoadAllSections(_period.id);
  data = buildDeckData(sections);
}

/* ---------- Select screen -------------------------------- */
function buildSelectScreen(profile) {
  const grid = document.getElementById('directorGrid');
  grid.innerHTML = '';
  data.directors.forEach((d, i) => {
    const card = document.createElement('button');
    card.className = 'director-card';
    card.innerHTML = `
      <div class="dc-avatar">фото<br>директора</div>
      <div class="dc-body">
        <div class="dc-role">${escapeHtml(d.role || 'Региональный директор')} · ${i+1} / ${data.directors.length}</div>
        <div class="dc-name">${escapeHtml(d.name || '—')}</div>
        <div class="dc-meta">${escapeHtml(d.region || '')} · ${(d.stores||[]).length} магазинов</div>
      </div>
      <div class="dc-arrow">›</div>
    `;
    card.onclick = () => openDeck(i);
    grid.appendChild(card);
  });

  // Заменить тулбар внизу — оставить только «Открыть редактор» и «Выйти»
  const tools = document.querySelector('.select-tools');
  tools.innerHTML = `
    <button id="goEditor">Личный кабинет</button>
    <button id="goLogout">Выйти</button>
    <span class="who">${escapeHtml(profile?.full_name || '')} · ${escapeHtml(ROLE_LABEL[profile?.role] || '')}</span>
  `;
  document.getElementById('goEditor').onclick = () => location.href = 'mbreditor.html';
  document.getElementById('goLogout').onclick = async () => { await sbSignOut(); location.replace('mbrlogin.html'); };
}

function openDeck(directorIdx) {
  currentDirectorIdx = directorIdx;
  pageIndex = 0;
  document.getElementById('selectScreen').classList.add('hidden');
  document.getElementById('deck').classList.remove('hidden');
  render();
}
function goHome() {
  document.getElementById('selectScreen').classList.remove('hidden');
  document.getElementById('deck').classList.add('hidden');
}

/* ---------- Page model ----------------------------------- */
const EXTRA_SECTIONS = ['product','hr','warehouse','marketing'];

function totalPages() {
  const directors = currentDirectorIdx === null ? data.directors : [data.directors[currentDirectorIdx]];
  const dirPages = directors.reduce((s, d) => s + 1 + (d.stores||[]).length, 0);
  const extra = currentDirectorIdx === null ? EXTRA_SECTIONS.length : 0;
  return 1 /*cover*/ + dirPages + extra + 1 /*summary*/;
}

function pageMeta(idx) {
  const directors = currentDirectorIdx === null ? data.directors : [data.directors[currentDirectorIdx]];

  if (idx === 0) return { type: 'cover' };
  let i = 1;
  for (const d of directors) {
    if (idx === i) return { type: 'intro', director: d };
    i++;
    for (const s of (d.stores || [])) {
      if (idx === i) return { type: 'store', director: d, store: s };
      i++;
    }
  }
  if (currentDirectorIdx === null) {
    for (const sec of EXTRA_SECTIONS) {
      if (idx === i) return { type: sec };
      i++;
    }
  }
  return { type: 'summary' };
}

/* ---------- Render dispatcher ---------------------------- */
function render() {
  const total = totalPages();
  if (pageIndex < 0) pageIndex = 0;
  if (pageIndex >= total) pageIndex = total - 1;
  const meta = pageMeta(pageIndex);
  const root = document.getElementById('slide');

  switch (meta.type) {
    case 'cover':     root.innerHTML = renderCover(); break;
    case 'intro':     root.innerHTML = renderIntro(meta.director); break;
    case 'store':     root.innerHTML = renderStore(meta.director, meta.store); break;
    case 'product':   root.innerHTML = renderProduct(data.product); break;
    case 'hr':        root.innerHTML = renderHR(data.hr); break;
    case 'warehouse': root.innerHTML = renderWarehouse(data.warehouse); break;
    case 'marketing': root.innerHTML = renderMarketing(data.marketing); break;
    case 'summary':   root.innerHTML = renderSummary(); break;
  }
  document.getElementById('pageIndicator').textContent = `${pageIndex+1} / ${total}`;
  wireDeckClicks();
}

/* ---------- Cover ---------------------------------------- */
function renderCover() {
  const period = data.period;
  const note   = data.summary?.note || '';
  const totalStores = data.directors.reduce((s,d)=>s+(d.stores||[]).length,0);
  return `
    <div class="split">
      <div class="split-left">
        <div class="top-band"></div>
        <div><span class="brand-badge">LI-NING UZ</span></div>
        <div>
          <h1 class="cover-mbr">M<span class="b">B</span>R</h1>
          <div class="cover-subtitle">Monthly Business Review<br>Ежемесячный разбор результатов</div>
        </div>
        <div class="foot">
          <span class="chip">${totalStores}&nbsp;магазинов · ${data.summary?.totalRegions ?? data.regions.length}&nbsp;региона</span>
        </div>
      </div>
      <div></div>
      <div class="split-right">
        <div class="top-band"></div>
        <div class="cover-right-top">
          <span>&nbsp;</span>
          <span class="cover-logo">логотип компании</span>
        </div>
        <div>
          <div class="period-label">Отчётный период</div>
          <div class="period">${escapeHtml(period)}</div>
          <div class="region-chips">
            ${(data.regions||[]).map(r=>`
              <span class="region-chip">${escapeHtml(r.name)} · <span class="v">${r.count}</span></span>
            `).join('')}
          </div>
        </div>
        <div class="foot">${escapeHtml(note)}</div>
      </div>
    </div>
  `;
}

/* ---------- Director intro ------------------------------- */
function renderIntro(d) {
  const idx = data.directors.indexOf(d);
  const photoStyle = d.photo ? `style="background-image:url('${escapeAttr(d.photo)}'); color:transparent"` : '';
  return `
    <div class="split">
      <div class="split-left">
        <div class="top-band"></div>
        <div></div>
        <div>
          <div class="dir-photo" ${photoStyle}>фото<br>директора</div>
          <div style="text-align:center">
            <div class="dir-role">${escapeHtml(d.role || 'Региональный директор')} · ${idx+1} / ${data.directors.length}</div>
            <h2 class="dir-name">${escapeHtml(d.name || '—')}</h2>
            <div class="dir-region">Регион: ${escapeHtml(d.region || '')} · ${(d.stores||[]).length} магазинов</div>
          </div>
        </div>
        <div></div>
      </div>
      <div></div>
      <div class="split-right">
        <div class="top-band"></div>
        <div></div>
        <div>
          <h3 class="stores-title">Магазины региона</h3>
          <div class="stores-sub">
            <span>${(d.stores||[]).length} точек · отвечает ${escapeHtml((d.name||'').split(' ').slice(-1)[0])}</span>
            <span>% выполнения плана · ${escapeHtml(monthShort(data.period))}</span>
          </div>
          <div class="stores-list">
            ${(d.stores||[]).map((s, si) => `
              <div class="store-row" data-go="${si}">
                <span class="sl-dot ${s.status||''}"></span>
                <div>
                  <div class="sl-name">${escapeHtml(s.name)}</div>
                  <div class="sl-mall">${escapeHtml(s.mall)}</div>
                </div>
                <div class="sl-bar"><div style="width:${Math.min(100, +s.planPercent||0)}%"></div></div>
                <div class="sl-pct">${+s.planPercent||0}%</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="foot">Кликните по строке, чтобы открыть карточку магазина</div>
      </div>
    </div>
  `;
}

/* ---------- Store detail --------------------------------- */
function renderStore(d, s) {
  const statusLabel = s.planPercent >= 100 ? 'План выполнен' : (s.planPercent >= 95 ? 'Близко к плану' : 'Ниже плана');
  const pillClass = s.status || 'yellow';
  return `
    <div class="detail">
      <div class="detail-top-band"></div>
      <header class="detail-head">
        <div>
          <h2 class="detail-title">${escapeHtml(s.name)}</h2>
          <div class="detail-sub">
            <b>${escapeHtml(initial(d.name))}</b> · ${escapeHtml(d.region)} · ${escapeHtml(data.period)}
          </div>
        </div>
        <div class="plan-badge">
          <div class="plan-pill ${pillClass}"><span class="d"></span> ${statusLabel}</div>
          <div class="plan-label" style="margin-top:14px">Выполнение плана</div>
          <div class="plan-val ${pillClass}">${s.planPercent || 0}%</div>
        </div>
      </header>

      <div class="detail-body">
        <div class="kpi-row">
          <div class="kpi primary">
            <div class="kpi-label">Выручка, факт</div>
            <div class="kpi-value">${escapeHtml(s.revenue?.value)}<span class="unit">${escapeHtml(s.revenue?.unit)}</span></div>
            <div class="kpi-deltas">
              ${deltaHtml(s.revenue?.mom, 'MoM')}
              ${deltaHtml(s.revenue?.yoy, 'YoY')}
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Продано пар / шт</div>
            <div class="kpi-value">${fmtNum(s.pairs?.value)}</div>
            <div class="kpi-deltas">${deltaHtml(s.pairs?.mom, 'MoM')}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Чеки (транзакции)</div>
            <div class="kpi-value">${fmtNum(s.tx?.value)}</div>
            <div class="kpi-deltas">${deltaHtml(s.tx?.mom, 'MoM')}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Средний чек</div>
            <div class="kpi-value">${escapeHtml(s.avg?.value)}<span class="unit">${escapeHtml(s.avg?.unit)}</span></div>
            <div class="kpi-deltas">${deltaHtml(s.avg?.mom, 'MoM')}</div>
          </div>
        </div>

        <div class="chart-row">
          <div class="chart-card">
            <div class="chart-head">
              <div class="chart-title">Тренд выручки · 6 мес</div>
              <div class="chart-legend">
                <span><i></i> ${escapeHtml(yearOf(data.period))}</span>
                <span><i class="dashed"></i> YoY</span>
              </div>
            </div>
            <div class="chart-body">${trendChart(s.trend||[], s.trendPy||[])}</div>
          </div>
          <div class="chart-card">
            <div class="chart-head">
              <div class="chart-title">План / Факт · по неделям</div>
              <div class="chart-legend">
                <span><i class="boxg"></i> План</span>
                <span><i class="box"></i> Факт</span>
              </div>
            </div>
            <div class="chart-body">${weeksChart(s.weeks||[])}</div>
          </div>
        </div>

        <div class="sec-row">
          <div class="sec"><div class="sec-label">UPT · товаров в чеке</div><div class="sec-value">${s.upt ?? '—'}</div></div>
          <div class="sec"><div class="sec-label">Конверсия</div><div class="sec-value">${s.conversion ?? 0}<span class="unit">%</span></div></div>
          <div class="sec"><div class="sec-label">Возвраты</div><div class="sec-value">${s.returns ?? 0}<span class="unit">%</span></div></div>
          <div class="sec"><div class="sec-label">Продажи / сотрудник</div><div class="sec-value">${escapeHtml(s.spe?.value)}<span class="unit">${escapeHtml(s.spe?.unit)}</span></div></div>
        </div>

        <div class="traffic">
          <span class="traffic-label">Светофор</span>
          ${Object.entries(s.traffic||{}).map(([k,v])=>`
            <span class="traffic-item ${v}"><span class="dot"></span> ${escapeHtml(k)}</span>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/* ---------- Extra section slides ------------------------- */
function sectionSlide(title, role, cards, notes, extra = '') {
  return `
    <div class="detail">
      <div class="detail-top-band"></div>
      <header class="detail-head">
        <div>
          <h2 class="detail-title">${escapeHtml(title)}</h2>
          <div class="detail-sub"><b>${escapeHtml(role)}</b> · ${escapeHtml(data.period)}</div>
        </div>
      </header>
      <div class="detail-body">
        <div class="kpi-row">
          ${cards.map(c => `
            <div class="kpi ${c.primary ? 'primary' : ''}">
              <div class="kpi-label">${escapeHtml(c.label)}</div>
              <div class="kpi-value">${escapeHtml(c.value)}${c.unit?`<span class="unit">${escapeHtml(c.unit)}</span>`:''}</div>
              ${c.sub ? `<div class="kpi-deltas"><span class="delta"><span class="lbl">${escapeHtml(c.sub)}</span></span></div>` : ''}
            </div>
          `).join('')}
        </div>
        ${extra}
        ${notes ? `
          <div class="summary-notes" style="margin-top:14px">
            <div class="lbl">Комментарий и выводы</div>
            <div class="txt">${escapeHtml(notes)}</div>
          </div>` : ''}
      </div>
    </div>
  `;
}

function renderProduct(d) {
  const cards = [
    { label:'Топ продукт месяца', value: d.topProduct?.name || '—', sub: d.topProduct?.units ? `${fmtNum(d.topProduct.units)} шт · ${d.topProduct?.revenue||''}` : '', primary:true },
    { label:'Новых SKU введено', value: fmtNum(d.newSku||0) },
    { label:'Оборачиваемость', value: d.turnover||0, unit:'дней' },
    { label:'Категорий в топе',  value: (d.topCategories||[]).length }
  ];
  const extra = (d.topCategories||[]).length ? `
    <div class="cats-display" style="margin-top:14px">
      ${(d.topCategories||[]).map(c=>`
        <div class="cat-display-row">
          <div class="cat-name">${escapeHtml(c.name||'—')}</div>
          <div class="cat-bar"><div style="width:${Math.min(100, +c.share||0)}%"></div></div>
          <div class="cat-share">${+c.share||0}%</div>
          <div class="cat-rev">${escapeHtml(c.revenue||'')}</div>
        </div>
      `).join('')}
    </div>` : '';
  return sectionSlide('Продуктовая аналитика', 'Продукт-менеджер', cards, d.notes, extra);
}

function renderHR(d) {
  const fact = +d.headcountFact||0, plan = +d.headcountPlan||0;
  const fill = plan ? Math.round(fact/plan*100) : 0;
  const cards = [
    { label:'Штат · факт / план', value: `${fmtNum(fact)} / ${fmtNum(plan)}`, sub: `${fill}% заполнено`, primary:true },
    { label:'Текучесть', value: d.turnover||0, unit:'%' },
    { label:'Обучено за месяц', value: fmtNum(d.trained||0), unit:'чел' },
    { label:'Открытых вакансий', value: fmtNum(d.openVacancies||0) },
    { label:'eNPS', value: d.enps||0 },
    { label:'Лучшая команда', value: d.topTeam || '—' }
  ];
  return sectionSlide('HR · кадры и обучение', 'HR-директор', cards, d.notes);
}

function renderWarehouse(d) {
  const cards = [
    { label:'Остатки', value: fmtNum(d.stockUnits||0), unit:'пар', primary:true },
    { label:'Стоимость остатков', value: d.stockValue || '—' },
    { label:'Покрытие 30 / 60 / 90 дн.', value: `${d.cover30||0} / ${d.cover60||0} / ${d.cover90||0}`, unit:'%' },
    { label:'Среднее время поставки', value: d.leadTime||0, unit:'дней' },
    { label:'Списания', value: d.writeOffs || '—' },
    { label:'Топ-дефицит', value: d.topShortage || '—' }
  ];
  return sectionSlide('Склад и поставки', 'Управляющий складом', cards, d.notes);
}

function renderMarketing(d) {
  const cards = [
    { label: 'Рекл. бюджет',       value: d.budget || '—',            primary: true },
    { label: 'Охват',              value: d.reach || 0,               unit: 'млн' },
    { label: 'Визитов на сайт',    value: fmtNum(d.visits || 0) },
    { label: 'CAC',                value: fmtNum(d.cac || 0),         unit: 'сум' },
    { label: 'Конверсия онлайн',   value: d.convOnline || 0,          unit: '%' },
    { label: 'Подписчиков',        value: fmtNum(d.socialFollowers || 0) }
  ];
  const extra = d.bestCampaign ? `
    <div class="summary-notes" style="margin-top:14px;background:var(--ink);color:#fff;border-color:var(--ink)">
      <div class="lbl" style="color:rgba(255,255,255,.5)">Лучшая кампания месяца</div>
      <div class="txt" style="font-size:24px;font-weight:800;letter-spacing:-.01em">${escapeHtml(d.bestCampaign)}</div>
    </div>` : '';
  return sectionSlide('Маркетинг · трафик и кампании', 'Директор по маркетингу', cards, d.notes, extra);
}

/* ---------- Summary -------------------------------------- */
function renderSummary() {
  const directors = currentDirectorIdx === null ? data.directors : [data.directors[currentDirectorIdx]];
  let stores = [];
  directors.forEach(d => (d.stores||[]).forEach(s => stores.push({d,s})));
  const totalRevenue = stores.reduce((sum,{s}) => sum + parseFloat((s.revenue?.value+'').replace(',','.')||0), 0);
  const totalPairs   = stores.reduce((sum,{s}) => sum + (+s.pairs?.value || 0), 0);
  const totalTx      = stores.reduce((sum,{s}) => sum + (+s.tx?.value || 0), 0);
  const avgPlan      = stores.length ? Math.round(stores.reduce((sum,{s}) => sum + (+s.planPercent||0), 0) / stores.length) : 0;

  return `
    <div class="summary">
      <div class="detail-top-band"></div>
      <div class="summary-head">
        <div class="sub">Итоги периода · ${escapeHtml(data.period)}</div>
        <h1>Итоги ${directors.length === data.directors.length ? 'месяца' : escapeHtml(directors[0].region || '')}</h1>
      </div>
      <div class="summary-cards">
        <div class="kpi primary">
          <div class="kpi-label">Суммарная выручка</div>
          <div class="kpi-value">${totalRevenue.toFixed(2)}<span class="unit">млрд сум</span></div>
          <div class="kpi-deltas"><span class="delta"><span class="lbl">магазинов</span> ${stores.length}</span></div>
        </div>
        <div class="kpi"><div class="kpi-label">Продано пар</div><div class="kpi-value">${fmtNum(totalPairs)}</div></div>
        <div class="kpi"><div class="kpi-label">Транзакции</div><div class="kpi-value">${fmtNum(totalTx)}</div></div>
        <div class="kpi"><div class="kpi-label">Средн. выполнение плана</div><div class="kpi-value">${avgPlan}<span class="unit">%</span></div></div>
      </div>
      <div class="summary-notes">
        <div class="lbl">Ключевые выводы и план действий</div>
        <div class="txt">${escapeHtml(data.summary?.note||'')}</div>
      </div>
    </div>
  `;
}

/* ---------- Helpers -------------------------------------- */
function deltaHtml(v, label) {
  if (v == null || v === '') return '';
  v = +v;
  const cls = v >= 0 ? 'up' : 'down';
  const arrow = v >= 0 ? '▲' : '▼';
  const sign = v > 0 ? '+' : '';
  return `<span class="delta ${cls}">${arrow} ${sign}${v}% <span class="lbl">${label}</span></span>`;
}
function fmtNum(n) {
  if (n == null || n === '' || isNaN(+n)) return n || 0;
  return (+n).toLocaleString('ru-RU').replace(/,/g,' ');
}
function escapeHtml(s) {
  if (s == null) return '';
  return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function initial(fullName) {
  const parts = (fullName||'').trim().split(/\s+/);
  if (parts.length < 2) return fullName||'';
  return parts[0][0].toUpperCase() + '. ' + parts.slice(1).join(' ');
}
function monthShort(period) { return (period || '').split(' ')[0] || period || ''; }
function yearOf(period) {
  const m = (period||'').match(/\b(20\d{2})\b/);
  return m ? m[1] : '';
}

/* ---------- SVG charts ----------------------------------- */
function trendChart(curr, prev) {
  if (!curr.length) return '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#bbb;font-family:JetBrains Mono;font-size:11px;letter-spacing:.2em">НЕТ ДАННЫХ</div>';
  const W = 600, H = 200, P = 14;
  const all = [...curr, ...(prev||[])];
  const max = Math.max(...all.map(v=>+v||0), 1);
  const stepX = (W - P*2) / Math.max(1, curr.length - 1);
  const y = v => H - P - ((+v||0) / max) * (H - P*2);
  const pts = arr => arr.map((v,i) => `${P + i*stepX},${y(v)}`).join(' ');
  const area = curr.map((v,i) => `${P + i*stepX},${y(v)}`)
    .concat([`${P + (curr.length-1)*stepX},${H-P}`, `${P},${H-P}`]).join(' ');
  const dots = curr.map((v,i) => `<circle cx="${P + i*stepX}" cy="${y(v)}" r="4" fill="#fff" stroke="#e1241c" stroke-width="2"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <line x1="${P}" y1="${H-P}" x2="${W-P}" y2="${H-P}" stroke="#e8e2d2" stroke-width="1" stroke-dasharray="2 4"/>
    <line x1="${P}" y1="${H/2}" x2="${W-P}" y2="${H/2}" stroke="#eee5d2" stroke-width="1" stroke-dasharray="2 4"/>
    <polygon points="${area}" fill="rgba(225,36,28,.07)"/>
    ${prev && prev.length ? `<polyline points="${pts(prev)}" fill="none" stroke="#9b958a" stroke-width="2" stroke-dasharray="6 5"/>` : ''}
    <polyline points="${pts(curr)}" fill="none" stroke="#e1241c" stroke-width="2.5"/>
    ${dots}
  </svg>`;
}
function weeksChart(weeks) {
  if (!weeks.length) return '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#bbb;font-family:JetBrains Mono;font-size:11px;letter-spacing:.2em">НЕТ ДАННЫХ</div>';
  const W = 600, H = 200, P = 14;
  const groupW = (W - P*2) / weeks.length;
  const barW = groupW * 0.32;
  const gap = groupW * 0.06;
  const max = Math.max(...weeks.flat().map(v=>+v||0), 1);
  const y = v => H - P - ((+v||0) / max) * (H - P*2 - 20);
  let bars = '';
  weeks.forEach(([plan,fact], i) => {
    const cx = P + i*groupW + groupW/2;
    const x1 = cx - barW - gap/2;
    const x2 = cx + gap/2;
    bars += `
      <rect x="${x1}" y="${y(plan)}" width="${barW}" height="${H-P-y(plan)}" rx="3" fill="#dcd5c4"/>
      <rect x="${x2}" y="${y(fact)}" width="${barW}" height="${H-P-y(fact)}" rx="3" fill="#e1241c"/>
      <text x="${cx}" y="${H-2}" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#8a8a8a">Н${i+1}</text>
    `;
  });
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <line x1="${P}" y1="${H-P}" x2="${W-P}" y2="${H-P}" stroke="#e8e2d2" stroke-width="1"/>
    ${bars}
  </svg>`;
}

/* ---------- Deck-clicks + keys --------------------------- */
function wireDeckClicks() {
  document.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => {
      const goIdx = +el.dataset.go;
      const meta = pageMeta(pageIndex);
      if (meta.type === 'intro') { pageIndex += 1 + goIdx; render(); }
    });
  });
}

function next() { pageIndex++; render(); }
function prev() { pageIndex--; render(); }

document.addEventListener('keydown', (e) => {
  const deckOpen = !document.getElementById('deck').classList.contains('hidden');
  if (!deckOpen) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
  if (e.key === 'ArrowLeft'  || e.key === 'PageUp') { e.preventDefault(); prev(); }
  if (e.key === 'h' || e.key === 'H') { e.preventDefault(); goHome(); }
  if (e.key === 'e' || e.key === 'E') { e.preventDefault(); location.href = 'mbr-editor.html'; }
  if (e.key === 'Home') { pageIndex = 0; render(); }
  if (e.key === 'End')  { pageIndex = totalPages()-1; render(); }
});

/* ---------- Live update pulse ---------------------------- */
function flashLiveUpdate() {
  const pill = document.getElementById('livePill');
  if (!pill) return;
  pill.classList.add('on');
  setTimeout(() => pill.classList.remove('on'), 1400);
}
