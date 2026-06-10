/* =========================================================
   MBR — Monthly Business Review · Li-Ning UZ
   Логика презентации, редактирования и сохранения данных
   ========================================================= */

const STORAGE_KEY = 'mbr-li-ning-uz-v1';

/* ---------- Default data ----------------------------------- */
const DEFAULT_DATA = {
  period: 'Май 2026',
  regions: [
    { name: 'Ташкент', count: 11 },
    { name: 'Самарканд', count: 2 },
    { name: 'Андижан', count: 1 }
  ],
  summary: {
    totalStores: 14,
    totalRegions: 3,
    note: 'Шаблон MBR · заменяйте показатели по каждому магазину перед собранием.'
  },
  directors: [
    {
      id: 'd1',
      name: 'Бобур Алиев',
      role: 'Региональный директор',
      region: 'Ташкент-Центр',
      photo: '',
      stores: [
        store('Compass · Чиланзар',   'ТРЦ Compass',     'green',  104, '1.82', 'млрд сум', 12, 24, 5290, 9,  2940, 6, '619', 'тыс', 3,  1.8, 31, 2.1, '228', 'млн'),
        store('Mega Planet',           'ТРЦ Mega Planet', 'yellow',  96, '1.41', 'млрд сум',  4, 11, 4120, 2,  2350, -1,'601', 'тыс', 1,  1.7, 28, 2.8, '198', 'млн'),
        store('Next · Юнусабад',       'ТРЦ Next',        'green',  101, '1.55', 'млрд сум',  7, 18, 4540, 5,  2610, 3, '593', 'тыс', 2,  1.7, 30, 1.9, '210', 'млн'),
        store('Riverside Mall',        'Riverside',       'yellow',  92, '1.18', 'млрд сум', -2,  9, 3520, -3, 2080, -4,'567', 'тыс', 1,  1.7, 27, 3.2, '176', 'млн'),
        store('Compass · Мирзо',       'Мирзо-Улугбек',   'green',   99, '1.49', 'млрд сум',  6, 14, 4380, 4,  2520, 2, '591', 'тыс', 2,  1.7, 29, 2.3, '205', 'млн')
      ]
    },
    {
      id: 'd2',
      name: 'Дилшод Каримов',
      role: 'Региональный директор',
      region: 'Ташкент-Юг · Самарканд',
      photo: '',
      stores: [
        store('Tashkent City Mall',    'TCM',             'green',  108, '2.05', 'млрд сум', 14, 27, 5860, 11, 3210, 8, '638', 'тыс', 4,  1.9, 33, 1.8, '241', 'млн'),
        store('Magic City',            'ТРЦ Magic City',  'green',  103, '1.72', 'млрд сум',  9, 19, 4890, 6,  2790, 4, '617', 'тыс', 2,  1.8, 31, 2.0, '218', 'млн'),
        store('Atlas Mall · Сергели',  'ТРЦ Atlas',       'yellow',  94, '1.24', 'млрд сум',  1, 10, 3640, 0,  2150, -2,'577', 'тыс', 1,  1.7, 28, 2.7, '184', 'млн'),
        store('Самарканд · Riviera',   'ТРЦ Riviera',     'green',  102, '1.61', 'млрд сум',  8, 16, 4620, 5,  2680, 3, '600', 'тыс', 2,  1.7, 30, 2.1, '212', 'млн'),
        store('Самарканд · Centre',    'ул. Регистан',    'red',    87, '0.98', 'млрд сум', -7,  4, 2940, -8, 1820, -5,'539', 'тыс', -1, 1.6, 25, 3.6, '154', 'млн')
      ]
    },
    {
      id: 'd3',
      name: 'Жасур Турсунов',
      role: 'Региональный директор',
      region: 'Ташкент-Север · Андижан',
      photo: '',
      stores: [
        store('Samarqand Darvoza',     'ТРЦ S. Darvoza',  'green',  106, '1.94', 'млрд сум', 13, 22, 5510, 9,  3080, 7, '630', 'тыс', 3,  1.8, 32, 1.9, '233', 'млн'),
        store('Korzinka · Сайрам',     'Сайрамский р-н',  'yellow',  95, '1.32', 'млрд сум',  3, 11, 3820, 1,  2240, 0, '589', 'тыс', 1,  1.7, 28, 2.5, '188', 'млн'),
        store('Yunusobod · Plaza',     'ТРЦ Plaza',       'green',  100, '1.51', 'млрд сум',  6, 15, 4430, 4,  2560, 2, '590', 'тыс', 2,  1.7, 30, 2.2, '207', 'млн'),
        store('Андижан · City Mall',   'ТРЦ City Mall',   'yellow',  93, '1.21', 'млрд сум',  0,  8, 3550, -1, 2110, -2,'574', 'тыс', 1,  1.7, 27, 2.9, '180', 'млн')
      ]
    }
  ]
};

