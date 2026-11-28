/**
 * API & Persistence Layer:
 * - High-speed Google Apps Script integration (GET for reads, POST for mutations)
 * - Stale-while-revalidate client cache for 0ms startup rendering
 * - Offline / standalone LocalStorage fallback database
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbyL7DPUx_TkdpbwM4FBPVXExcn3GvnaUhXt7oYvoMqx0TcYyP0PF4desTwa9epJYVLIJA/exec';
const IS_GAS = typeof google !== 'undefined' && google.script && google.script.run;
const IS_LIVE = IS_GAS || !!API_URL;

const STORAGE_KEY = 'GUCKMAL_POS_LOCAL_V2';
const LIVE_CACHE_KEY = 'GUCKMAL_POS_LIVE_CACHE_V1';

/** Generates initial seed data when running completely offline without Google Sheets. */
function createLocalSeedState() {
  const imgs = typeof DEFAULT_IMAGES !== 'undefined' ? DEFAULT_IMAGES : {};
  const P = 'ถุงพลาสติก:1;กล่อง:1;ถ้วยน้ำจิ้ม:1;กระดาษไขรองกล่อง:0.5;ตะเกียบ:1;ค่าไฟ:1;ค่าน้ำมัน:10';
  const T = 'เนื้อสะโพกไก่กรอบ:92', B = 'ชังกี้ไบท์:107.3', F = 'Wegde Fries Mccain:100',
        O = 'ไก่ป๊อบ:96.9', N = 'นักเก็ต:124.2', K = 'Chicky Stick:103';

  const menu = [
    { brand: 'chicken', row: 2, name: 'Guck mal! Crispy Thigh', type: 'single', inn: 59, dl: 79, sp: 0, img: imgs['Guck mal! Crispy Thigh'] || '', food: T, pack: P, steps: 'Thigh@16' },
    { brand: 'chicken', row: 3, name: 'Guck mal! Boneless Bites', type: 'single', inn: 49, dl: 59, sp: 0, img: imgs['Guck mal! Boneless Bites'] || '', food: B, pack: P, steps: 'Bites@8' },
    { brand: 'chicken', row: 4, name: 'Guck mal! Wedge Fries', type: 'single', inn: 79, dl: 109, sp: 0, img: imgs['Guck mal! Wedge Fries'] || '', food: F, pack: P, steps: 'Fries@12' },
    { brand: 'chicken', row: 5, name: 'Guck mal! Chicken Pop', type: 'single', inn: 49, dl: 59, sp: 0, img: imgs['Guck mal! Chicken Pop'] || '', food: O, pack: P, steps: 'Pop@6' },
    { brand: 'chicken', row: 6, name: 'Guck mal! Chicken Nuggets', type: 'single', inn: 79, dl: 89, sp: 0, img: imgs['Guck mal! Chicken Nuggets'] || '', food: N, pack: P, steps: 'Nuggets@12' },
    { brand: 'chicken', row: 7, name: 'Guck mal! Crispy Sticks', type: 'single', inn: 79, dl: 89, sp: 0, img: imgs['Guck mal! Crispy Sticks'] || '', food: K, pack: P, steps: 'Sticks@6' },
    { brand: 'chicken', row: 8, name: 'Guck mal! Thighny Sticks', type: 'set', inn: 99, dl: 129, sp: 0, img: imgs['Guck mal! Thighny Sticks'] || '', food: T + ';' + K, pack: P, steps: 'Sticks@6;Thigh@16' },
    { brand: 'chicken', row: 9, name: 'Guck mal! Thighny Bites', type: 'set', inn: 89, dl: 119, sp: 0, img: imgs['Guck mal! Thighny Bites'] || '', food: T + ';' + B, pack: P, steps: 'Bites@8;Thigh@16' },
    { brand: 'chicken', row: 10, name: 'Guck mal! Duo Snacks', type: 'set', inn: 99, dl: 129, sp: 0, img: imgs['Guck mal! Duo Snacks'] || '', food: O + ';' + N, pack: P, steps: 'Pop@6;Nuggets@7' },
    { brand: 'chicken', row: 11, name: 'Guck mal! Happy Trio', type: 'set', inn: 139, dl: 179, sp: 0, img: imgs['Guck mal! Happy Trio'] || '', food: T + ';' + B + ';' + N, pack: P, steps: 'Bites@8;Nuggets@12;Thigh@16' },
    { brand: 'chicken', row: 12, name: 'Guck mal! Party Trio', type: 'set', inn: 129, dl: 169, sp: 0, img: imgs['Guck mal! Party Trio'] || '', food: B + ';' + O + ';' + K, pack: P, steps: 'Pop@6;Bites@6;Sticks@6' },
    { brand: 'chicken', row: 13, name: 'Rice', type: 'addon', inn: 10, dl: 15, sp: 0, img: '', food: 'ข้าวสวย:150', pack: 'กล่อง:1;กระดาษไขรองกล่อง:0.5', steps: '' },
    { brand: 'cheesecake', row: 2, name: 'Cheesecake 10 cm', type: 'single', inn: 150, dl: 189, sp: 0, img: imgs['Cheesecake 10 cm'] || '', food: 'ครีมชีส:100;ไข่ไก่เบอร์ 1:0.75;น้ำตาล:25;เกลือ:0.25;เลม่อน:1.75;วิปครีม:50;กลิ่นวนิลา:1.25;แป้งข้าวโพด:2.5', pack: 'ถุงกระดาษ:1;กล่องกลม:1;ช้อน:2;กระดาษไขรองอบ:1;ค่าไฟ:1', steps: '' },
    { brand: 'cheesecake', row: 3, name: 'Biscoff topping', type: 'addon', inn: 20, dl: 20, sp: 0, img: '', food: 'Biscoff แท่ง:23.4', pack: 'กระปุกบิสคอฟ:1', steps: '' }
  ];

  const ing = {
    'เนื้อสะโพกไก่กรอบ': { brand: 'chicken', cat: 'ing', row: 2, price: 145, batch: 1000, unit: 'g', cost: 0.145 },
    'ชังกี้ไบท์': { brand: 'chicken', cat: 'ing', row: 3, price: 155, batch: 1000, unit: 'g', cost: 0.155 },
    'Wegde Fries Mccain': { brand: 'chicken', cat: 'ing', row: 4, price: 139, batch: 1000, unit: 'g', cost: 0.139 },
    'ไก่ป๊อบ': { brand: 'chicken', cat: 'ing', row: 5, price: 149, batch: 1000, unit: 'g', cost: 0.149 },
    'นักเก็ต': { brand: 'chicken', cat: 'ing', row: 6, price: 145, batch: 1000, unit: 'g', cost: 0.145 },
    'Chicky Stick': { brand: 'chicken', cat: 'ing', row: 7, price: 159, batch: 1000, unit: 'g', cost: 0.159 },
    'ข้าวสวย': { brand: 'chicken', cat: 'ing', row: 8, price: 35, batch: 1000, unit: 'g', cost: 0.035 },
    'ซอสมะเขือเทศ': { brand: 'chicken', cat: 'ing', row: 9, price: 45, batch: 1000, unit: 'g', cost: 0.045 },
    'ซอสพริก': { brand: 'chicken', cat: 'ing', row: 10, price: 48, batch: 1000, unit: 'g', cost: 0.048 },
    'มายองเนส': { brand: 'chicken', cat: 'ing', row: 11, price: 65, batch: 1000, unit: 'g', cost: 0.065 },
    'ทาร์ทาร์ซอส': { brand: 'chicken', cat: 'ing', row: 12, price: 95, batch: 1000, unit: 'g', cost: 0.095 },
    'ถุงพลาสติก': { brand: 'chicken', cat: 'pack', row: 13, price: 35, batch: 100, unit: 'pc', cost: 0.35 },
    'กล่อง': { brand: 'chicken', cat: 'pack', row: 14, price: 110, batch: 50, unit: 'pc', cost: 2.20 },
    'ถ้วยน้ำจิ้ม': { brand: 'chicken', cat: 'pack', row: 15, price: 45, batch: 100, unit: 'pc', cost: 0.45 },
    'กระดาษไขรองกล่อง': { brand: 'chicken', cat: 'pack', row: 16, price: 60, batch: 100, unit: 'sheet', cost: 0.60 },
    'ตะเกียบ': { brand: 'chicken', cat: 'pack', row: 17, price: 40, batch: 100, unit: 'pair', cost: 0.40 },
    'ค่าไฟ': { brand: 'chicken', cat: 'pack', row: 18, price: 1.5, batch: 1, unit: 'batch', cost: 1.50 },
    'ค่าน้ำมัน': { brand: 'chicken', cat: 'pack', row: 19, price: 65, batch: 1000, unit: 'ml', cost: 0.065 },
    'ครีมชีส': { brand: 'cheesecake', cat: 'ing', row: 2, price: 450, batch: 1000, unit: 'g', cost: 0.45 },
    'ไข่ไก่เบอร์ 1': { brand: 'cheesecake', cat: 'ing', row: 3, price: 135, batch: 30, unit: 'egg', cost: 4.50 },
    'น้ำตาล': { brand: 'cheesecake', cat: 'ing', row: 4, price: 28, batch: 1000, unit: 'g', cost: 0.028 },
    'เกลือ': { brand: 'cheesecake', cat: 'ing', row: 5, price: 15, batch: 500, unit: 'g', cost: 0.03 },
    'เลม่อน': { brand: 'cheesecake', cat: 'ing', row: 6, price: 25, batch: 100, unit: 'g', cost: 0.25 },
    'วิปครีม': { brand: 'cheesecake', cat: 'ing', row: 7, price: 165, batch: 1000, unit: 'g', cost: 0.165 },
    'กลิ่นวนิลา': { brand: 'cheesecake', cat: 'ing', row: 8, price: 95, batch: 60, unit: 'ml', cost: 1.58 },
    'แป้งข้าวโพด': { brand: 'cheesecake', cat: 'ing', row: 9, price: 32, batch: 500, unit: 'g', cost: 0.064 },
    'Biscoff แท่ง': { brand: 'cheesecake', cat: 'ing', row: 10, price: 115, batch: 250, unit: 'g', cost: 0.46 },
    'ถุงกระดาษ': { brand: 'cheesecake', cat: 'pack', row: 11, price: 120, batch: 50, unit: 'pc', cost: 2.40 },
    'กล่องกลม': { brand: 'cheesecake', cat: 'pack', row: 12, price: 180, batch: 30, unit: 'pc', cost: 6.00 },
    'ช้อน': { brand: 'cheesecake', cat: 'pack', row: 13, price: 45, batch: 100, unit: 'pc', cost: 0.45 },
    'กระดาษไขรองอบ': { brand: 'cheesecake', cat: 'pack', row: 14, price: 85, batch: 100, unit: 'sheet', cost: 0.85 },
    'กระปุกบิสคอฟ': { brand: 'cheesecake', cat: 'pack', row: 15, price: 55, batch: 50, unit: 'pc', cost: 1.10 }
  };

  return { menu, ing, sales: [], cancelled: [], set: { ...DEFAULT_SETTINGS }, inv: [] };
}

function loadLocalDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.menu) && parsed.ing && parsed.set) {
        parsed.cancelled = parsed.cancelled || [];
        parsed.inv = parsed.inv || [];
        parsed.sales = parsed.sales || [];
        return parsed;
      }
    }
  } catch (e) {}
  const fresh = createLocalSeedState();
  saveLocalDB(fresh);
  return fresh;
}

function saveLocalDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function checkLocalEditAllowed(db, id) {
  const maxHours = (db.set && db.set.order_edit_hours != null) ? +db.set.order_edit_hours : 24;
  if (maxHours <= 0) return;
  const target = db.sales.find(r => r[1] === id);
  if (!target) return;
  const orderTime = new Date(String(target[0]).replace(' ', 'T')).getTime();
  if (!isNaN(orderTime) && (Date.now() - orderTime) / 3600000 > maxHours) {
    throw new Error(`Order #${id} is locked. Modifications are not allowed after ${maxHours} hours.`);
  }
}

const LocalAPI = {
  getState: () => loadLocalDB(),
  saveOrder: rows => {
    const db = loadLocalDB();
    db.sales.push(...rows);
    saveLocalDB(db);
    return true;
  },
  deleteOrder: id => {
    const db = loadLocalDB();
    db.sales = db.sales.filter(r => r[1] !== id);
    saveLocalDB(db);
    return true;
  },
  cancelOrder: (id, reason) => {
    const db = loadLocalDB();
    const target = db.sales.filter(r => r[1] === id);
    if (!target.length) return false;
    checkLocalEditAllowed(db, id);
    const nowStr = new Date().toLocaleString('sv', { timeZone: 'Asia/Bangkok' });
    target.forEach(r => db.cancelled.push([nowStr, reason || 'Cancelled by user', ...r]));
    db.sales = db.sales.filter(r => r[1] !== id);
    saveLocalDB(db);
    return true;
  },
  restoreOrder: id => {
    const db = loadLocalDB();
    db.cancelled.filter(r => r[3] === id).forEach(r => db.sales.push(r.slice(2)));
    db.cancelled = db.cancelled.filter(r => r[3] !== id);
    saveLocalDB(db);
    return true;
  },
  replaceOrder: (id, rows) => {
    const db = loadLocalDB();
    checkLocalEditAllowed(db, id);
    db.sales = db.sales.filter(r => r[1] !== id);
    db.sales.push(...rows);
    saveLocalDB(db);
    return true;
  },
  saveIng: (brand, name, price) => {
    const db = loadLocalDB();
    if (db.ing[name]) {
      db.ing[name].price = +price;
      db.ing[name].cost = (+price) / (db.ing[name].batch || 1);
      saveLocalDB(db);
    }
    return true;
  },
  addIng: (brand, name, price, batch, unit, cat) => {
    const db = loadLocalDB();
    const bQty = +batch || 1;
    db.ing[name] = { brand, cat: cat || 'ing', row: Object.keys(db.ing).length + 2, price: +price, batch: bQty, unit: unit || 'unit', cost: (+price) / bQty };
    saveLocalDB(db);
    return true;
  },
  saveSet: (key, val) => {
    const db = loadLocalDB();
    db.set[key] = +val;
    saveLocalDB(db);
    return true;
  },
  addMenu: (brand, row, img) => {
    const db = loadLocalDB();
    const imgUrl = (img && img.data) ? `data:${img.mime || 'image/jpeg'};base64,${img.data}` : (row[4] || '');
    db.menu.push({ brand, row: db.menu.filter(m => m.brand === brand).length + 2, name: row[0], type: row[1], inn: +row[2], dl: +row[3], img: imgUrl, food: row[5] || '', pack: row[6] || '', steps: row[7] || '', sp: +row[8] || 0 });
    saveLocalDB(db);
    return true;
  },
  updateMenu: (brand, rowIdx, row, img) => {
    const db = loadLocalDB();
    const idx = db.menu.findIndex(m => m.brand === brand && m.row === rowIdx);
    if (idx >= 0) {
      const imgUrl = (img && img.data) ? `data:${img.mime || 'image/jpeg'};base64,${img.data}` : row[4];
      db.menu[idx] = { ...db.menu[idx], name: row[0], type: row[1], inn: +row[2], dl: +row[3], img: imgUrl, food: row[5] || '', pack: row[6] || '', steps: row[7] || '', sp: +row[8] || 0 };
      saveLocalDB(db);
    }
    return true;
  },
  addInvest: (brand, date, item, amount) => {
    const db = loadLocalDB();
    db.inv.push([date, item, +amount, brand, db.inv.length + 2]);
    saveLocalDB(db);
    return true;
  },
  delInvest: (brand, row) => {
    const db = loadLocalDB();
    db.inv = db.inv.filter(x => !(x[3] === brand && x[4] === row));
    saveLocalDB(db);
    return true;
  },
  savePrice: (brand, row, col, val) => {
    const db = loadLocalDB();
    const m = db.menu.find(x => x.brand === brand && x.row === row);
    if (m) {
      m[col === 3 ? 'inn' : col === 4 ? 'dl' : 'sp'] = +val;
      saveLocalDB(db);
    }
    return true;
  }
};

