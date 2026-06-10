/* =========================================================
   MBR · общий клиент Supabase + хелперы для работы с данными
   Подключается до mbr.js / mbr-editor.js
   ========================================================= */

const SB_URL = 'https://dgyirginrefvjsbhhooi.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRneWlyZ2lucmVmdmpzYmhob29pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MDUzNjgsImV4cCI6MjA5MzI4MTM2OH0.A-ueG5j_wcxZ7joJM645hrImLwFYjz_SM4ATLTc0cfU';

const SB = window.supabase.createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mbr-sb-auth' }
});

const SECTIONS = ['meta','director_1','director_2','director_3','product','hr','warehouse','marketing'];

const ROLE_LABEL = {
  director:        'Региональный директор',
  product_manager: 'Продукт-менеджер',
  hr:              'HR-директор',
  warehouse:       'Управляющий складом',
  marketing:       'Директор по маркетингу',
  admin:           'Администратор'
};

/* ---------- Auth ----------------------------------------- */
async function sbGetUser() {
  const { data: { user } } = await SB.auth.getUser();
  return user;
}
async function sbGetProfile() {
  const user = await sbGetUser();
  if (!user) return null;
  const { data } = await SB.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data;
}
async function sbSignOut() { await SB.auth.signOut(); }

async function sbRequireAuth(redirectTo = 'mbr-login.html') {
  const user = await sbGetUser();
  if (!user) {
    const ret = encodeURIComponent(location.pathname.split('/').pop() || 'mbr.html');
    location.replace(`${redirectTo}?return=${ret}`);
    return null;
  }
  return user;
}

/* ---------- Period --------------------------------------- */
async function sbGetCurrentPeriod() {
  const { data, error } = await SB.from('mbr_periods').select('*').eq('is_current', true).maybeSingle();
  if (error) console.warn('period', error);
  return data;
}

/* ---------- Data ----------------------------------------- */
async function sbLoadAllSections(periodId) {
  const { data, error } = await SB.from('mbr_data').select('section, data, updated_at, updated_by').eq('period_id', periodId);
  if (error) { console.warn('load sections', error); return {}; }
  const out = {};
  (data || []).forEach(r => { out[r.section] = r.data; });
  return out;
}

async function sbSaveSection(periodId, section, data) {
  const user = await sbGetUser();
  const payload = {
    period_id: periodId,
    section,
    data,
    updated_at: new Date().toISOString(),
    updated_by: user ? user.id : null
  };
  const { error } = await SB.from('mbr_data').upsert(payload, { onConflict: 'period_id,section' });
  if (error) { console.error('save', error); throw error; }
}

/* ---------- Realtime ------------------------------------- */
function sbSubscribeSections(periodId, onChange) {
  return SB.channel(`mbr_data_${periodId}`)
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'mbr_data', filter: `period_id=eq.${periodId}` },
        (payload) => onChange(payload))
    .subscribe();
}

/* ---------- Section ↔ role mapping ----------------------- */
function sectionForProfile(p) {
  if (!p) return null;
  switch (p.role) {
    case 'director':        return p.director_slot ? `director_${p.director_slot}` : null;
    case 'product_manager': return 'product';
    case 'hr':              return 'hr';
    case 'warehouse':       return 'warehouse';
    case 'marketing':       return 'marketing';
    case 'admin':           return null; // admin can pick any
    default:                return null;
  }
}

/* ---------- Build deck data from sections ---------------- */
function buildDeckData(sections) {
  const meta = sections.meta || { period: '—', regions: [], summary: { totalStores: 0, totalRegions: 0, note: '' } };
  const directors = [];
  for (let i = 1; i <= 3; i++) {
    const d = sections[`director_${i}`];
    if (d) directors.push(Object.assign({ id: `d${i}`, stores: [] }, d));
  }
  return {
    period:    meta.period || '—',
    regions:   meta.regions || [],
    summary:   meta.summary || {},
    directors,
    product:   sections.product   || {},
    hr:        sections.hr        || {},
    warehouse: sections.warehouse || {},
    marketing: sections.marketing || {}
  };
}