function store(name, mall, status, plan, rev, revU, mom, yoy, pairs, pairsMom, tx, txMom, avg, avgU, avgMom, upt, conv, ret, spe, speU) {
  return {
    name, mall, status, planPercent: plan,
    revenue: { value: rev, unit: revU, mom, yoy },
    pairs:   { value: pairs, mom: pairsMom },
    tx:      { value: tx, mom: txMom },
    avg:     { value: avg, unit: avgU, mom: avgMom },
    upt, conversion: conv, returns: ret,
    spe: { value: spe, unit: speU },
    trend:    [38, 44, 41, 62, 70, 88].map(v => v + Math.round((Math.random()-.5)*4)),
    trendPy:  [30, 36, 34, 40, 48, 55],
    weeks:    [[60,80],[58,72],[78,90],[72,64]],
    traffic: {
      'план': status, 'трафик': 'green', 'конверсия': status==='red'?'red':'yellow',
      'средний чек': 'green', 'возвраты': status==='red'?'red':'green', 'персонал': 'yellow'
    },
    notes: ''
  };
}

/* ---------- State ------------------------------------------ */
let data = loadData();
let currentDirectorIdx = null; // null = all
let pageIndex = 0;
let editMode = false;

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // shallow merge so future defaults appear if missing
      return Object.assign(JSON.parse(JSON.stringify(DEFAULT_DATA)), parsed);
    }
  } catch (e) { console.warn('load failed', e); }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}
function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) { console.warn('save failed', e); }
}
function resetAll() {
  if (!confirm('Сбросить все данные к шаблону по умолчанию?')) return;
  localStorage.removeItem(STORAGE_KEY);
  data = JSON.parse(JSON.stringify(DEFAULT_DATA));
  renderSelect();
  if (!document.getElementById('deck').classList.contains('hidden')) render();
  toast('Данные сброшены');
}

/* ---------- Select screen ---------------------------------- */
function renderSelect() {
  const grid = document.getElementById('directorGrid');
  grid.innerHTML = '';
  data.directors.forEach((d, i) => {
    const card = document.createElement('button');
    card.className = 'director-card';
    card.innerHTML = `
      <div class="dc-avatar">фото<br>директора</div>
      <div class="dc-body">
        <div class="dc-role">${escapeHtml(d.role)} · ${i+1} / ${data.directors.length}</div>
        <div class="dc-name">${escapeHtml(d.name)}</div>
        <div class="dc-meta">${escapeHtml(d.region)} · ${d.stores.length} магазинов</div>
      </div>
      <div class="dc-arrow">›</div>
    `;
    card.onclick = () => openDeck(i);
    grid.appendChild(card);
  });
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
  renderSelect();
}

/* ---------- Page count / navigation ------------------------ */
function totalPages() {
  if (currentDirectorIdx === null) {
    // full deck: cover + (intro + stores) for each director + summary
    return 1 + data.directors.reduce((s, d) => s + 1 + d.stores.length, 0) + 1;
  }
  const d = data.directors[currentDirectorIdx];
  return 1 + 1 + d.stores.length + 1; // cover + intro + stores + summary
}