/** Attaches offline base64 thumbnails if Google Sheet image URL is blank. */
function hydrateState(state) {
  if (!state || !Array.isArray(state.menu)) return state;
  const imgs = typeof DEFAULT_IMAGES !== 'undefined' ? DEFAULT_IMAGES : {};
  state.menu.forEach(m => {
    if (!m.img && imgs[m.name]) m.img = imgs[m.name];
  });
  return state;
}

function loadCachedLiveState() {
  try {
    const raw = localStorage.getItem(LIVE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.menu)) return hydrateState(parsed);
  } catch (e) {}
  return null;
}

function saveCachedLiveState(state) {
  try {
    localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(state));
  } catch (e) {}
}

/**
 * Invokes backend Apps Script API or LocalStorage fallback.
 * Uses HTTP GET for `getState` to avoid POST preflight delays.
 */
async function call(fn, ...args) {
  if (IS_GAS) {
    return new Promise((ok, er) => google.script.run.withSuccessHandler(ok).withFailureHandler(er)[fn](...args));
  }
  if (!API_URL) return LocalAPI[fn](...args);

  let json;
  try {
    const r = fn === 'getState'
      ? await fetch(`${API_URL}?action=state&t=${Date.now()}`, { redirect: 'follow' })
      : await fetch(API_URL, { method: 'POST', redirect: 'follow', body: JSON.stringify({ fn, args }) });
    const raw = await r.json();
    // GET ?action=state returns state object directly; POST returns { ok, data, error }
    json = fn === 'getState' && raw && Array.isArray(raw.menu) ? { ok: true, data: raw } : raw;
  } catch (e) {
    if (typeof toast === 'function') toast('Cannot reach Google Sheets. Check your internet and deployment.');
    throw e;
  }

  if (!json || !json.ok) {
    const errMsg = (json && json.error) || 'Unknown backend error';
    if (typeof toast === 'function') toast('Google Sheets error: ' + errMsg);
    throw new Error(errMsg);
  }
  return json.data;
}

let isSyncing = false;
let lastSyncAt = 0;

/**
 * Syncs live state from Google Sheets.
 * Background auto-syncs throttle to 10s intervals to prevent redundant requests.
 */
async function syncLiveState(isManual = false) {
  if (isSyncing) return;
  if (!isManual && Date.now() - lastSyncAt < 10000) return;

  isSyncing = true;
  const syncBtn = document.getElementById('syncBtn');
  const syncText = document.getElementById('syncText');
  if (syncBtn) syncBtn.classList.add('spinning');
  if (syncText) syncText.textContent = 'Syncing…';

  try {
    const newState = hydrateState(await call('getState'));
    if (newState && Array.isArray(newState.menu)) {
      S = newState;
      lastSyncAt = Date.now();
      saveCachedLiveState(newState);
      if (typeof draw === 'function') draw();
      if (isManual && typeof toast === 'function') toast('Synced with Google Sheets!');
    }
  } catch (err) {
    console.warn('Sync failed:', err);
    if (isManual && typeof toast === 'function') toast('Sync failed: ' + (err.message || 'Check connection'));
  } finally {
    isSyncing = false;
    if (syncBtn) syncBtn.classList.remove('spinning');
    if (syncText) syncText.textContent = 'Sync';
  }
}