function pageMeta(idx) {
  // returns {type, director?, store?}
  const directors = currentDirectorIdx === null
    ? data.directors
    : [data.directors[currentDirectorIdx]];

  if (idx === 0) return { type: 'cover' };
  let i = 1;
  for (const d of directors) {
    if (idx === i) return { type: 'intro', director: d };
    i++;
    for (const s of d.stores) {
      if (idx === i) return { type: 'store', director: d, store: s };
      i++;
    }
  }
  return { type: 'summary' };
}

/* ---------- Render dispatcher ------------------------------ */
function render() {
  const total = totalPages();
  if (pageIndex < 0) pageIndex = 0;
  if (pageIndex >= total) pageIndex = total - 1;
  const meta = pageMeta(pageIndex);
  const root = document.getElementById('slide');
  root.classList.toggle('edit-on', editMode);

  switch (meta.type) {
    case 'cover':   root.innerHTML = renderCover(); break;
    case 'intro':   root.innerHTML = renderIntro(meta.director); break;
    case 'store':   root.innerHTML = renderStore(meta.director, meta.store); break;
    case 'summary': root.innerHTML = renderSummary(); break;
  }
  document.getElementById('pageIndicator').textContent = `${pageIndex+1} / ${total}`;
  wireEditable();
}

/* ---------- Cover ------------------------------------------ */
function renderCover() {
  const period = data.period;
  const note = data.summary.note;
  const totalStores = data.directors.reduce((s,d)=>s+d.stores.length,0);
  return `
    <div class="split">
      <div class="split-left">
        <div class="top-band"></div>
        <div>
          <span class="brand-badge" data-edit data-path="brand">LI-NING UZ</span>
        </div>
        <div>
          <h1 class="cover-mbr">M<span class="b">B</span>R</h1>
          <div class="cover-subtitle">Monthly Business Review<br>Ежемесячный разбор результатов</div>
        </div>
        <div class="foot">
          <span class="chip"><span data-edit data-path="summary.totalStores">${totalStores}</span>&nbsp;магазинов · <span data-edit data-path="summary.totalRegions">${data.summary.totalRegions}</span>&nbsp;региона</span>
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
          <div class="period" data-edit data-path="period">${escapeHtml(period)}</div>
          <div class="region-chips">
            ${data.regions.map((r,i)=>`
              <span class="region-chip">
                <span data-edit data-path="regions.${i}.name">${escapeHtml(r.name)}</span> ·
                <span class="v" data-edit data-path="regions.${i}.count">${r.count}</span>
              </span>
            `).join('')}
          </div>
        </div>
        <div class="foot" data-edit data-path="summary.note">${escapeHtml(note)}</div>
      </div>
    </div>
  `;
}

/* ---------- Director intro --------------------------------- */
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
            <div class="dir-role">${escapeHtml(d.role)} · ${idx+1} / ${data.directors.length}</div>
            <h2 class="dir-name" data-edit data-path="directors.${idx}.name">${escapeHtml(d.name)}</h2>
            <div class="dir-region">Регион: <span data-edit data-path="directors.${idx}.region">${escapeHtml(d.region)}</span> · ${d.stores.length} магазинов</div>
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
            <span>${d.stores.length} точек · отвечает ${escapeHtml(d.name.split(' ').slice(-1)[0])}</span>
            <span>% выполнения плана · ${escapeHtml(monthShort(data.period))}</span>
          </div>
          <div class="stores-list">
            ${d.stores.map((s, si) => `
              <div class="store-row" data-go="${si}">
                <span class="sl-dot ${s.status}"></span>
                <div>
                  <div class="sl-name" data-edit data-path="directors.${idx}.stores.${si}.name">${escapeHtml(s.name)}</div>
                  <div class="sl-mall" data-edit data-path="directors.${idx}.stores.${si}.mall">${escapeHtml(s.mall)}</div>
                </div>
                <div class="sl-bar"><div style="width:${Math.min(100, s.planPercent)}%"></div></div>
                <div class="sl-pct" data-edit data-path="directors.${idx}.stores.${si}.planPercent">${s.planPercent}%</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="foot">Кликните по строке, чтобы открыть карточку магазина</div>
      </div>
    </div>
  `;
}

/* ---------- Store detail ----------------------------------- */
function renderStore(d, s) {
  const dIdx = data.directors.indexOf(d);
  const sIdx = d.stores.indexOf(s);
  const statusLabel = s.planPercent >= 100 ? 'План выполнен' : (s.planPercent >= 95 ? 'Близко к плану' : 'Ниже плана');
  const pillClass = s.status; // green/yellow/red
  return `
    <div class="detail">
      <div class="detail-top-band"></div>
      <header class="detail-head">
        <div>
          <h2 class="detail-title" data-edit data-path="directors.${dIdx}.stores.${sIdx}.name">${escapeHtml(s.name)}</h2>
          <div class="detail-sub">
            <b>${escapeHtml(initial(d.name))}</b> · <span data-edit data-path="directors.${dIdx}.region">${escapeHtml(d.region)}</span> · <span data-edit data-path="period">${escapeHtml(data.period)}</span>
          </div>
        </div>
        <div class="plan-badge">
          <div class="plan-pill ${pillClass}"><span class="d"></span> ${statusLabel}</div>
          <div class="plan-label" style="margin-top:14px">Выполнение плана</div>
          <div class="plan-val ${pillClass}"><span data-edit data-path="directors.${dIdx}.stores.${sIdx}.planPercent">${s.planPercent}</span>%</div>
        </div>
      </header>

      <div class="detail-body">
        <div class="kpi-row">
          <div class="kpi primary">
            <div class="kpi-label">Выручка, факт</div>
            <div class="kpi-value"><span data-edit data-path="directors.${dIdx}.stores.${sIdx}.revenue.value">${s.revenue.value}</span><span class="unit" data-edit data-path="directors.${dIdx}.stores.${sIdx}.revenue.unit">${s.revenue.unit}</span></div>
            <div class="kpi-deltas">
              ${deltaHtml(s.revenue.mom, `directors.${dIdx}.stores.${sIdx}.revenue.mom`, 'MoM')}
              ${deltaHtml(s.revenue.yoy, `directors.${dIdx}.stores.${sIdx}.revenue.yoy`, 'YoY')}
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Продано пар / шт</div>
            <div class="kpi-value"><span data-edit data-path="directors.${dIdx}.stores.${sIdx}.pairs.value">${fmtNum(s.pairs.value)}</span></div>
            <div class="kpi-deltas">${deltaHtml(s.pairs.mom, `directors.${dIdx}.stores.${sIdx}.pairs.mom`, 'MoM')}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Чеки (транзакции)</div>
            <div class="kpi-value"><span data-edit data-path="directors.${dIdx}.stores.${sIdx}.tx.value">${fmtNum(s.tx.value)}</span></div>
            <div class="kpi-deltas">${deltaHtml(s.tx.mom, `directors.${dIdx}.stores.${sIdx}.tx.mom`, 'MoM')}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Средний чек</div>
            <div class="kpi-value"><span data-edit data-path="directors.${dIdx}.stores.${sIdx}.avg.value">${s.avg.value}</span><span class="unit" data-edit data-path="directors.${dIdx}.stores.${sIdx}.avg.unit">${s.avg.unit}</span></div>
            <div class="kpi-deltas">${deltaHtml(s.avg.mom, `directors.${dIdx}.stores.${sIdx}.avg.mom`, 'MoM')}</div>
          </div>
        </div>

        <div class="chart-row">
          <div class="chart-card">
            <div class="chart-head">
              <div class="chart-title">Тренд выручки · 6 мес</div>
              <div class="chart-legend">
                <span><i></i> 2026</span>
                <span><i class="dashed"></i> 2025 (YoY)</span>
              </div>
            </div>
            <div class="chart-body">${trendChart(s.trend, s.trendPy)}</div>
          </div>
          <div class="chart-card">
            <div class="chart-head">
              <div class="chart-title">План / Факт · по неделям</div>
              <div class="chart-legend">
                <span><i class="boxg"></i> План</span>
                <span><i class="box"></i> Факт</span>
              </div>
            </div>
            <div class="chart-body">${weeksChart(s.weeks)}</div>
          </div>
        </div>

        <div class="sec-row">
          <div class="sec">
            <div class="sec-label">UPT · товаров в чеке</div>
            <div class="sec-value"><span data-edit data-path="directors.${dIdx}.stores.${sIdx}.upt">${s.upt}</span></div>
          </div>
          <div class="sec">
            <div class="sec-label">Конверсия</div>
            <div class="sec-value"><span data-edit data-path="directors.${dIdx}.stores.${sIdx}.conversion">${s.conversion}</span><span class="unit">%</span></div>
          </div>
          <div class="sec">
            <div class="sec-label">Возвраты</div>
            <div class="sec-value"><span data-edit data-path="directors.${dIdx}.stores.${sIdx}.returns">${s.returns}</span><span class="unit">%</span></div>
          </div>
          <div class="sec">
            <div class="sec-label">Продажи / сотрудник</div>
            <div class="sec-value"><span data-edit data-path="directors.${dIdx}.stores.${sIdx}.spe.value">${s.spe.value}</span><span class="unit" data-edit data-path="directors.${dIdx}.stores.${sIdx}.spe.unit">${s.spe.unit}</span></div>
          </div>
        </div>

        <div class="traffic">
          <span class="traffic-label">Светофор</span>
          ${Object.entries(s.traffic).map(([k,v]) => `
            <span class="traffic-item ${v}" data-toggle-traffic="${dIdx}|${sIdx}|${k}">
              <span class="dot"></span> ${escapeHtml(k)}
            </span>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/* ---------- Summary slide ---------------------------------- */
function renderSummary() {
  const directors = currentDirectorIdx === null
    ? data.directors
    : [data.directors[currentDirectorIdx]];

  let stores = [];
  directors.forEach(d => d.stores.forEach(s => stores.push({d,s})));
  const totalRevenue = stores.reduce((sum,{s}) => sum + parseFloat((s.revenue.value+'').replace(',','.')||0), 0);
  const totalPairs   = stores.reduce((sum,{s}) => sum + (+s.pairs.value || 0), 0);
  const totalTx      = stores.reduce((sum,{s}) => sum + (+s.tx.value || 0), 0);
  const avgPlan      = Math.round(stores.reduce((sum,{s}) => sum + s.planPercent, 0) / Math.max(1, stores.length));

  return `
    <div class="summary">
      <div class="detail-top-band"></div>
      <div class="summary-head">
        <div class="sub">Итоги периода · ${escapeHtml(data.period)}</div>
        <h1>Итоги ${directors.length === data.directors.length ? 'месяца' : escapeHtml(directors[0].region)}</h1>
      </div>

      <div class="summary-cards">
        <div class="kpi primary">
          <div class="kpi-label">Суммарная выручка</div>
          <div class="kpi-value">${totalRevenue.toFixed(2)}<span class="unit">млрд сум</span></div>
          <div class="kpi-deltas"><span class="delta"><span class="lbl">магазинов</span> ${stores.length}</span></div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Продано пар</div>
          <div class="kpi-value">${fmtNum(totalPairs)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Транзакции</div>
          <div class="kpi-value">${fmtNum(totalTx)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Средн. выполнение плана</div>
          <div class="kpi-value">${avgPlan}<span class="unit">%</span></div>
        </div>
      </div>

      <div class="summary-notes">
        <div class="lbl">Ключевые выводы и план действий</div>
        <div class="txt" data-edit data-path="summary.note" data-multiline>${escapeHtml(data.summary.note)}</div>
      </div>
    </div>
  `;
}

/* ---------- Helpers ---------------------------------------- */
function deltaHtml(v, path, label) {
  const cls = v >= 0 ? 'up' : 'down';
  const arrow = v >= 0 ? '▲' : '▼';
  const sign = v > 0 ? '+' : '';
  return `<span class="delta ${cls}">${arrow} <span data-edit data-path="${path}">${sign}${v}</span>% <span class="lbl">${label}</span></span>`;
}
function fmtNum(n) {
  if (n == null || isNaN(+n)) return n;
  return (+n).toLocaleString('ru-RU').replace(/,/g,' ');
}
function escapeHtml(s) {
  if (s == null) return '';
  return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function initial(fullName) {
  const parts = (fullName||'').trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return parts[0][0].toUpperCase() + '. ' + parts.slice(1).join(' ');
}
function monthShort(period) {
  return (period || '').split(' ')[0] || period;
}

/* ---------- SVG charts ------------------------------------- */
function trendChart(curr, prev) {
  const W = 600, H = 200, P = 14;
  const all = [...curr, ...prev];
  const max = Math.max(...all, 1);
  const min = 0;
  const stepX = (W - P*2) / (curr.length - 1);
  const y = v => H - P - ((v - min) / (max - min)) * (H - P*2);
  const pts = arr => arr.map((v,i) => `${P + i*stepX},${y(v)}`).join(' ');
  const area = curr.map((v,i) => `${P + i*stepX},${y(v)}`).concat([`${P + (curr.length-1)*stepX},${H-P}`, `${P},${H-P}`]).join(' ');
  const dots = curr.map((v,i) => `<circle cx="${P + i*stepX}" cy="${y(v)}" r="4" fill="#fff" stroke="#e1241c" stroke-width="2"/>`).join('');
  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="${P}" y1="${H-P}" x2="${W-P}" y2="${H-P}" stroke="#e8e2d2" stroke-width="1" stroke-dasharray="2 4"/>
      <line x1="${P}" y1="${H/2}" x2="${W-P}" y2="${H/2}" stroke="#eee5d2" stroke-width="1" stroke-dasharray="2 4"/>
      <polygon points="${area}" fill="rgba(225,36,28,.07)"/>
      <polyline points="${pts(prev)}" fill="none" stroke="#9b958a" stroke-width="2" stroke-dasharray="6 5"/>
      <polyline points="${pts(curr)}" fill="none" stroke="#e1241c" stroke-width="2.5"/>
      ${dots}
    </svg>
  `;
}
function weeksChart(weeks) {
  const W = 600, H = 200, P = 14;
  const groupW = (W - P*2) / weeks.length;
  const barW = groupW * 0.32;
  const gap = groupW * 0.06;
  const max = Math.max(...weeks.flat(), 1);
  const y = v => H - P - (v / max) * (H - P*2 - 20);
  let bars = '';
  weeks.forEach(([plan,fact], i) => {
    const cx = P + i*groupW + groupW/2;
    const x1 = cx - barW - gap/2;
    const x2 = cx + gap/2;
    const yP = y(plan), yF = y(fact);
    bars += `
      <rect x="${x1}" y="${yP}" width="${barW}" height="${H-P-yP}" rx="3" fill="#dcd5c4"/>
      <rect x="${x2}" y="${yF}" width="${barW}" height="${H-P-yF}" rx="3" fill="#e1241c"/>
      <text x="${cx}" y="${H-2}" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="#8a8a8a">Н${i+1}</text>
    `;
  });
  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <line x1="${P}" y1="${H-P}" x2="${W-P}" y2="${H-P}" stroke="#e8e2d2" stroke-width="1"/>
      ${bars}
    </svg>
  `;
}

/* ---------- Editing ---------------------------------------- */
function wireEditable() {
  // store-row click navigation
  document.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (editMode) return; // don't navigate while editing
      const goIdx = +el.dataset.go;
      // find this director in the page order
      const meta = pageMeta(pageIndex);
      if (meta.type === 'intro') {
        pageIndex += 1 + goIdx;
        render();
      }
    });
  });

  // traffic toggle
  document.querySelectorAll('[data-toggle-traffic]').forEach(el => {
    el.addEventListener('click', () => {
      if (!editMode) return;
      const [dIdx, sIdx, key] = el.dataset.toggleTraffic.split('|');
      const cur = data.directors[+dIdx].stores[+sIdx].traffic[key];
      const next = cur === 'green' ? 'yellow' : cur === 'yellow' ? 'red' : 'green';
      data.directors[+dIdx].stores[+sIdx].traffic[key] = next;
      saveData();
      render();
    });
  });

  // editable cells
  document.querySelectorAll('[data-edit]').forEach(el => {
    el.contentEditable = editMode ? 'true' : 'false';
    if (!editMode) return;
    el.addEventListener('focus', () => { el.dataset.before = el.textContent; });
    el.addEventListener('blur', () => { commitEdit(el); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !el.hasAttribute('data-multiline')) {
        e.preventDefault();
        el.blur();
      }
      if (e.key === 'Escape') {
        el.textContent = el.dataset.before || '';
        el.blur();
      }
    });
  });
}

function commitEdit(el) {
  const path = el.dataset.path;
  if (!path) return;
  const raw = el.textContent.trim();
  // try number cast
  let val = raw;
  const numMatch = raw.replace(/\s/g,'').replace(',','.').match(/^[-+]?\d+(\.\d+)?$/);
  if (numMatch) val = parseFloat(raw.replace(/\s/g,'').replace(',','.').replace(/^\+/,''));

  // status percent path => recompute status colour
  setByPath(data, path, val);

  // recompute status for store if planPercent edited
  const m = path.match(/^directors\.(\d+)\.stores\.(\d+)\.planPercent$/);
  if (m) {
    const s = data.directors[+m[1]].stores[+m[2]];
    s.status = s.planPercent >= 100 ? 'green' : s.planPercent >= 93 ? 'yellow' : 'red';
  }

  saveData();
  // re-render to reflect derived fields (status colours, deltas formatting)
  render();
}

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

/* ---------- Export / Import -------------------------------- */
function exportJson() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mbr-${(data.period||'period').replace(/\s+/g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Файл скачан');
}
function importJson(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const obj = JSON.parse(e.target.result);
      if (!obj.directors) throw new Error('bad format');
      data = obj;
      saveData();
      renderSelect();
      if (!document.getElementById('deck').classList.contains('hidden')) render();
      toast('Данные импортированы');
    } catch (err) {
      alert('Не удалось импортировать файл: ' + err.message);
    }
  };
  reader.readAsText(file);
}

/* ---------- Toast ------------------------------------------ */
let toastT;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- Navigation & shortcuts ------------------------- */
function next() { pageIndex++; render(); }
function prev() { pageIndex--; render(); }

document.addEventListener('keydown', (e) => {
  if (e.target.isContentEditable) return;
  const deckOpen = !document.getElementById('deck').classList.contains('hidden');
  if (!deckOpen) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
  if (e.key === 'ArrowLeft'  || e.key === 'PageUp') { e.preventDefault(); prev(); }
  if (e.key === 'r' || e.key === 'R') { e.preventDefault(); resetAll(); }
  if (e.key === 'h' || e.key === 'H') { e.preventDefault(); goHome(); }
  if (e.key === 'e' || e.key === 'E') { e.preventDefault(); toggleEdit(); }
  if (e.key === 'Home') { pageIndex = 0; render(); }
  if (e.key === 'End')  { pageIndex = totalPages()-1; render(); }
});

function toggleEdit() {
  editMode = !editMode;
  document.getElementById('editBtn').classList.toggle('on', editMode);
  document.getElementById('editHint').classList.toggle('hidden', !editMode);
  render();
}

/* ---------- Init ------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  renderSelect();
  document.getElementById('openAllBtn').onclick = () => openDeck(null);
  document.getElementById('prevBtn').onclick = prev;
  document.getElementById('nextBtn').onclick = next;
  document.getElementById('homeBtn').onclick = goHome;
  document.getElementById('resetBtn').onclick = resetAll;
  document.getElementById('editBtn').onclick = toggleEdit;

  document.getElementById('selExport').onclick = exportJson;
  document.getElementById('selReset').onclick = resetAll;
  document.getElementById('selImport').onclick = () => document.getElementById('importFile').click();
  document.getElementById('importFile').onchange = (e) => {
    if (e.target.files && e.target.files[0]) importJson(e.target.files[0]);
  };
});
