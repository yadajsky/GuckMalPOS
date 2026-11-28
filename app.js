/**
 * Guck mal! & Kuu Kuu POS — Core Application Controller & Views
 */

// ==================== APPLICATION STATE ====================
let S = null;
let tab = 'order';
let brand = 'chicken';
let menuCatFilter = 'all';
let menuSearch = '';
let cart = [];
let ch = null;
let disc = 0;
let extra = 0;
let cust = null;
let editId = null;
let editDate = null;
let lastSubmittedOrder = null;

// Orders tab filters
let ordSubTab = 'active';
let ordBrandFilter = 'all';
let ordChFilter = 'all';
let ordQuery = '';

// Dashboard filters
let dashBrand = 'all';
let dashPeriod = 'all';
let charts = {};

// Reports filters
let rp = { by: 'day', b: 'all', c: 'all' };

// Menu builder & settings UI state
let builderState = null;
let ingSearch = '';
let invViewMode = 'grouped'; // 'grouped' | 'flat'

let sauceModalState = {
  menuIdx: null,
  qty: 1,
  sauces: [],
  isCustom: false,
  customData: null
};

// ==================== SHARED UTILITIES & CALCULATORS ====================
const $ = id => document.getElementById(id);
const f2 = n => (+n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = n => (+n || 0).toLocaleString('en', { maximumFractionDigits: 0 });
const r2 = n => Math.round((+n || 0) * 100) / 100;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2800);
}

/** Fetches fresh state from backend, hydrates thumbnails, updates cache, and redraws. */
async function refreshAndRender(renderFn = draw) {
  S = hydrateState(await call('getState'));
  saveCachedLiveState(S);
  lastSyncAt = Date.now();
  renderFn();
}

const parsePairs = s => s ? String(s).split(';').filter(Boolean).map(x => {
  const i = x.lastIndexOf(':');
  return i > 0 ? [x.slice(0, i).trim(), +x.slice(i + 1) || 0] : null;
}).filter(Boolean) : [];

const getMenuImg = m => (m && m.img) ? m.img : ((typeof DEFAULT_IMAGES !== 'undefined' && DEFAULT_IMAGES[m?.name]) || '');
const ic = n => (S && S.ing[n]) ? S.ing[n].cost : 0;

const normCh = s => String(s ?? '').toLowerCase().replace(/[\s\-_]/g, '');
const matchCh = (c1, c2) => c1 === c2 || (!!c1 && !!c2 && normCh(c1) === normCh(c2));

const isInStore = (channel = ch) => {
  if (!channel) return true;
  const n = normCh(channel);
  return n === 'instore' || n === 'walkin' || n === 'dinein' || n === 'takeaway';
};
const isDel = (channel = ch) => channel ? !isInStore(channel) : false;

const pf = m => (!ch || isInStore(ch)) ? m.inn : (matchCh(ch, 'Shopee') && m.sp ? m.sp : m.dl);

const roundTo9 = v => (!v || v <= 0) ? 0 : Math.max(9, Math.round((v - 9) / 10) * 10 + 9);

const tf = l => l.sauces.includes('ทาร์ทาร์ซอส') ? (isDel() ? S.set.tartar_dl : S.set.tartar_in) : 0;
const unitP = l => (l.ov != null && l.ov !== '') ? +l.ov : pf(l) + tf(l);

function unitC(l) {
  if (l.fc != null) return l.fc;
  const baseCost = [...parsePairs(l.food), ...parsePairs(l.pack)].reduce((a, [n, q]) => a + q * ic(n), 0);
  const sauceCost = l.sauces.length ? l.sauces.reduce((a, s) => a + (50 / l.sauces.length) * ic(s), 0) : 0;
  return baseCost + sauceCost;
}

function calcCart() {
  const L = cart.map(l => ({ l, g: l.free ? 0 : unitP(l) * l.qty, c: unitC(l) * l.qty }));
  const G = L.reduce((a, x) => a + x.g, 0);
  const d = Math.min(disc, G);
  const ex = isDel() ? extra : 0;
  L.forEach(x => {
    const sh = G ? x.g / G : 0;
    x.d = d * sh;
    x.e = ex * sh;
    x.gp = isDel() ? (x.g - x.d) * (S.set.gp || 0) : 0;
    x.net = x.g - x.d - x.gp - x.e;
    x.p = x.net - x.c;
  });
  const sum = k => L.reduce((a, x) => a + x[k], 0);
  return { L, G, d, ex, gp: sum('gp'), net: sum('net'), c: sum('c'), p: sum('p') };
}

function getStepsInfo(l) {
  const ev = String(l.steps || '').split(';').filter(Boolean).map(x => x.split('@')).sort((a, b) => (+a[1]) - (+b[1]));
  if (!ev.length) return null;
  return {
    tot: Math.max(...ev.map(e => +e[1] || 0)),
    txt: 'All in at 0:00 → ' + ev.map(e => `pull <b>${esc(e[0])}</b> at <b>${e[1]}:00</b>`).join(', ')
  };
}

function parseOrderDateTime(v) {
  if (!v) return null;
  const s = String(v).trim();
  let d = new Date(s);
  if (isNaN(d.getTime())) d = new Date(s.replace(' ', 'T'));
  if (isNaN(d.getTime())) {
    const parts = s.split(/[\sT]+/);
    const dp = (parts[0] || '').split(/[-/]/);
    const tp = (parts[1] || '00:00:00').split(':');
    if (dp.length === 3) {
      if (dp[0].length === 4) d = new Date(+dp[0], +dp[1] - 1, +dp[2], +tp[0] || 0, +tp[1] || 0, +tp[2] || 0);
      else if (dp[2].length === 4) d = new Date(+dp[2], +dp[1] - 1, +dp[0], +tp[0] || 0, +tp[1] || 0, +tp[2] || 0);
    }
  }
  return isNaN(d.getTime()) ? null : { dayOfWeek: d.getDay(), hour: d.getHours(), date: d };
}

/** Evaluates whether an order has passed the configured edit/cancel time limit. */
function getOrderLockStatus(dateValue) {
  const orderTime = new Date(String(dateValue).replace(' ', 'T')).getTime();
  const hoursElapsed = !isNaN(orderTime) ? (Date.now() - orderTime) / 3600000 : 0;
  const maxHours = (S.set && S.set.order_edit_hours != null) ? +S.set.order_edit_hours : 24;
  return {
    isLocked: maxHours > 0 && hoursElapsed > maxHours,
    maxHours,
    hoursElapsed
  };
}

// ==================== THEME & NAVIGATION ====================
function applyTheme() {
  const meta = BRAND_META[brand] || BRAND_META.chicken;
  const s = document.documentElement.style;
  s.setProperty('--primary', meta.primary);
  s.setProperty('--primary-soft', meta.primarySoft);
  s.setProperty('--accent', meta.accent);
  s.setProperty('--accent-soft', meta.accentSoft);
  s.setProperty('--bg', meta.bg);
  $('brandLogo').textContent = meta.icon;
  $('brandTitle').textContent = brand === 'chicken' ? 'Guck mal! POS' : 'Kuu Kuu Cheesecake POS';
  $('modeDot').className = 'mode-dot ' + (IS_LIVE ? '' : 'local');
  $('modeText').textContent = IS_LIVE ? 'Google Sheets Sync Active' : 'Standalone HTML Mode (Saved Locally)';
}

function renderNav() {
  const activeOrdersCount = S ? new Set(S.sales.map(x => x[1])).size : 0;
  const tabs = [
    ['order', '🧾 Order'],
    ['orders', `📋 Orders (${activeOrdersCount})`],
    ['dash', '📊 Dashboard'],
    ['rep', '📈 Reports'],
    ['menu', '🍱 Menu & Costs'],
    ['set', '⚙️ Settings']
  ];
  $('nav').innerHTML = tabs.map(([k, label]) =>
    `<button class="tab ${tab === k ? 'on' : ''}" onclick="switchTab('${k}')">${label}</button>`
  ).join('');
}

function switchTab(k) {
  tab = k;
  if (k === 'menu' && (!builderState || builderState.brand !== brand)) resetBuilder(brand);
  draw();
}

function setBrand(b) {
  brand = b;
  menuCatFilter = 'all';
  if (tab === 'menu') resetBuilder(b);
  draw();
}

function brandSwitcherHtml(activeBrand, onClickFn = 'setBrand') {
  return `<div class="brand-switch">
    <button class="brand-pill ${activeBrand === 'chicken' ? 'on' : ''}" onclick="${onClickFn}('chicken')">🍗 Guck mal! Chicken</button>
    <button class="brand-pill ${activeBrand === 'cheesecake' ? 'on' : ''}" onclick="${onClickFn}('cheesecake')">🧀 Kuu Kuu Cheesecake</button>
  </div>`;
}

function draw() {
  if (!S) return;
  applyTheme();
  renderNav();
  ({ order: vOrder, orders: vOrders, dash: vDash, rep: vRep, menu: vMenu, set: vSet })[tab]();
}

// ==================== GLOBAL MODALS (PREP GUIDE) ====================
function openPrepGuideModal() {
  const chickenItems = Object.entries(MENU_PREP_SPECS).filter(([, v]) => v.brand === 'chicken');
  const cheesecakeItems = Object.entries(MENU_PREP_SPECS).filter(([, v]) => v.brand === 'cheesecake');

  $('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)$('modalRoot').innerHTML=''">
      <div class="modal-card" style="max-width:680px;max-height:88vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:1.5px solid var(--border);padding-bottom:10px">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:22px">🍗</span>
              <h3 style="margin:0;font-size:18px">Kitchen Preparation & Air Fryer Guide</h3>
            </div>
            <small style="color:var(--ink-muted)">Exact piece portions and air fryer cooking parameters (200°C Standard)</small>
          </div>
          <button class="chip" onclick="$('modalRoot').innerHTML=''" style="font-size:16px;padding:4px 10px">✕</button>
        </div>

        <div style="margin-bottom:18px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <h4 style="margin:0;color:var(--primary);font-size:14.5px">🍗 Guck mal! Fried Chicken & Sides (${chickenItems.length} Items)</h4>
            <span class="badge badge-amber" style="font-size:11px">Air Fryer @ 200°C</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${chickenItems.map(([name, spec]) => `
              <div style="background:var(--bg);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:10px;padding:10px 14px">
                <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px">
                  <b style="font-size:14px;color:var(--ink)">${esc(name.replace('Guck mal! ', ''))}</b>
                  <div style="display:flex;gap:6px;align-items:center">
                    <span class="badge badge-neutral" style="font-size:11px">⏱️ ${esc(spec.time)}</span>
                    <span class="badge badge-amber" style="font-size:11px">🔥 ${esc(spec.temp)}</span>
                  </div>
                </div>
                <div style="margin-top:5px;font-size:13px">
                  <span style="color:var(--ink-muted)">Portion / Pieces:</span>
                  <b style="color:var(--ink)">${esc(spec.pieces)}</b>
                </div>
                <div style="margin-top:3px;font-size:12px;color:var(--ink-muted);background:rgba(255,255,255,0.7);padding:4px 8px;border-radius:6px">
                  💡 <b>วิธีทำ:</b> ${esc(spec.instruction)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        ${cheesecakeItems.length ? `
        <div>
          <h4 style="margin:0 0 10px;color:var(--primary);font-size:14.5px">🧀 Kuu Kuu Cheesecake & Toppings</h4>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${cheesecakeItems.map(([name, spec]) => `
              <div style="background:var(--bg);border:1px solid var(--border);border-left:4px solid var(--green);border-radius:10px;padding:10px 14px">
                <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px">
                  <b style="font-size:14px;color:var(--ink)">${esc(name)}</b>
                  <span class="badge badge-green" style="font-size:11px">${esc(spec.temp)}</span>
                </div>
                <div style="margin-top:5px;font-size:13px">
                  <span style="color:var(--ink-muted)">Portion:</span>
                  <b style="color:var(--ink)">${esc(spec.pieces)}</b>
                </div>
                <div style="margin-top:3px;font-size:12px;color:var(--ink-muted)">💡 <b>การเตรียม:</b> ${esc(spec.instruction)}</div>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        <div style="margin-top:16px;text-align:right">
          <button class="btn btn-outline" onclick="$('modalRoot').innerHTML=''">Close Guide</button>
        </div>
      </div>
    </div>`;
}

// ==================== 1. POS ORDER VIEW (3-STEP WORKFLOW) ====================
function vOrder() {
  let items = S.menu.filter(m => m.brand === brand);
  if (menuCatFilter !== 'all') items = items.filter(m => m.type === menuCatFilter);
  if (menuSearch.trim()) {
    const q = menuSearch.toLowerCase();
    items = items.filter(m => m.name.toLowerCase().includes(q));
  }

  const t = calcCart();
  const card = m => {
    const idx = S.menu.indexOf(m);
    const imgUrl = getMenuImg(m);
    const prep = MENU_PREP_SPECS[m.name];
    return `<div class="m-card" onclick="selectMenuItem(${idx})">
      <div class="m-img-wrap">
        ${imgUrl ? `<img src="${imgUrl}" alt="${esc(m.name)}" loading="lazy">` : `<div class="m-ph">${m.brand === 'chicken' ? '🍗' : '🧀'}</div>`}
        <span class="m-type-tag">${esc(m.type)}</span>
      </div>
      <div>
        <div class="m-title">${esc(m.name.replace('Guck mal! ', ''))}</div>
        ${prep ? `<div class="m-prep-sub">🍗 ${esc(prep.shortPortion)} · ⏱️ ${esc(prep.time)}</div>` : ''}
        <div class="m-price-row">
          <span class="m-price">฿${pf(m)}</span>
          <span class="m-add-icon">+</span>
        </div>
      </div>
    </div>`;
  };

  const lastBanner = lastSubmittedOrder ? `
    <div class="panel" style="border-color:var(--green);background:var(--green-soft);padding:12px 14px">
      <div class="row">
        <div>
          <div style="font-weight:700;color:var(--green);font-size:13.5px">✅ Submitted Order #${esc(lastSubmittedOrder.id)}</div>
          <div style="font-size:12px;color:var(--ink)">${esc(lastSubmittedOrder.channel)} · Net <b>฿${f2(lastSubmittedOrder.net)}</b> · Profit <b>฿${f2(lastSubmittedOrder.profit)}</b></div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm" onclick="editOrder('${esc(lastSubmittedOrder.id)}')">✏️ Edit</button>
          <button class="btn btn-danger-outline btn-sm" onclick="promptCancelOrder('${esc(lastSubmittedOrder.id)}')">❌ Cancel</button>
        </div>
      </div>
    </div>` : '';

  $('app').innerHTML = `
    <!-- STEP 1: SALES CHANNEL SELECTION -->
    <div class="panel" style="margin-bottom:14px;padding:12px 16px;border:1.5px solid var(--border);border-left:4px solid ${ch ? 'var(--green)' : 'var(--primary)'}">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#fff;background:${ch ? 'var(--green)' : 'var(--primary)'};padding:4px 9px;border-radius:6px">STEP 1</span>
          <div>
            <b style="font-size:14px">Select Sales Channel First</b>
            <div style="font-size:12px;color:var(--ink-muted)">${ch ? `Active channel: <b>${esc(ch)}</b> (Pricing & GP auto-configured)` : '⚠️ Tap a channel below to begin ordering'}</div>
          </div>
        </div>
        <div class="channel-btn-group" id="channelSelector" style="display:flex;gap:8px;flex-wrap:wrap">
          ${CHN.map(c => {
            const isSel = matchCh(c, ch);
            const icon = c === 'In-store' ? '🏪' : c === 'Grab' ? '🟢' : c === 'Lineman' ? '🛵' : '🟠';
            return `<button type="button" class="btn ${isSel ? 'btn-primary' : 'btn-outline'}"
              style="padding:6px 12px;font-size:13px;border-radius:10px;${isSel ? 'box-shadow:0 3px 10px rgba(230,46,45,0.22);' : ''}"
              onclick="setSalesChannel('${c}')">
              <span>${icon}</span><span>${c}</span>
              ${isSel ? '<span style="font-size:11px;background:rgba(255,255,255,0.25);padding:1px 5px;border-radius:4px">✓ Active</span>' : ''}
            </button>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div class="pos-grid">
      <div>
        <div class="row" style="margin-bottom:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#fff;background:${ch ? 'var(--accent)' : 'var(--ink-muted)'};padding:3px 8px;border-radius:6px">STEP 2</span>
            ${brandSwitcherHtml(brand)}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${[['all', 'All'], ['single', 'Singles'], ['set', 'Sets'], ['addon', 'Add-ons']].map(([k, lbl]) =>
              `<button class="chip ${menuCatFilter === k ? 'primary-on' : ''}" onclick="menuCatFilter='${k}';vOrder()">${lbl}</button>`
            ).join('')}
            ${brand === 'chicken' ? `
              <button class="btn btn-accent btn-sm" onclick="openCustomSet()">✨ + Custom Set</button>
              <button class="btn btn-outline btn-sm" onclick="openPrepGuideModal()">📋 Prep Guide</button>
            ` : ''}
          </div>
        </div>

        ${!ch ? `
          <div style="background:var(--accent-soft);border:1.5px dashed var(--accent);border-radius:12px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">👆</span>
            <div>
              <b>Please select a sales channel in Step 1 above</b>
              <div style="font-size:12px;color:var(--ink-muted)">Choose In-store, Grab, Lineman, or Shopee to activate menu selection and channel pricing.</div>
            </div>
          </div>` : ''}

        <div style="margin-bottom:12px">
          <input type="search" placeholder="Search ${brand === 'chicken' ? 'chicken' : 'cheesecake'} menu…" value="${esc(menuSearch)}" oninput="menuSearch=this.value;vOrder()" style="width:100%;max-width:340px">
        </div>

        <div class="menu-grid">${items.length ? items.map(card).join('') : '<div class="panel">No menu items match this filter.</div>'}</div>
        <div id="custBox" style="margin-top:14px"></div>
      </div>

      <div>
        ${lastBanner}
        <div class="panel" style="${editId ? 'border:2px solid var(--accent);' : ''}">
          <div class="panel-header">
            <div>
              <h3 style="margin:0">${editId ? '✏️ Editing Order #' + esc(editId) : '🧾 Current Order'}</h3>
              ${editId ? `<small style="color:var(--ink-muted)">Original date: ${esc(String(editDate).slice(0, 16))}</small>` : ''}
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              ${editId ? `<button class="btn btn-outline btn-sm" onclick="discardEdit()">Discard</button>` : ''}
              <span class="badge ${ch ? (isInStore() ? 'badge-amber' : 'badge-green') : 'badge-red'}" style="font-size:12px;padding:4px 8px">
                ${ch ? esc(ch) : 'Select Channel Above'}
              </span>
            </div>
          </div>

          ${cart.length ? t.L.map((x, i) => renderCartLine(x, i)).join('') : '<div style="text-align:center;padding:26px 10px;color:var(--ink-muted)">Select a channel (Step 1), tap a menu (Step 2), and pick sauces (Step 3).</div>'}

          <div style="border-top:1px solid var(--border);margin-top:10px;padding-top:10px;display:flex;flex-direction:column;gap:8px">
            <div class="row">
              <span style="font-size:13px;font-weight:500">Order Discount (฿)</span>
              <input type="number" min="0" step="any" value="${disc}" onchange="disc=Math.max(0,+this.value||0);vOrder()">
            </div>
            ${isDel() ? `
              <div class="row">
                <span style="font-size:13px;font-weight:500">Campaign / Ads Fee (฿)</span>
                <input type="number" min="0" step="any" value="${extra}" onchange="extra=Math.max(0,+this.value||0);vOrder()">
              </div>` : ''}
          </div>

          <table class="tot-table">
            <tr><td>Gross Sales</td><td>฿${f2(t.G)}</td></tr>
            ${t.d > 0 ? `<tr><td>− Discount</td><td class="neg">−฿${f2(t.d)}</td></tr>` : ''}
            ${isDel() ? `
              <tr><td>− App GP (${r2((S.set.gp || 0) * 100)}%)</td><td class="neg">−฿${f2(t.gp)}</td></tr>
              ${t.ex > 0 ? `<tr><td>− Campaign Charge</td><td class="neg">−฿${f2(t.ex)}</td></tr>` : ''}
            ` : ''}
            <tr class="tot-divider"><td><b>Net You Receive</b></td><td class="big-num">฿${f2(t.net)}</td></tr>
            <tr><td style="color:var(--ink-muted)">Ingredients & Packaging Cost</td><td style="color:var(--ink-muted)">฿${f2(t.c)}</td></tr>
            <tr><td><b>Estimated Net Profit</b></td><td class="big-num ${t.p < 0 ? 'neg' : 'pos'}">฿${f2(t.p)}</td></tr>
          </table>

          <button class="btn btn-primary" style="width:100%;margin-top:14px;padding:12px;font-size:15px" onclick="checkout()" ${cart.length ? '' : 'disabled'}>
            ${editId ? '💾 Update Submitted Order' : '✅ Submit & Save Order'}
          </button>
        </div>

        ${renderTimeline()}
      </div>
    </div>`;
}

function renderCartLine(x, i) {
  const l = x.l;
  const hasSauces = l.type !== 'addon' && l.brand === 'chicken';
  return `<div class="cart-line">
    <div class="row">
      <b style="font-size:14px">${esc(l.name.replace('Guck mal! ', ''))}</b>
      <span style="font-weight:700">${l.free ? `<s style="color:var(--ink-muted)">฿${f2(unitP(l) * l.qty)}</s> <span class="badge badge-amber">FREE</span>` : `฿${f2(x.g)}`}</span>
    </div>
    <div class="row" style="margin-top:6px;flex-wrap:wrap">
      <div class="qty-box">
        <button onclick="updateQty(${i}, -1)">−</button>
        <span>${l.qty}</span>
        <button onclick="updateQty(${i}, 1)">+</button>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:12px;color:var(--ink-muted)">฿</span>
        <input type="number" style="width:68px;padding:4px 7px" value="${unitP(l)}" onchange="cart[${i}].ov=this.value;vOrder()">
        <label style="font-size:12px;display:inline-flex;align-items:center;gap:3px;cursor:pointer">
          <input type="checkbox" ${l.free ? 'checked' : ''} onchange="cart[${i}].free=this.checked;vOrder()"> Free
        </label>
        <button class="chip" onclick="cart.splice(${i},1);vOrder()" title="Remove">✕</button>
      </div>
    </div>
    ${hasSauces ? `<div style="margin-top:6px">${SAUCES.map(s =>
      `<button class="chip ${l.sauces.includes(s) ? 'on' : ''}" onclick="toggleSauce(${i}, '${s}')">${s}${s === 'ทาร์ทาร์ซอส' ? ' (+฿' + (isDel() ? S.set.tartar_dl : S.set.tartar_in) + ')' : ''}</button>`
    ).join('')}</div>` : ''}
    <div style="margin-top:4px;font-size:11.5px;color:var(--ink-muted)">
      Unit cost: ฿${f2(unitC(l))} · Unit profit: <span class="${x.p < 0 ? 'neg' : 'pos'}">฿${f2(x.p / l.qty)}</span>
    </div>
  </div>`;
}

function setSalesChannel(channel) {
  ch = channel;
  vOrder();
}

function selectMenuItem(idx) {
  if (!ch) {
    toast('⚠️ Please select a sales channel in Step 1 first');
    const el = $('channelSelector');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const m = S.menu[idx];
  if (m.brand === 'chicken' && m.type !== 'addon') {
    sauceModalState = { menuIdx: idx, qty: 1, sauces: [], isCustom: false, customData: null };
    renderSauceModal();
  } else {
    addCartItemDirect(m, 1, []);
  }
}

function renderSauceModal() {
  const sState = sauceModalState;
  const isCustom = sState.isCustom;
  const m = isCustom ? sState.customData : S.menu[sState.menuIdx];
  if (!m) return;

  const prep = !isCustom ? MENU_PREP_SPECS[m.name] : null;
  const basePrice = isCustom ? (isInStore() ? m.inn : (matchCh(ch, 'Shopee') ? m.sp : m.dl)) : pf(m);
  const tartarPrice = isDel() ? (+S.set.tartar_dl || 15) : (+S.set.tartar_in || 10);
  const itemPrice = basePrice + (sState.sauces.includes('ทาร์ทาร์ซอส') ? tartarPrice : 0);
  const totalPrice = itemPrice * sState.qty;

  $('modalRoot').innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this)closeSauceModal()">
      <div class="modal-card" style="max-width:440px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <span style="font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#fff;background:var(--accent);padding:3px 8px;border-radius:6px">STEP 3 · CHOOSE SAUCE</span>
            <h3 style="margin:6px 0 2px;font-size:18px">${esc(m.name.replace('Guck mal! ', ''))}</h3>
            <div style="font-size:12.5px;color:var(--ink-muted)">Channel: <b>${esc(ch || 'In-store')}</b> · Base: <b>฿${f2(basePrice)}</b></div>
          </div>
          <button class="chip" onclick="closeSauceModal()" style="font-size:16px;padding:4px 9px">✕</button>
        </div>

        ${prep ? `
        <div class="prep-banner">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <b>🍗 Kitchen Prep Spec:</b>
            <span class="badge badge-amber" style="font-size:11px">⏱️ ${esc(prep.temp)} · ${esc(prep.time)}</span>
          </div>
          <div style="font-weight:600">${esc(prep.pieces)}</div>
          <div style="color:var(--ink-muted);font-size:11.5px;margin-top:2px">💡 ${esc(prep.instruction)}</div>
        </div>` : ''}

        <div style="background:var(--bg);padding:12px;border-radius:12px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <b style="font-size:13px">Select Sauces (Max 2):</b>
            <span style="font-size:12px;color:var(--ink-muted)">${sState.sauces.length}/2 selected</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${SAUCES.map(s => {
              const isChecked = sState.sauces.includes(s);
              return `<button type="button" class="btn ${isChecked ? 'btn-primary' : 'btn-outline'}"
                style="padding:10px;text-align:left;justify-content:space-between;font-size:12.5px;border-radius:10px"
                onclick="toggleModalSauce('${s}')">
                <span>${SAUCE_ICONS[s] || '🥫'} ${s}</span>
                <span style="font-size:11px;opacity:0.9">${s === 'ทาร์ทาร์ซอส' ? `+฿${tartarPrice}` : 'Free'}</span>
              </button>`;
            }).join('')}
          </div>
          <div style="margin-top:8px;text-align:right">
            <button type="button" class="chip ${sState.sauces.length === 0 ? 'on' : ''}" style="font-size:11.5px" onclick="sauceModalState.sauces=[];renderSauceModal()">
              ❌ ไม่รับซอส (No Sauce)
            </button>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:0 4px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:13px;font-weight:600">Quantity:</span>
            <div class="qty-box" style="background:#fff">
              <button onclick="sauceModalState.qty=Math.max(1,sauceModalState.qty-1);renderSauceModal()">−</button>
              <span style="min-width:24px;text-align:center">${sState.qty}</span>
              <button onclick="sauceModalState.qty+=1;renderSauceModal()">+</button>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;color:var(--ink-muted)">Item Total</div>
            <div style="font-size:20px;font-weight:700;color:var(--primary)">฿${f2(totalPrice)}</div>
          </div>
        </div>

        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" style="flex:1" onclick="closeSauceModal()">Cancel</button>
          <button class="btn btn-primary" style="flex:2;padding:12px;font-size:14.5px" onclick="confirmAddSauceModal()">
            Add to Order · ฿${f2(totalPrice)}
          </button>
        </div>
      </div>
    </div>`;
}

function toggleModalSauce(s) {
  const arr = sauceModalState.sauces;
  const idx = arr.indexOf(s);
  if (idx >= 0) arr.splice(idx, 1);
  else if (arr.length < 2) arr.push(s);
  else return toast('Maximum 2 sauces per item');
  renderSauceModal();
}

function closeSauceModal() {
  $('modalRoot').innerHTML = '';
}

function confirmAddSauceModal() {
  const sState = sauceModalState;
  if (sState.isCustom) {
    const c = sState.customData;
    const template = S.menu.find(x => x.brand === 'chicken' && x.type === 'single');
    cart.push({
      brand: 'chicken', name: 'Custom Set (' + c.names.join(', ') + ')', type: 'custom',
      inn: c.inn, dl: c.dl, sp: c.sp, food: c.food, pack: template ? template.pack : '',
      steps: c.steps, qty: sState.qty, sauces: [...sState.sauces], free: false, ov: null
    });
    cust = null;
    toast(`Added Custom Set (${sState.sauces.length ? sState.sauces.join(', ') : 'No Sauce'})`);
  } else {
    const m = S.menu[sState.menuIdx];
    const saucesKey = [...sState.sauces].sort().join('+');
    const existing = cart.find(l => l.name === m.name && l.brand === m.brand && [...l.sauces].sort().join('+') === saucesKey && !l.free && l.ov == null);
    if (existing) existing.qty += sState.qty;
    else cart.push({ ...m, qty: sState.qty, sauces: [...sState.sauces], free: false, ov: null });
    toast(`Added ${m.name.replace('Guck mal! ', '')} (${sState.sauces.length ? sState.sauces.join(', ') : 'No Sauce'})`);
  }
  closeSauceModal();
  vOrder();
}

function addCartItemDirect(m, qty = 1, sauces = []) {
  const existing = cart.find(l => l.name === m.name && l.brand === m.brand && !l.sauces.length && !l.free && l.ov == null);
  if (existing) existing.qty += qty;
  else cart.push({ ...m, qty, sauces, free: false, ov: null });
  toast(`Added ${m.name.replace('Guck mal! ', '')} to order`);
  vOrder();
}

function updateQty(i, delta) {
  cart[i].qty += delta;
  if (cart[i].qty < 1) cart.splice(i, 1);
  vOrder();
}

function toggleSauce(i, s) {
  const arr = cart[i].sauces;
  const k = arr.indexOf(s);
  if (k >= 0) arr.splice(k, 1);
  else if (arr.length < 2) arr.push(s);
  else toast('Maximum 2 sauces per item');
  cart[i].ov = null;
  vOrder();
}

function renderTimeline() {
  const L = cart.filter(l => l.brand === 'chicken').map(l => ({ l, s: getStepsInfo(l), prep: MENU_PREP_SPECS[l.name] })).filter(x => x.s || x.prep);
  if (!L.length) return '';
  const tot = L.reduce((a, x) => a + (x.s ? x.s.tot : 8) * x.l.qty, 0) + (+S.set.preheat || 3);
  return `<div class="panel">
    <div class="row">
      <b>🔥 Kitchen Air Fryer Schedule · 200°C</b>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="badge badge-amber">≈ ${tot} min total</span>
        <button class="btn btn-outline btn-sm" onclick="openPrepGuideModal()" style="font-size:11px;padding:2px 8px">📋 Full Guide</button>
      </div>
    </div>
    <div class="tl-step">Preheat air fryer: <b>${S.set.preheat || 3} min</b> @ 200°C</div>
    ${L.map(x => {
      const p = x.prep;
      const timeStr = p ? p.time : (x.s ? x.s.tot + ' min' : '');
      const instruction = p ? p.instruction : (x.s ? x.s.txt : '');
      return `<div class="tl-step" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <b>${esc(x.l.name.replace('Guck mal! ', ''))} ×${x.l.qty}</b>
          <span style="font-size:11.5px;color:var(--accent);font-weight:600">⏱️ ${esc(timeStr)}</span>
        </div>
        ${p ? `<div style="font-size:12px;font-weight:500;margin-top:2px">🍗 วัตถุดิบ: <b>${esc(p.pieces)}</b> ${x.l.qty > 1 ? `(สำหรับ ${x.l.qty} ที่: ${x.l.qty} × ${esc(p.pieces)})` : ''}</div>` : ''}
        ${instruction ? `<div style="font-size:11.5px;color:var(--ink-muted);margin-top:2px">💡 ${esc(instruction)}</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function discardEdit() {
  editId = null; editDate = null; cart = []; disc = 0; extra = 0;
  vOrder();
}

async function checkout() {
  if (!ch) return toast('⚠️ Please select a sales channel (Step 1) before saving the order');
  const t = calcCart();
  const wasEditing = !!editId;
  const id = editId || 'O' + Date.now().toString(36).toUpperCase();
  const d = editDate || new Date().toLocaleString('sv', { timeZone: 'Asia/Bangkok' });
  const rows = t.L.map(x => [
    d, id, x.l.brand, x.l.name, x.l.sauces.join('+'), x.l.qty, ch,
    unitP(x.l), x.l.free ? 'FREE' : '', r2(x.g), r2(x.d), r2(x.e), r2(x.gp), r2(x.net), r2(x.c), r2(x.p)
  ]);

  try {
    await (wasEditing ? call('replaceOrder', id, rows) : call('saveOrder', rows));
    lastSubmittedOrder = { id, channel: ch, net: t.net, profit: t.p };
    cart = []; disc = 0; extra = 0; editId = null; editDate = null; ch = null;
    toast(wasEditing ? `Order #${id} updated!` : `Order #${id} saved!`);
    await refreshAndRender();
  } catch (e) {
    toast('Save failed: ' + e.message);
  }
}

// Custom Set Builder (-17% for 2 items, -15% for 3+ items, ending in 9)
function openCustomSet() {
  if (!ch) return toast('⚠️ Please select a sales channel in Step 1 first');
  cust = {};
  const singles = S.menu.filter(m => m.brand === 'chicken' && m.type === 'single');
  const d2 = r2(((S.set && S.set.bundle_2 != null) ? S.set.bundle_2 : 0.17) * 100);
  const d3 = r2(((S.set && S.set.bundle_3 != null) ? S.set.bundle_3 : 0.15) * 100);
  $('custBox').innerHTML = `<div class="panel" style="border-color:var(--accent)">
    <div class="panel-header">
      <div>
        <h3 style="margin:0">✨ Build Custom Chicken Set</h3>
        <small style="color:var(--ink-muted)">${d2}% off for 2 menus · ${d3}% off for 3+ menus · Ending in ฿9</small>
      </div>
      <button class="chip" onclick="$('custBox').innerHTML=''">✕ Close</button>
    </div>
    ${singles.map(m => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--border)">
      <span>${esc(m.name.replace('Guck mal! ', ''))} <small style="color:var(--ink-muted)">(฿${m.inn} in-store / ฿${m.dl} delivery)</small></span>
      <input type="number" min="0" value="0" onchange="cust[${S.menu.indexOf(m)}]=Math.max(0,+this.value||0);updateCustSummary()">
    </div>`).join('')}
    <div id="custSummary" style="margin:10px 0;font-size:13.5px;color:var(--ink-muted)">Select at least 2 items to apply bundle discount.</div>
    <button class="btn btn-primary" onclick="addCustomSet()">Next: Select Sauce & Add to Order →</button>
  </div>`;
}

function calcCustomSet() {
  const ids = Object.keys(cust || {}).filter(k => cust[k] > 0);
  const totalQty = ids.reduce((acc, k) => acc + (cust[k] || 0), 0);
  const b = totalQty === 2
    ? ((S.set && S.set.bundle_2 != null) ? +S.set.bundle_2 : 0.17)
    : (totalQty >= 3 ? ((S.set && S.set.bundle_3 != null) ? +S.set.bundle_3 : 0.15) : 0);

  let innSum = 0, dlSum = 0, spSum = 0;
  const food = [], names = [], stepList = [];
  ids.forEach(k => {
    const m = S.menu[k], q = cust[k];
    innSum += m.inn * q; dlSum += m.dl * q; spSum += (m.sp || m.dl) * q;
    parsePairs(m.food).forEach(([fn, fq]) => food.push(`${fn}:${r2(fq * q)}`));
    if (m.steps) stepList.push(m.steps);
    names.push(`${q}× ${m.name.replace('Guck mal! ', '')}`);
  });

  return {
    ids, totalQty, innSum, b,
    inn: totalQty >= 2 ? roundTo9(innSum * (1 - b)) : innSum,
    dl: totalQty >= 2 ? roundTo9(dlSum * (1 - b)) : dlSum,
    sp: totalQty >= 2 ? roundTo9(spSum * (1 - b)) : spSum,
    food: food.join(';'), steps: stepList.join(';'), names
  };
}

function updateCustSummary() {
  const c = calcCustomSet();
  if (!c.ids.length) return $('custSummary').innerHTML = 'Select at least 2 items to apply bundle discount.';
  if (c.totalQty < 2) return $('custSummary').innerHTML = `1 item selected (฿${c.innSum}). <span style="color:var(--accent);font-weight:600">Add 1 more item for 17% bundle discount!</span>`;
  const tierText = c.totalQty === 2 ? `2 items bundle (-${r2(c.b * 100)}%)` : `${c.totalQty} items bundle (-${r2(c.b * 100)}%)`;
  $('custSummary').innerHTML = `Singles total ฿${c.innSum} − ${tierText} = <b style="color:var(--primary)">฿${c.inn}</b> In-store · <b style="color:var(--primary)">฿${c.dl}</b> Delivery <span class="badge badge-green">Ends in 9</span>`;
}

function addCustomSet() {
  if (!ch) return toast('⚠️ Please select a sales channel in Step 1 first');
  const c = calcCustomSet();
  if (c.totalQty < 2) return toast('Select at least 2 items to build a custom bundle set');
  sauceModalState = { menuIdx: null, qty: 1, sauces: [], isCustom: true, customData: { ...c, name: 'Custom Set (' + c.names.join(', ') + ')' } };
  $('custBox').innerHTML = '';
  renderSauceModal();
}

// ==================== 2. ORDERS HISTORY & CANCELLATION ====================
function vOrders() {
  const groupOrders = (rows, isCancelled) => {
    const map = {};
    rows.forEach(r => {
      const id = isCancelled ? r[3] : r[1];
      (map[id] = map[id] || []).push(r);
    });
    return Object.entries(map).sort((a, b) => String(isCancelled ? b[1][0][2] : b[1][0][0]).localeCompare(String(isCancelled ? a[1][0][2] : a[1][0][0])));
  };

  const activeList = groupOrders(S.sales, false);
  const cancelList = groupOrders(S.cancelled || [], true);

  const filterList = (list, isCanc) => list.filter(([id, rows]) => {
    const sample = isCanc ? rows[0].slice(2) : rows[0];
    if (ordBrandFilter !== 'all' && sample[2] !== ordBrandFilter) return false;
    if (ordChFilter !== 'all' && !matchCh(sample[6], ordChFilter)) return false;
    if (ordQuery.trim()) {
      const q = ordQuery.toLowerCase();
      if (!id.toLowerCase().includes(q) && !rows.some(r => String(isCanc ? r[5] : r[3]).toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const shown = ordSubTab === 'active' ? filterList(activeList, false) : filterList(cancelList, true);

  $('app').innerHTML = `
    <div class="row" style="margin-bottom:14px;flex-wrap:wrap">
      <div>
        <h2 style="margin:0">Order History & Management</h2>
        <small style="color:var(--ink-muted)">Edit items, adjust discounts, or cancel orders within the allowed time window.</small>
      </div>
      <div class="brand-switch">
        <button class="brand-pill ${ordSubTab === 'active' ? 'on' : ''}" onclick="ordSubTab='active';vOrders()">✅ Active Orders (${activeList.length})</button>
        <button class="brand-pill ${ordSubTab === 'cancelled' ? 'on' : ''}" onclick="ordSubTab='cancelled';vOrders()">🚫 Cancelled (${cancelList.length})</button>
      </div>
    </div>

    <div class="panel" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <input type="search" placeholder="Search Order ID or menu item…" value="${esc(ordQuery)}" oninput="ordQuery=this.value;vOrders()" style="min-width:220px;flex:1">
      <select onchange="ordBrandFilter=this.value;vOrders()">
        <option value="all" ${ordBrandFilter === 'all' ? 'selected' : ''}>All Brands</option>
        <option value="chicken" ${ordBrandFilter === 'chicken' ? 'selected' : ''}>🍗 Guck mal! Chicken</option>
        <option value="cheesecake" ${ordBrandFilter === 'cheesecake' ? 'selected' : ''}>🧀 Kuu Kuu Cheesecake</option>
      </select>
      <select onchange="ordChFilter=this.value;vOrders()">
        <option value="all" ${ordChFilter === 'all' ? 'selected' : ''}>All Channels</option>
        ${CHN.map(c => `<option value="${c}" ${matchCh(ordChFilter, c) ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>

    ${shown.length ? shown.map(([id, rawRows]) => {
      const isCanc = ordSubTab === 'cancelled';
      const rows = isCanc ? rawRows.map(r => r.slice(2)) : rawRows;
      const first = rows[0];
      const net = rows.reduce((a, x) => a + (+x[13] || 0), 0);
      const cost = rows.reduce((a, x) => a + (+x[14] || 0), 0);
      const profit = rows.reduce((a, x) => a + (+x[15] || 0), 0);
      const lock = getOrderLockStatus(first[0]);

      return `<div class="panel">
        <div class="row" style="flex-wrap:wrap;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="badge badge-neutral" style="font-weight:700">#${esc(id)}</span>
            <b>${esc(String(first[0]).slice(0, 16))}</b>
            <span class="badge badge-amber">${first[2] === 'chicken' ? '🍗 Guck mal!' : '🧀 Kuu Kuu'}</span>
            <span class="badge badge-neutral">${esc(first[6])}</span>
            ${isCanc ? `<span class="badge badge-red">Cancelled (${esc(rawRows[0][1] || 'No reason')})</span>` : ''}
            ${(!isCanc && lock.isLocked) ? `<span class="badge badge-neutral" style="opacity:0.8">🔒 Locked (${Math.floor(lock.hoursElapsed)}h ago)</span>` : ''}
          </div>
          <div style="text-align:right">
            <span style="font-size:16px;font-weight:700">Net ฿${f2(net)}</span>
            <span class="badge ${profit < 0 ? 'badge-red' : 'badge-green'}" style="margin-left:6px">Profit ฿${f2(profit)}</span>
          </div>
        </div>

        <div style="background:var(--bg);border-radius:10px;padding:8px 12px;font-size:13px;margin-bottom:10px">
          ${rows.map(x => `<div class="row" style="padding:2px 0">
            <span><b>${x[5]}×</b> ${esc(String(x[3]).replace('Guck mal! ', ''))} ${x[4] ? `<small style="color:var(--ink-muted)">[${esc(x[4])}]</small>` : ''} ${x[8] === 'FREE' ? '<span class="badge badge-amber">FREE</span>' : ''}</span>
            <span>฿${f2(x[9])}</span>
          </div>`).join('')}
        </div>

        <div class="row" style="flex-wrap:wrap">
          <small style="color:var(--ink-muted)">COGS: ฿${f2(cost)} · Gross: ฿${f2(rows.reduce((a, x) => a + (+x[9] || 0), 0))}</small>
          <div style="display:flex;gap:8px;align-items:center">
            ${!isCanc ? `
              <button class="btn btn-outline btn-sm" ${lock.isLocked ? 'disabled style="opacity:0.5"' : `onclick="editOrder('${esc(id)}')"`}>✏️ Edit${lock.isLocked ? '' : ' Order'}</button>
              <button class="btn btn-danger-outline btn-sm" ${lock.isLocked ? 'disabled style="opacity:0.5"' : `onclick="promptCancelOrder('${esc(id)}')"`}>❌ Cancel${lock.isLocked ? '' : ' Order'}</button>
            ` : (!IS_GAS ? `<button class="btn btn-outline btn-sm" onclick="restoreCancelled('${esc(id)}')">↩️ Restore Order</button>` : '')}
          </div>
        </div>
      </div>`;
    }).join('') : `<div class="panel" style="text-align:center;padding:30px;color:var(--ink-muted)">No ${ordSubTab} orders found.</div>`}`;
}

function editOrder(id) {
  const rows = S.sales.filter(x => x[1] === id);
  if (!rows.length) return toast('Order not found');
  const lock = getOrderLockStatus(rows[0][0]);
  if (lock.isLocked) return toast(`Order #${id} is locked (past ${lock.maxHours}h edit limit)`);

  editId = id; editDate = rows[0][0]; ch = rows[0][6]; brand = rows[0][2];
  disc = r2(rows.reduce((a, x) => a + (+x[10] || 0), 0));
  extra = r2(rows.reduce((a, x) => a + (+x[11] || 0), 0));
  cart = rows.map(x => {
    const m = S.menu.find(y => y.name === x[3] && y.brand === x[2]);
    const q = +x[5] || 1;
    return {
      ...(m || { brand: x[2], name: x[3], type: 'custom', inn: 0, dl: 0, food: '', pack: '', steps: '', fc: (+x[14] || 0) / q }),
      qty: q, sauces: x[4] ? String(x[4]).split('+').filter(Boolean) : [], free: x[8] === 'FREE', ov: x[7]
    };
  });
  tab = 'order';
  draw();
  toast(`Loaded Order #${id} into POS for editing`);
}

function promptCancelOrder(id) {
  const rows = S.sales.filter(x => x[1] === id);
  if (rows.length) {
    const lock = getOrderLockStatus(rows[0][0]);
    if (lock.isLocked) return toast(`Order #${id} is locked (past ${lock.maxHours}h edit limit)`);
  }
  $('modalRoot').innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this)$('modalRoot').innerHTML=''">
    <div class="modal-card">
      <h3 style="margin-top:0;color:var(--red)">❌ Cancel Order #${esc(id)}?</h3>
      <p style="font-size:13.5px;color:var(--ink-muted)">This removes the order from active revenue, profit, and payback totals and logs it under Cancelled Orders.</p>
      <div style="margin:12px 0">
        <label style="font-size:12.5px;font-weight:600;display:block;margin-bottom:4px">Cancellation Reason (optional)</label>
        <input id="cancelReasonInput" type="text" placeholder="e.g., Customer cancelled, duplicate entry…" style="width:100%">
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
        <button class="btn btn-outline" onclick="$('modalRoot').innerHTML=''">Keep Order</button>
        <button class="btn btn-primary" style="background:var(--red)" onclick="confirmCancelOrder('${esc(id)}')">Confirm Cancel</button>
      </div>
    </div>
  </div>`;
}

async function confirmCancelOrder(id) {
  const reason = $('cancelReasonInput') ? $('cancelReasonInput').value.trim() : '';
  $('modalRoot').innerHTML = '';
  try {
    await call('cancelOrder', id, reason);
    if (lastSubmittedOrder && lastSubmittedOrder.id === id) lastSubmittedOrder = null;
    if (editId === id) discardEdit();
    toast(`Order #${id} cancelled`);
    await refreshAndRender();
  } catch (e) {
    toast('Cancel failed: ' + e.message);
  }
}

async function restoreCancelled(id) {
  try {
    await call('restoreOrder', id);
    toast(`Order #${id} restored to active sales`);
    await refreshAndRender();
  } catch (e) {
    toast(e.message);
  }
}

// ==================== 3. BUSINESS PERFORMANCE DASHBOARD ====================
function analyzeOrderVolume(rows) {
  const orderMap = {};
  rows.forEach(x => {
    const oId = x[1];
    if (!orderMap[oId]) orderMap[oId] = { id: oId, dt: parseOrderDateTime(x[0]), net: 0 };
    orderMap[oId].net += (+x[13] || 0);
  });
  const uniqueOrders = Object.values(orderMap);

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayStats = Array.from({ length: 7 }, (_, i) => ({ day: DAY_NAMES[i], short: DAY_SHORT[i], orders: 0, net: 0 }));
  const hourStats = Array.from({ length: 24 }, (_, i) => ({ hour: i, label: `${String(i).padStart(2, '0')}:00`, orders: 0, net: 0 }));

  const shifts = [
    { key: 'morning', name: '🌅 Morning (08–11)', hours: [8, 9, 10, 11], orders: 0, net: 0 },
    { key: 'lunch', name: '🍱 Lunch Rush (12–14)', hours: [12, 13, 14], orders: 0, net: 0 },
    { key: 'afternoon', name: '☕ Afternoon (15–17)', hours: [15, 16, 17], orders: 0, net: 0 },
    { key: 'evening', name: '🌙 Evening Rush (18–21)', hours: [18, 19, 20, 21], orders: 0, net: 0 },
    { key: 'night', name: '🦉 Late Night (22+)', hours: [22, 23, 0, 1, 2, 3, 4, 5, 6, 7], orders: 0, net: 0 }
  ];

  uniqueOrders.forEach(o => {
    if (!o.dt) return;
    if (o.dt.dayOfWeek != null) { dayStats[o.dt.dayOfWeek].orders++; dayStats[o.dt.dayOfWeek].net += o.net; }
    if (o.dt.hour != null) {
      hourStats[o.dt.hour].orders++; hourStats[o.dt.hour].net += o.net;
      const sh = shifts.find(s => s.hours.includes(o.dt.hour));
      if (sh) { sh.orders++; sh.net += o.net; }
    }
  });

  const findExtremes = list => {
    let max = null, min = null;
    list.forEach(item => {
      if (!max || item.orders > max.orders) max = item;
      if (!min || item.orders < min.orders) min = item;
    });
    return (max && max.orders > 0) ? { peak: max, slow: min } : { peak: null, slow: null };
  };

  const dayExt = findExtremes(dayStats);
  const activeHours = hourStats.filter(h => h.hour >= 9 && h.hour <= 22);
  const hrExt = findExtremes(activeHours);

  return { dayStats, activeHours, shifts, peakDay: dayExt.peak, slowDay: dayExt.slow, peakHr: hrExt.peak, slowHr: hrExt.slow };
}

function vDash() {
  const todayStr = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Bangkok' });
  const nowMs = Date.now();

  const rows = S.sales.filter(x => {
    if (dashBrand !== 'all' && x[2] !== dashBrand) return false;
    const dStr = String(x[0]).slice(0, 10);
    if (dashPeriod === 'today') return dStr === todayStr;
    if (dashPeriod === '7d') { const diff = (nowMs - new Date(dStr + 'T00:00:00').getTime()) / 86400000; return diff >= -1 && diff <= 7; }
    if (dashPeriod === 'month') return dStr.slice(0, 7) === todayStr.slice(0, 7);
    return true;
  });

  const agg = arr => {
    const o = new Set(arr.map(x => x[1])).size;
    const g = arr.reduce((a, x) => a + (+x[9] || 0), 0);
    const n = arr.reduce((a, x) => a + (+x[13] || 0), 0);
    const c = arr.reduce((a, x) => a + (+x[14] || 0), 0);
    const p = arr.reduce((a, x) => a + (+x[15] || 0), 0);
    return { o, g, n, c, p, margin: n > 0 ? (p / n) * 100 : 0, aov: o > 0 ? n / o : 0 };
  };

  const kpi = agg(rows);
  const getBrandInv = b => (S.set['inv_' + b] || 0) + S.inv.filter(x => x[3] === b).reduce((acc, x) => acc + (+x[2] || 0), 0);
  const getBrandCumSales = b => (S.set['open_net_' + b] || 0) + S.sales.filter(x => x[2] === b).reduce((acc, x) => acc + (+x[13] || 0), 0);

  const paybackCard = b => {
    const meta = BRAND_META[b], a = agg(S.sales.filter(x => x[2] === b));
    const invTotal = getBrandInv(b), cumNet = (S.set['open_net_' + b] || 0) + a.n, cumProfit = (S.set['open_profit_' + b] || 0) + a.p;
    const pct = invTotal > 0 ? Math.min(100, (cumNet / invTotal) * 100) : 0, remaining = Math.max(0, invTotal - cumNet), profitOverInv = cumNet - invTotal;
    return `<div class="panel">
      <div class="row">
        <div>
          <span style="font-size:16px;font-weight:700">${meta.icon} ${meta.name}</span>
          <div style="font-size:12px;color:var(--ink-muted)">Total Capital Invested: <b>฿${f2(invTotal)}</b></div>
        </div>
        <span class="badge ${pct >= 100 ? 'badge-green' : 'badge-amber'}" style="font-size:12.5px;padding:4px 10px">${pct >= 100 ? '✅ Paid Back' : `฿${f2(remaining)} left (${r2(pct)}%)`}</span>
      </div>
      <div class="prog-track"><div class="prog-fill" style="width:${pct}%"></div></div>
      <div class="row" style="font-size:12.5px;color:var(--ink-muted);flex-wrap:wrap">
        <span>Cumulative Net Sales: <b style="color:var(--ink)">฿${f2(cumNet)}</b></span>
        <span>Cumulative Net Profit: <b class="${cumProfit < 0 ? 'neg' : 'pos'}">฿${f2(cumProfit)}</b></span>
      </div>
      <div class="row" style="font-size:12.5px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--border);flex-wrap:wrap">
        <span>Profit (Total Sales − Total Investment):</span>
        <b class="${profitOverInv < 0 ? 'neg' : 'pos'}" style="font-size:13px">${profitOverInv < 0 ? '−' : '+'}฿${f2(Math.abs(profitOverInv))}</b>
      </div>
    </div>`;
  };

  const chData = CHN.map(c => ({ ch: c, ...agg(rows.filter(x => matchCh(x[6], c))) }));
  const itemAgg = {};
  rows.forEach(x => {
    const nm = String(x[3]).replace('Guck mal! ', '');
    if (!itemAgg[nm]) itemAgg[nm] = { qty: 0 };
    itemAgg[nm].qty += (+x[5] || 0);
  });
  const topItems = Object.entries(itemAgg).sort((a, b) => b[1].qty - a[1].qty).slice(0, 6);

  const freeRows = rows.filter(x => x[8] === 'FREE');
  const freeQty = freeRows.reduce((a, x) => a + (+x[5] || 0), 0);
  const freeCost = freeRows.reduce((a, x) => a + (+x[14] || 0), 0);

  const totalInv = dashBrand === 'all' ? (getBrandInv('chicken') + getBrandInv('cheesecake')) : getBrandInv(dashBrand);
  const cumSales = dashBrand === 'all' ? (getBrandCumSales('chicken') + getBrandCumSales('cheesecake')) : getBrandCumSales(dashBrand);
  const profitAfterInv = cumSales - totalInv;
  const vol = analyzeOrderVolume(rows);

  $('app').innerHTML = `
    <div class="row" style="margin-bottom:14px;flex-wrap:wrap">
      <div>
        <h2 style="margin:0">Business Performance Dashboard</h2>
        <small style="color:var(--ink-muted)">Real-time revenue, net margin, order timing volume, and payback tracking</small>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="brand-switch">
          ${[['all', 'All Brands'], ['chicken', '🍗 Guck mal!'], ['cheesecake', '🧀 Kuu Kuu']].map(([k, lbl]) =>
            `<button class="brand-pill ${dashBrand === k ? 'on' : ''}" onclick="dashBrand='${k}';vDash()">${lbl}</button>`
          ).join('')}
        </div>
        <div class="brand-switch">
          ${[['today', 'Today'], ['7d', '7 Days'], ['month', 'This Month'], ['all', 'All Time']].map(([k, lbl]) =>
            `<button class="brand-pill ${dashPeriod === k ? 'on' : ''}" onclick="dashPeriod='${k}';vDash()">${lbl}</button>`
          ).join('')}
        </div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-top"><span class="kpi-label">Total Orders</span><span class="kpi-icon">🧾</span></div>
        <div class="kpi-val">${f0(kpi.o)}</div>
        <div class="kpi-sub">Avg Order Value: <b>฿${f2(kpi.aov)}</b></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span class="kpi-label">Net Revenue</span><span class="kpi-icon">💰</span></div>
        <div class="kpi-val">฿${f2(kpi.n)}</div>
        <div class="kpi-sub">Gross Sales: <b>฿${f2(kpi.g)}</b></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span class="kpi-label">Total COGS</span><span class="kpi-icon">📦</span></div>
        <div class="kpi-val">฿${f2(kpi.c)}</div>
        <div class="kpi-sub">Cost Ratio: <b>${kpi.n > 0 ? r2((kpi.c / kpi.n) * 100) : 0}%</b> of net</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span class="kpi-label">Operational Net Profit</span><span class="kpi-icon">📈</span></div>
        <div class="kpi-val ${kpi.p < 0 ? 'neg' : 'pos'}">฿${f2(kpi.p)}</div>
        <div class="kpi-sub">Net Margin: <span class="badge ${kpi.p < 0 ? 'badge-red' : 'badge-green'}">${r2(kpi.margin)}%</span></div>
      </div>
      <div class="kpi-card" style="border-left:4px solid var(--accent)">
        <div class="kpi-top"><span class="kpi-label">Profit (Sales − Inv)</span><span class="kpi-icon">⚖️</span></div>
        <div class="kpi-val ${profitAfterInv < 0 ? 'neg' : 'pos'}">${profitAfterInv < 0 ? '−' : '+'}฿${f2(Math.abs(profitAfterInv))}</div>
        <div class="kpi-sub">Total Sales <b>฿${f2(cumSales)}</b> − Inv <b>฿${f2(totalInv)}</b></div>
      </div>
    </div>

    <div class="two-col">${paybackCard('chicken')}${paybackCard('cheesecake')}</div>

    <div class="two-col">
      <div class="panel">
        <div class="panel-header"><h3 style="margin:0">📊 Daily Net Revenue & Profit Trend</h3><small style="color:var(--ink-muted)">Last 14 active days</small></div>
        <div class="chart-wrap" id="trendChartBox"><canvas id="trendChart"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel-header"><h3 style="margin:0">🛵 Revenue by Sales Channel</h3><small style="color:var(--ink-muted)">Net revenue share</small></div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:12px;align-items:center">
          <div style="height:180px;position:relative" id="channelChartBox"><canvas id="channelChart"></canvas></div>
          <table class="data-table" style="font-size:12.5px">
            <tr><th>Channel</th><th class="n">Ord</th><th class="n">Net</th><th class="n">Profit</th></tr>
            ${chData.map(c => `<tr><td><b>${c.ch}</b></td><td class="n">${c.o}</td><td class="n">฿${f0(c.n)}</td><td class="n ${c.p < 0 ? 'neg' : 'pos'}">฿${f0(c.p)}</td></tr>`).join('')}
          </table>
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <div class="panel-header">
          <div><h3 style="margin:0">📅 Order Volume by Day of Week</h3><small style="color:var(--ink-muted)">Peak vs. slowest sales days (Sun–Sat)</small></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${vol.peakDay ? `<span class="badge badge-green" style="font-size:11px">🔥 Peak: <b>${vol.peakDay.short}</b> (${vol.peakDay.orders} ord)</span>` : ''}
            ${vol.slowDay && vol.peakDay && vol.slowDay.day !== vol.peakDay.day ? `<span class="badge badge-neutral" style="font-size:11px">💤 Slowest: <b>${vol.slowDay.short}</b> (${vol.slowDay.orders} ord)</span>` : ''}
          </div>
        </div>
        <div class="chart-wrap" style="height:210px" id="dayChartBox"><canvas id="dayChart"></canvas></div>
        <div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:4px;margin-top:10px;text-align:center;font-size:11px">
          ${vol.dayStats.map(d => {
            const isPeak = vol.peakDay && d.day === vol.peakDay.day;
            return `<div style="padding:6px 2px;border-radius:8px;background:${isPeak ? 'var(--primary-soft)' : 'var(--bg)'};border:1px solid ${isPeak ? 'var(--primary)' : 'var(--border)'}">
              <b style="color:${isPeak ? 'var(--primary)' : 'var(--ink)'}">${d.short}</b>
              <div style="font-size:13px;font-weight:700;margin:2px 0">${d.orders}</div>
              <div style="color:var(--ink-muted);font-size:9.5px">฿${f0(d.net)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div><h3 style="margin:0">⏰ Order Volume by Time of Day</h3><small style="color:var(--ink-muted)">Rush hours & shift breakdown (09:00–22:00)</small></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${vol.peakHr ? `<span class="badge badge-green" style="font-size:11px">🔥 Rush: <b>${vol.peakHr.label}</b> (${vol.peakHr.orders} ord)</span>` : ''}
            ${vol.slowHr && vol.peakHr && vol.slowHr.orders < vol.peakHr.orders ? `<span class="badge badge-neutral" style="font-size:11px">☕ Quiet: <b>${vol.slowHr.label}</b> (${vol.slowHr.orders} ord)</span>` : ''}
          </div>
        </div>
        <div class="chart-wrap" style="height:210px" id="hourChartBox"><canvas id="hourChart"></canvas></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(110px, 1fr));gap:6px;margin-top:10px">
          ${vol.shifts.filter(s => s.orders > 0 || s.key !== 'night').map(s => `
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:6px 8px;font-size:11px">
              <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.name}</div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:2px">
                <b style="font-size:13px;color:var(--primary)">${s.orders} <small style="font-size:9.5px;font-weight:400;color:var(--ink-muted)">ord</small></b>
                <span style="color:var(--ink-muted);font-size:10px">฿${f0(s.net)}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <div class="panel-header"><h3 style="margin:0">🏆 Best-Selling Menu Items</h3><small style="color:var(--ink-muted)">By units sold</small></div>
        ${topItems.length ? `<div class="chart-wrap" style="height:220px" id="topChartBox"><canvas id="topChart"></canvas></div>` : '<div style="padding:20px;color:var(--ink-muted);text-align:center">No sales recorded yet.</div>'}
      </div>
      <div class="panel">
        <div class="panel-header"><h3 style="margin:0">🎁 Giveaways & Promotional Freebies</h3></div>
        <div class="kpi-grid" style="grid-template-columns:1fr 1fr;margin-bottom:10px">
          <div style="background:var(--bg);padding:12px;border-radius:12px"><small style="color:var(--ink-muted)">Free Items Given</small><div style="font-size:22px;font-weight:700">${f0(freeQty)} pcs</div></div>
          <div style="background:var(--bg);padding:12px;border-radius:12px"><small style="color:var(--ink-muted)">Ingredient Cost Impact</small><div style="font-size:22px;font-weight:700;color:var(--red)">฿${f2(freeCost)}</div></div>
        </div>
        <p style="font-size:12.5px;color:var(--ink-muted);margin:0">Free items record ฿0 revenue while deducting exact ingredient & packaging COGS for accurate net profit.</p>
      </div>
    </div>`;

  renderDashboardCharts(rows, chData, topItems, vol);
}

function renderDashboardCharts(rows, chData, topItems, vol) {
  Object.values(charts).forEach(c => { try { c.destroy(); } catch (e) {} });
  charts = {};

  const dailyMap = {};
  rows.forEach(x => {
    const d = String(x[0]).slice(0, 10);
    if (!dailyMap[d]) dailyMap[d] = { net: 0, profit: 0 };
    dailyMap[d].net += (+x[13] || 0);
    dailyMap[d].profit += (+x[15] || 0);
  });
  const days = Object.keys(dailyMap).sort().slice(-14);

  if (typeof Chart === 'undefined') {
    $('trendChartBox').innerHTML = days.length ? renderSvgBarFallback(days.map(d => ({ label: d.slice(5), val: dailyMap[d].net }))) : '<div style="padding:30px;text-align:center;color:var(--ink-muted)">No sales data yet</div>';
    $('channelChartBox').innerHTML = '<div style="padding:20px;text-align:center;font-size:12px;color:var(--ink-muted)">Breakdown shown on right</div>';
    if ($('topChartBox')) $('topChartBox').innerHTML = renderSvgBarFallback(topItems.map(([n, v]) => ({ label: n.slice(0, 14), val: v.qty })));
    if ($('dayChartBox')) $('dayChartBox').innerHTML = renderSvgBarFallback(vol.dayStats.map(d => ({ label: d.short, val: d.orders })));
    if ($('hourChartBox')) $('hourChartBox').innerHTML = renderSvgBarFallback(vol.activeHours.map(h => ({ label: h.label, val: h.orders })));
    return;
  }

  if ($('trendChart')) {
    charts.trend = new Chart($('trendChart'), {
      type: 'bar',
      data: {
        labels: days.length ? days.map(d => d.slice(5)) : ['No Data'],
        datasets: [
          { label: 'Net Revenue (฿)', data: days.length ? days.map(d => r2(dailyMap[d].net)) : [0], backgroundColor: 'rgba(230, 46, 45, 0.78)', borderRadius: 6 },
          { label: 'Net Profit (฿)', data: days.length ? days.map(d => r2(dailyMap[d].profit)) : [0], type: 'line', borderColor: '#15803D', backgroundColor: '#15803D', tension: 0.3, borderWidth: 2.5, pointRadius: 4 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
    });
  }

  if ($('channelChart')) {
    const hasSales = chData.some(c => c.n > 0);
    charts.channel = new Chart($('channelChart'), {
      type: 'doughnut',
      data: { labels: hasSales ? chData.map(c => c.ch) : ['No Sales'], datasets: [{ data: hasSales ? chData.map(c => r2(c.n)) : [1], backgroundColor: hasSales ? ['#E62E2D', '#16A34A', '#0284C7', '#F59E0B'] : ['#EAE0D2'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { display: false } } }
    });
  }

  if ($('topChart') && topItems.length) {
    charts.top = new Chart($('topChart'), {
      type: 'bar',
      data: { labels: topItems.map(([n]) => n), datasets: [{ label: 'Units Sold', data: topItems.map(([, v]) => v.qty), backgroundColor: '#F5A623', borderRadius: 6 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });
  }

  if ($('dayChart')) {
    charts.day = new Chart($('dayChart'), {
      type: 'bar',
      data: {
        labels: vol.dayStats.map(d => d.short),
        datasets: [{ label: 'Orders', data: vol.dayStats.map(d => d.orders), backgroundColor: vol.dayStats.map(d => (vol.peakDay && d.day === vol.peakDay.day && d.orders > 0) ? '#E62E2D' : 'rgba(230, 46, 45, 0.45)'), borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  if ($('hourChart')) {
    charts.hour = new Chart($('hourChart'), {
      type: 'bar',
      data: {
        labels: vol.activeHours.map(h => h.label),
        datasets: [{ label: 'Orders', data: vol.activeHours.map(h => h.orders), backgroundColor: vol.activeHours.map(h => (vol.peakHr && h.hour === vol.peakHr.hour && h.orders > 0) ? '#16A34A' : 'rgba(245, 166, 35, 0.75)'), borderRadius: 5 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }
}

function renderSvgBarFallback(items) {
  const max = Math.max(1, ...items.map(i => i.val));
  return `<div style="display:flex;align-items:flex-end;gap:8px;height:200px;padding-top:20px">
    ${items.map(i => `<div style="flex:1;text-align:center">
      <div style="font-size:11px;font-weight:600;margin-bottom:4px">${f0(i.val)}</div>
      <div style="height:${Math.max(6, (i.val / max) * 140)}px;background:var(--primary);border-radius:6px 6px 0 0"></div>
      <div style="font-size:10.5px;color:var(--ink-muted);margin-top:4px">${esc(i.label)}</div>
    </div>`).join('')}
  </div>`;
}

// ==================== 4. FINANCIAL REPORTS ====================
function vRep() {
  const keyFn = x => String(x[0]).slice(0, rp.by === 'day' ? 10 : 7);
  const G = {};
  S.sales.filter(x => (rp.b === 'all' || x[2] === rp.b) && (rp.c === 'all' || matchCh(x[6], rp.c))).forEach(x => {
    const k = keyFn(x), g = G[k] = G[k] || { o: new Set(), g: 0, n: 0, c: 0, p: 0 };
    g.o.add(x[1]); g.g += (+x[9] || 0); g.n += (+x[13] || 0); g.c += (+x[14] || 0); g.p += (+x[15] || 0);
  });

  const ks = Object.keys(G).sort().reverse();
  const mx = Math.max(1, ...ks.map(a => G[a].n));
  const T = { o: 0, g: 0, n: 0, c: 0, p: 0 };
  ks.forEach(a => { T.o += G[a].o.size; ['g', 'n', 'c', 'p'].forEach(f => T[f] += G[a][f]); });

  const chips = (key, L) => L.map(([v, t]) => `<button class="chip ${rp[key] === v ? 'primary-on' : ''}" onclick="rp.${key}='${v}';vRep()">${t}</button>`).join('');

  $('app').innerHTML = `
    <div class="row" style="margin-bottom:14px;flex-wrap:wrap">
      <div><h2 style="margin:0">Financial Sales & Profit Reports</h2><small style="color:var(--ink-muted)">Filter by period, brand, or channel and export CSV</small></div>
      <button class="btn btn-outline btn-sm" onclick="exportSalesCsv()">⬇️ Export Sales CSV</button>
    </div>
    <div class="panel" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <div>${chips('by', [['day', 'Per Day'], ['month', 'Per Month']])}</div>
      <span style="color:var(--border-strong)">|</span>
      <div>${chips('b', [['all', 'All Brands'], ['chicken', '🍗 Guck mal!'], ['cheesecake', '🧀 Kuu Kuu']])}</div>
      <span style="color:var(--border-strong)">|</span>
      <div>${chips('c', [['all', 'All Channels'], ...CHN.map(c => [c, c])])}</div>
    </div>
    <div class="panel" style="overflow-x:auto">
      <table class="data-table">
        <tr><th>${rp.by === 'day' ? 'Date' : 'Month'}</th><th class="n">Orders</th><th class="n">Gross Sales</th><th class="n">Net Revenue</th><th class="n">COGS</th><th class="n">Net Profit</th><th class="n">Margin</th></tr>
        ${ks.length ? ks.map(a => `<tr>
          <td><b>${a}</b><div class="prog-track" style="height:6px;margin:4px 0 0"><div class="prog-fill" style="width:${(G[a].n / mx) * 100}%"></div></div></td>
          <td class="n">${G[a].o.size}</td><td class="n">฿${f2(G[a].g)}</td><td class="n"><b>฿${f2(G[a].n)}</b></td>
          <td class="n">฿${f2(G[a].c)}</td><td class="n ${G[a].p < 0 ? 'neg' : 'pos'}"><b>฿${f2(G[a].p)}</b></td>
          <td class="n">${r2(G[a].n > 0 ? (G[a].p / G[a].n) * 100 : 0)}%</td>
        </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--ink-muted)">No sales recorded.</td></tr>'}
        <tr style="background:var(--bg);font-weight:700">
          <td>Total</td><td class="n">${T.o}</td><td class="n">฿${f2(T.g)}</td><td class="n">฿${f2(T.n)}</td>
          <td class="n">฿${f2(T.c)}</td><td class="n ${T.p < 0 ? 'neg' : 'pos'}">฿${f2(T.p)}</td>
          <td class="n">${T.n > 0 ? r2((T.p / T.n) * 100) : 0}%</td>
        </tr>
      </table>
    </div>`;
}

function exportSalesCsv() {
  const headers = ['Date', 'Order', 'Brand', 'Item', 'Sauces', 'Qty', 'Channel', 'UnitPrice', 'Free', 'Gross', 'Discount', 'Extra', 'GP', 'NetRevenue', 'Cost', 'Profit'];
  const csvRows = [headers.join(',')].concat(S.sales.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' }));
  a.download = `GuckMal_POS_Sales_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ==================== 5. MENU, RECIPES & INGREDIENT COSTS ====================
function classifyIngCategory(name, entry) {
  if (entry && entry.cat) return entry.cat;
  return ['ถุง', 'กล่อง', 'ถ้วย', 'กระดาษ', 'ตะเกียบ', 'ช้อน', 'ค่าไฟ', 'ค่าน้ำมัน', 'กระปุก'].some(k => name.includes(k)) ? 'pack' : 'ing';
}

function resetBuilder(targetBrand = brand) {
  builderState = {
    editRow: null, brand: targetBrand, type: 'single', name: '', inn: '', dl: '', sp: '',
    existingImg: '', foodMap: {}, packMap: {}, stepsList: [], foodFilter: '', packFilter: ''
  };
}

function loadItemIntoBuilder(menuIdx) {
  const m = S.menu[menuIdx];
  if (!m) return;
  const fMap = {}, pMap = {};
  parsePairs(m.food).forEach(([k, v]) => fMap[k] = v);
  parsePairs(m.pack).forEach(([k, v]) => pMap[k] = v);
  builderState = {
    editRow: m.row, brand: m.brand, type: m.type || 'single', name: m.name, inn: m.inn, dl: m.dl, sp: m.sp || '',
    existingImg: getMenuImg(m), foodMap: fMap, packMap: pMap,
    stepsList: String(m.steps || '').split(';').filter(Boolean).map(x => { const [item, min] = x.split('@'); return { item: item.trim(), min: +min || 6 }; }),
    foodFilter: '', packFilter: ''
  };
  vMenu();
  const el = $('menuBuilderCard');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function copyRecipeFromItem(menuIdx) {
  if (menuIdx === '') return;
  const m = S.menu[+menuIdx];
  if (!m) return;
  builderState.foodMap = {}; parsePairs(m.food).forEach(([k, v]) => builderState.foodMap[k] = v);
  builderState.packMap = {}; parsePairs(m.pack).forEach(([k, v]) => builderState.packMap[k] = v);
  builderState.stepsList = String(m.steps || '').split(';').filter(Boolean).map(x => { const [item, min] = x.split('@'); return { item: item.trim(), min: +min || 6 }; });
  vMenu();
  toast(`Copied recipe & packaging from ${m.name}`);
}

function getFryableOptions() {
  const baseSet = new Set(['Thigh', 'Bites', 'Fries', 'Pop', 'Nuggets', 'Sticks']);
  S.menu.filter(m => m.brand === 'chicken').forEach(m => {
    String(m.steps || '').split(';').filter(Boolean).forEach(x => { const p = x.split('@')[0].trim(); if (p) baseSet.add(p); });
    if (m.type === 'single') baseSet.add(m.name.replace('Guck mal! ', '').trim());
  });
  return Array.from(baseSet);
}

function vMenu() {
  if (!builderState) resetBuilder(brand);

  const brandMenus = S.menu.filter(m => m.brand === brand);
  const brandIngEntries = Object.entries(S.ing).filter(([, v]) => v.brand === brand);
  const rawIngList = brandIngEntries.filter(([n, v]) => classifyIngCategory(n, v) === 'ing');
  const packList = brandIngEntries.filter(([n, v]) => classifyIngCategory(n, v) === 'pack');

  const filteredIngSection = brandIngEntries.filter(([n]) => !ingSearch.trim() || n.toLowerCase().includes(ingSearch.toLowerCase()));
  const sectionRaw = filteredIngSection.filter(([n, v]) => classifyIngCategory(n, v) === 'ing');
  const sectionPack = filteredIngSection.filter(([n, v]) => classifyIngCategory(n, v) === 'pack');

  const estFoodCost = Object.entries(builderState.foodMap).reduce((a, [n, q]) => a + (+q || 0) * ic(n), 0);
  const estPackCost = Object.entries(builderState.packMap).reduce((a, [n, q]) => a + (+q || 0) * ic(n), 0);
  const estTotalCost = estFoodCost + estPackCost;
  const estInnProfit = (+builderState.inn || 0) - estTotalCost;
  const estDlProfit = ((+builderState.dl || +builderState.inn || 0) * (1 - (S.set.gp || 0))) - estTotalCost;
  const meta = BRAND_META[brand];

  $('app').innerHTML = `
    <div class="row" style="margin-bottom:14px;flex-wrap:wrap">
      <div><h2 style="margin:0">Menu Pricing, Recipes & Unit Costs</h2><small style="color:var(--ink-muted)">Dynamically separated by brand — edit prices or material costs cleanly</small></div>
      ${brandSwitcherHtml(brand)}
    </div>

    <div class="panel" style="overflow-x:auto">
      <div class="panel-header">
        <div>
          <h3 style="margin:0">${meta.icon} ${meta.name} — Menu & Profit Margins (${brandMenus.length} items)</h3>
          <small style="color:var(--ink-muted)">Prices auto-save on change · Leave Shopee blank to inherit Grab/LM price</small>
        </div>
        <button class="btn btn-outline btn-sm" onclick="openPrepGuideModal()">📋 Kitchen Prep Guide</button>
      </div>
      <table class="data-table">
        <tr><th>Menu Item</th><th class="n">Unit Cost</th><th class="n">In-Store ฿</th><th class="n">In-Store Profit</th><th class="n">Grab/LM ฿</th><th class="n">Delivery Profit</th><th class="n">Shopee ฿</th><th class="n">Shopee Profit</th><th style="text-align:right">Actions</th></tr>
        ${brandMenus.map(m => {
          const cost = [...parsePairs(m.food), ...parsePairs(m.pack)].reduce((a, [n, q]) => a + q * ic(n), 0);
          const innP = m.inn - cost, innMargin = m.inn > 0 ? (innP / m.inn) * 100 : 0;
          const dlP = m.dl * (1 - (S.set.gp || 0)) - cost, spP = (m.sp || m.dl) * (1 - (S.set.gp || 0)) - cost;
          const imgUrl = getMenuImg(m), prep = MENU_PREP_SPECS[m.name];
          return `<tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                ${imgUrl ? `<img src="${imgUrl}" style="width:42px;height:42px;border-radius:9px;object-fit:cover;flex-shrink:0">` : `<div style="width:42px;height:42px;border-radius:9px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${meta.icon}</div>`}
                <div>
                  <div style="font-weight:600">${esc(m.name)}</div>
                  <div style="font-size:11.5px;color:var(--ink-muted)"><span class="badge badge-neutral" style="font-size:10px">${esc(m.type)}</span>${m.steps ? ` · 🔥 ${esc(m.steps)}` : ''}</div>
                  ${prep ? `<div style="font-size:11px;color:var(--accent);font-weight:600;margin-top:2px">🍗 ${esc(prep.pieces)} · ⏱️ ${esc(prep.temp)} ${esc(prep.time)}</div>` : ''}
                </div>
              </div>
            </td>
            <td class="n">฿${f2(cost)}</td>
            <td class="n"><input type="number" style="width:68px;padding:5px 7px" value="${m.inn}" onchange="saveMenuPrice('${m.brand}', ${m.row}, 3, this.value)"></td>
            <td class="n ${innP < 0 ? 'neg' : 'pos'}"><b>฿${f2(innP)}</b><br><small style="color:var(--ink-muted)">${r2(innMargin)}%</small></td>
            <td class="n"><input type="number" style="width:68px;padding:5px 7px" value="${m.dl}" onchange="saveMenuPrice('${m.brand}', ${m.row}, 4, this.value)"></td>
            <td class="n ${dlP < 0 ? 'neg' : 'pos'}"><b>฿${f2(dlP)}</b></td>
            <td class="n"><input type="number" style="width:68px;padding:5px 7px" placeholder="${m.dl}" value="${m.sp || ''}" onchange="saveMenuPrice('${m.brand}', ${m.row}, 9, this.value)"></td>
            <td class="n ${spP < 0 ? 'neg' : 'pos'}"><b>฿${f2(spP)}</b></td>
            <td style="text-align:right"><button class="btn btn-outline btn-sm" onclick="loadItemIntoBuilder(${S.menu.indexOf(m)})">✏️ Edit</button></td>
          </tr>`;
        }).join('')}
      </table>
    </div>

    <div class="panel" id="menuBuilderCard" style="${builderState.editRow ? 'border:2px solid var(--accent);' : ''}">
      <div class="panel-header">
        <div>
          <h3 style="margin:0">${builderState.editRow ? `✏️ Edit Menu Item: ${esc(builderState.name)}` : `➕ Add New ${meta.short} Menu Item`}</h3>
          <small style="color:var(--ink-muted)">Structured BOM recipe builder & Air Fryer step selector</small>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select onchange="copyRecipeFromItem(this.value)" style="font-size:12.5px">
            <option value="">📋 Quick-copy recipe/pack from…</option>
            ${brandMenus.map(m => `<option value="${S.menu.indexOf(m)}">${esc(m.name)}</option>`).join('')}
          </select>
          ${builderState.editRow ? `<button class="btn btn-outline btn-sm" onclick="resetBuilder(brand);vMenu()">Cancel Edit</button>` : ''}
        </div>
      </div>

      <div class="two-col" style="margin-bottom:14px">
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Brand</label>
              <select onchange="builderState.brand=this.value;setBrand(this.value)" style="width:100%">
                <option value="chicken" ${builderState.brand === 'chicken' ? 'selected' : ''}>🍗 Guck mal! Chicken</option>
                <option value="cheesecake" ${builderState.brand === 'cheesecake' ? 'selected' : ''}>🧀 Kuu Kuu Cheesecake</option>
              </select>
            </div>
            <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Category Type</label>
              <select onchange="builderState.type=this.value" style="width:100%">
                <option value="single" ${builderState.type === 'single' ? 'selected' : ''}>Single Dish</option>
                <option value="set" ${builderState.type === 'set' ? 'selected' : ''}>Combo / Set</option>
                <option value="addon" ${builderState.type === 'addon' ? 'selected' : ''}>Add-on / Topping</option>
              </select>
            </div>
          </div>
          <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Menu Item Name *</label>
            <input type="text" placeholder="e.g., Guck mal! Spicy Wings" value="${esc(builderState.name)}" oninput="builderState.name=this.value" style="width:100%">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">In-Store ฿ *</label><input type="number" min="0" step="any" placeholder="79" value="${builderState.inn}" oninput="builderState.inn=this.value;updateBuilderPreview()" style="width:100%"></div>
            <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Grab / LM ฿</label><input type="number" min="0" step="any" placeholder="99" value="${builderState.dl}" oninput="builderState.dl=this.value;updateBuilderPreview()" style="width:100%"></div>
            <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Shopee ฿</label><input type="number" min="0" step="any" placeholder="Optional" value="${builderState.sp}" oninput="builderState.sp=this.value" style="width:100%"></div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px">
          <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Menu Photo (Square Thumbnail)</label>
            <div style="display:flex;align-items:center;gap:12px">
              <div id="builderImgPreview" style="width:72px;height:72px;border-radius:12px;border:1.5px dashed var(--border-strong);background:var(--bg);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">
                ${builderState.existingImg ? `<img src="${builderState.existingImg}" style="width:100%;height:100%;object-fit:cover">` : meta.icon}
              </div>
              <input id="builderPhotoInput" type="file" accept="image/*" onchange="previewBuilderPhoto(this)" style="width:100%">
            </div>
          </div>
          ${builderState.brand === 'chicken' ? `
          <div class="recipe-box" style="background:var(--accent-soft);border-color:var(--accent)">
            <div style="font-size:12.5px;font-weight:700;margin-bottom:6px">🔥 Air Fryer Cooking Steps (Item + Minutes)</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              <select id="afItemSelect" style="flex:1;min-width:130px">${getFryableOptions().map(opt => `<option value="${esc(opt)}">${esc(opt)}</option>`).join('')}</select>
              <div class="input-unit"><input id="afMinInput" type="number" min="1" max="60" value="8" style="width:65px"><span>min</span></div>
              <button type="button" class="btn btn-accent btn-sm" onclick="addAirFryerStep()">+ Add Step</button>
            </div>
            <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">${[6, 8, 12, 16].map(m => `<button type="button" class="chip" onclick="$('afMinInput').value=${m}">${m} min</button>`).join('')}</div>
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
              ${builderState.stepsList.length ? builderState.stepsList.map((st, idx) => `<span class="badge badge-neutral" style="background:#fff;padding:4px 9px;font-size:12px">${idx + 1}. <b>${esc(st.item)}</b> · ${st.min} min <button type="button" onclick="builderState.stepsList.splice(${idx},1);vMenu()" style="border:0;background:none;color:var(--red);cursor:pointer;font-weight:700;margin-left:4px">✕</button></span>`).join('') : '<small style="color:var(--ink-muted)">No steps added yet.</small>'}
            </div>
          </div>` : ''}
        </div>
      </div>

      <div class="two-col" style="margin-bottom:14px">
        <div class="recipe-box">
          <div class="row" style="margin-bottom:6px"><b style="font-size:13.5px">🥩 Raw Ingredients (${Object.keys(builderState.foodMap).length})</b><span class="badge badge-neutral">฿${f2(estFoodCost)}</span></div>
          <input type="search" placeholder="Filter ingredients…" value="${esc(builderState.foodFilter)}" oninput="builderState.foodFilter=this.value;vMenu()" style="width:100%;padding:6px 9px;font-size:12.5px">
          <div class="chk-list">${rawIngList.filter(([n]) => !builderState.foodFilter || n.toLowerCase().includes(builderState.foodFilter.toLowerCase())).map(([n, v]) => renderRecipeCheckRow('foodMap', n, v)).join('')}</div>
        </div>
        <div class="recipe-box">
          <div class="row" style="margin-bottom:6px"><b style="font-size:13.5px">📦 Packaging & Utilities (${Object.keys(builderState.packMap).length})</b><span class="badge badge-neutral">฿${f2(estPackCost)}</span></div>
          <input type="search" placeholder="Filter packaging…" value="${esc(builderState.packFilter)}" oninput="builderState.packFilter=this.value;vMenu()" style="width:100%;padding:6px 9px;font-size:12.5px">
          <div class="chk-list">${packList.filter(([n]) => !builderState.packFilter || n.toLowerCase().includes(builderState.packFilter.toLowerCase())).map(([n, v]) => renderRecipeCheckRow('packMap', n, v)).join('')}</div>
        </div>
      </div>

      <div id="builderPreviewBar" style="background:var(--bg);border:1.5px solid var(--border);border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:13px">
          <div>Total Unit COGS: <b>฿${f2(estTotalCost)}</b></div>
          <div>In-Store Profit: <b class="${estInnProfit < 0 ? 'neg' : 'pos'}">฿${f2(estInnProfit)}</b></div>
          <div>Delivery Profit (after GP): <b class="${estDlProfit < 0 ? 'neg' : 'pos'}">฿${f2(estDlProfit)}</b></div>
        </div>
        <button class="btn btn-primary" onclick="saveBuilderMenuItem()">${builderState.editRow ? '💾 Update Menu Item' : '✅ Save New Menu Item'}</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div><h3 style="margin:0">${meta.icon} ${meta.name} — Ingredients & Packaging Costs</h3><small style="color:var(--ink-muted)">Edit pack prices directly — menu COGS and margins update live</small></div>
        <input type="search" placeholder="Search ${meta.short} materials…" value="${esc(ingSearch)}" oninput="ingSearch=this.value;vMenu()" style="width:260px">
      </div>
      <div class="two-col">
        <div><h4 style="margin:0 0 8px;font-size:13.5px;color:var(--ink-muted)">🥩 Raw Ingredients (${sectionRaw.length})</h4>${sectionRaw.length ? sectionRaw.map(([n, v]) => renderIngCostRow(n, v)).join('') : '<div style="color:var(--ink-muted);font-size:13px">No matching items.</div>'}</div>
        <div><h4 style="margin:0 0 8px;font-size:13.5px;color:var(--ink-muted)">📦 Packaging & Utilities (${sectionPack.length})</h4>${sectionPack.length ? sectionPack.map(([n, v]) => renderIngCostRow(n, v)).join('') : '<div style="color:var(--ink-muted);font-size:13px">No matching items.</div>'}</div>
      </div>
      <div style="margin-top:16px;padding-top:14px;border-top:1px dashed var(--border-strong)">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">➕ Add New ${meta.short} Ingredient or Packaging Material</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input id="newIngName" type="text" placeholder="Material name (e.g. ชีสดิป)" style="flex:1;min-width:170px">
          <select id="newIngCat"><option value="ing">Raw Ingredient</option><option value="pack">Packaging / Utility</option></select>
          <input id="newIngPrice" type="number" step="any" placeholder="Pack Price ฿" style="width:110px">
          <input id="newIngBatch" type="number" step="any" placeholder="Pack Size (e.g. 1000)" style="width:140px">
          <input id="newIngUnit" type="text" placeholder="Unit (g, pc, ml)" style="width:110px">
          <button class="btn btn-outline btn-sm" onclick="createNewIngredient()">+ Add Material</button>
        </div>
      </div>
    </div>`;
}

function renderRecipeCheckRow(mapKey, name, info) {
  const checked = Object.prototype.hasOwnProperty.call(builderState[mapKey], name);
  const qty = checked ? builderState[mapKey][name] : 1;
  return `<div class="chk-item ${checked ? 'checked' : ''}">
    <label class="chk-label">
      <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleRecipeComponent('${mapKey}', '${esc(name)}', this.checked)">
      <span>${esc(name)} <small style="color:var(--ink-muted)">(฿${f2(info.cost)}/${esc(info.unit || 'unit')})</small></span>
    </label>
    ${checked ? `<div style="display:flex;align-items:center;gap:5px">
      <input type="number" step="any" min="0" value="${qty}" style="width:72px;padding:4px 6px;font-size:12.5px" oninput="builderState.${mapKey}['${esc(name)}']=+this.value||0;updateBuilderPreview()">
      <span style="font-size:11.5px;color:var(--ink-muted);min-width:26px">${esc(info.unit || '')}</span>
      <span style="font-size:12px;font-weight:700;min-width:54px;text-align:right">฿${f2((+qty || 0) * info.cost)}</span>
    </div>` : ''}
  </div>`;
}

function toggleRecipeComponent(mapKey, name, isChecked) {
  if (isChecked) builderState[mapKey][name] = 1;
  else delete builderState[mapKey][name];
  vMenu();
}

function addAirFryerStep() {
  const item = $('afItemSelect').value, min = Math.max(1, +$('afMinInput').value || 6);
  if (!item) return;
  builderState.stepsList.push({ item, min });
  vMenu();
}

function updateBuilderPreview() {
  const estTotalCost = Object.entries(builderState.foodMap).reduce((a, [n, q]) => a + (+q || 0) * ic(n), 0)
                     + Object.entries(builderState.packMap).reduce((a, [n, q]) => a + (+q || 0) * ic(n), 0);
  const estInnProfit = (+builderState.inn || 0) - estTotalCost;
  const estDlProfit = ((+builderState.dl || +builderState.inn || 0) * (1 - (S.set.gp || 0))) - estTotalCost;
  const bar = $('builderPreviewBar');
  if (bar) {
    bar.firstElementChild.innerHTML = `
      <div>Total Unit COGS: <b>฿${f2(estTotalCost)}</b></div>
      <div>In-Store Profit: <b class="${estInnProfit < 0 ? 'neg' : 'pos'}">฿${f2(estInnProfit)}</b></div>
      <div>Delivery Profit (after GP): <b class="${estDlProfit < 0 ? 'neg' : 'pos'}">฿${f2(estDlProfit)}</b></div>`;
  }
}

function previewBuilderPhoto(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { $('builderImgPreview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`; };
  reader.readAsDataURL(file);
}

async function saveBuilderMenuItem() {
  if (!builderState.name.trim() || !builderState.inn) return toast('Enter Menu Name and In-Store Price');
  const joinMap = m => Object.entries(m).filter(([, q]) => +q > 0).map(([n, q]) => `${n}:${q}`).join(';');
  const rowArr = [
    builderState.name.trim(), builderState.type, +builderState.inn, +builderState.dl || +builderState.inn,
    builderState.existingImg || '', joinMap(builderState.foodMap), joinMap(builderState.packMap),
    builderState.stepsList.map(s => `${s.item}@${s.min}`).join(';'), +builderState.sp || 0
  ];

  const fileInput = $('builderPhotoInput'), file = fileInput && fileInput.files && fileInput.files[0];
  const sendPayload = async imgObj => {
    try {
      await (builderState.editRow ? call('updateMenu', builderState.brand, builderState.editRow, rowArr, imgObj) : call('addMenu', builderState.brand, rowArr, imgObj));
      toast(builderState.editRow ? 'Menu item updated!' : 'New menu item saved!');
      resetBuilder(brand);
      await refreshAndRender(vMenu);
    } catch (e) { toast('Error: ' + e.message); }
  };

  if (!file) return sendPayload(null);
  const im = new Image();
  im.onload = () => {
    const c = document.createElement('canvas'), size = 280;
    c.width = size; c.height = size;
    const minSide = Math.min(im.width, im.height);
    c.getContext('2d').drawImage(im, (im.width - minSide) / 2, (im.height - minSide) / 2, minSide, minSide, 0, 0, size, size);
    sendPayload({ data: c.toDataURL('image/jpeg', 0.82).split(',')[1], mime: 'image/jpeg', name: builderState.name.trim() + '.jpg' });
  };
  im.src = URL.createObjectURL(file);
}

function renderIngCostRow(name, v) {
  return `<div class="set-row" style="padding:8px 0">
    <div><div style="font-weight:600;font-size:13.5px">${esc(name)}</div><div style="font-size:11.5px;color:var(--ink-muted)">Unit cost: <b>฿${f2(v.cost)}</b> / ${esc(v.unit || 'unit')}</div></div>
    <div class="input-unit"><span>฿</span><input type="number" step="any" value="${v.price}" style="width:85px" onchange="updateIngPrice('${esc(name)}', '${v.brand}', this.value)"></div>
  </div>`;
}

async function updateIngPrice(name, b, val) {
  try {
    await call('saveIng', b, name, +val);
    toast(`Updated price for ${name}`);
    await refreshAndRender(vMenu);
  } catch (e) { toast(e.message); }
}

async function createNewIngredient() {
  const name = $('newIngName').value.trim(), cat = $('newIngCat').value, price = +$('newIngPrice').value,
        batch = +$('newIngBatch').value || 1, unit = $('newIngUnit').value.trim() || 'unit';
  if (!name || !price) return toast('Enter material name and pack price');
  try {
    await call('addIng', brand, name, price, batch, unit, cat);
    toast(`Added ${name}`);
    await refreshAndRender(vMenu);
  } catch (e) { toast(e.message); }
}

async function saveMenuPrice(b, row, col, val) {
  try {
    await call('savePrice', b, row, col, +val);
    const m = S.menu.find(x => x.brand === b && x.row === row);
    if (m) m[col === 3 ? 'inn' : col === 4 ? 'dl' : 'sp'] = +val;
    saveCachedLiveState(S);
    toast('Price updated');
    vMenu();
  } catch (e) { toast(e.message); }
}

// ==================== 6. SETTINGS & SMART CAPITAL INVESTMENT LEDGER ====================
function getInvestmentItemOptions(targetBrand) {
  const presets = DEFAULT_INVEST_ITEMS[targetBrand] || [];
  const existing = S.inv.filter(x => x[3] === targetBrand).map(x => String(x[1]).trim()).filter(Boolean);
  return Array.from(new Set([...existing, ...presets]));
}

function onInvestBrandChange() {
  const b = $('invBrandSel').value;
  const sel = $('invItemSel');
  if (!sel) return;
  const opts = getInvestmentItemOptions(b);
  sel.innerHTML = opts.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('') + '<option value="__other__">✏️ Other (type custom item)…</option>';
  onInvestItemSelectChange();
}

function onInvestItemSelectChange() {
  const sel = $('invItemSel'), customInp = $('invCustomItemInp');
  if (!sel || !customInp) return;
  const isOther = sel.value === '__other__';
  customInp.style.display = isOther ? 'block' : 'none';
  if (isOther) customInp.focus();
}

function renderInvestmentLedger() {
  const invSorted = S.inv.slice().sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  if (!invSorted.length) return '<div style="font-size:13px;color:var(--ink-muted)">No additional dated investments logged yet.</div>';

  if (invViewMode === 'flat') {
    return invSorted.map(x => `
      <div class="set-row" style="padding:8px 0">
        <div>
          <span class="badge badge-amber">${x[3] === 'chicken' ? '🍗 Guck mal!' : '🧀 Kuu Kuu'}</span>
          <b style="margin-left:6px">${esc(x[1])}</b>
          <small style="color:var(--ink-muted);margin-left:6px">${String(x[0]).slice(0, 10)}</small>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <b>฿${f2(x[2])}</b>
          <button class="chip" onclick="deleteInvestmentEntry('${x[3]}', ${x[4]})">✕</button>
        </div>
      </div>`).join('');
  }

  // Grouped View: Sum same item + list purchase dates cleanly underneath
  const groups = {};
  invSorted.forEach(x => {
    const key = `${x[3]}||${String(x[1]).trim().toLowerCase()}`;
    if (!groups[key]) groups[key] = { brand: x[3], name: String(x[1]).trim(), total: 0, entries: [] };
    groups[key].total += (+x[2] || 0);
    groups[key].entries.push({ date: String(x[0]).slice(0, 10), amount: +x[2] || 0, row: x[4] });
  });

  return Object.values(groups).sort((a, b) => b.total - a.total).map(g => `
    <div class="inv-group-card">
      <div class="inv-group-head">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="badge badge-amber">${g.brand === 'chicken' ? '🍗 Guck mal!' : '🧀 Kuu Kuu'}</span>
          <b style="font-size:14.5px">${esc(g.name)}</b>
          <span class="badge badge-neutral">${g.entries.length} purchase${g.entries.length > 1 ? 's' : ''}</span>
        </div>
        <b style="font-size:16px;color:var(--primary)">Total ฿${f2(g.total)}</b>
      </div>
      <div class="inv-sub-list">
        ${g.entries.map(e => `
          <div class="inv-sub-row">
            <span style="color:var(--ink-muted)">📅 ${esc(e.date)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <b>฿${f2(e.amount)}</b>
              <button class="chip" style="padding:1px 7px;font-size:11px" onclick="deleteInvestmentEntry('${g.brand}', ${e.row})" title="Delete entry">✕</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function vSet() {
  const knownKeys = new Set(SETTING_GROUPS.flatMap(g => g.items.map(i => i.key)));
  const extraKeys = Object.keys(S.set).filter(k => !knownKeys.has(k));

  const renderSettingRow = item => {
    const rawVal = S.set[item.key] ?? 0;
    const displayVal = item.isPct ? r2(rawVal * 100) : rawVal;
    return `<div class="set-row">
      <div class="set-info"><div class="set-title">${esc(item.title)}</div><div class="set-desc">${esc(item.desc)}</div></div>
      <div class="input-unit"><input type="number" step="any" value="${displayVal}" onchange="updateSetting('${item.key}', this.value, ${!!item.isPct})"><span>${item.unit}</span></div>
    </div>`;
  };

  const initialOpts = getInvestmentItemOptions('chicken');

  $('app').innerHTML = `
    <div style="margin-bottom:14px"><h2 style="margin:0">POS Settings & Capital Tracking</h2><small style="color:var(--ink-muted)">All changes save automatically</small></div>

    ${SETTING_GROUPS.map(g => `<div class="panel"><h3 style="margin:0">${g.title}</h3><small style="color:var(--ink-muted);display:block;margin-bottom:8px">${g.desc}</small>${g.items.map(renderSettingRow).join('')}</div>`).join('')}

    ${extraKeys.length ? `<div class="panel"><h3>Additional Parameters</h3>${extraKeys.map(k => renderSettingRow({ key: k, title: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), desc: 'Custom parameter in POS_Settings', unit: 'val' })).join('')}</div>` : ''}

    <div class="panel">
      <div class="panel-header">
        <div>
          <h3 style="margin:0">💸 Capital Investments Log</h3>
          <small style="color:var(--ink-muted)">Select an existing item to auto-sum its purchases, or choose "Other" to type a new item</small>
        </div>
        <div class="brand-switch">
          <button class="brand-pill ${invViewMode === 'grouped' ? 'on' : ''}" onclick="invViewMode='grouped';vSet()">📦 Grouped & Summed</button>
          <button class="brand-pill ${invViewMode === 'flat' ? 'on' : ''}" onclick="invViewMode='flat';vSet()">📅 By Date</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
        <select id="invBrandSel" onchange="onInvestBrandChange()">
          <option value="chicken">🍗 Guck mal! Chicken</option>
          <option value="cheesecake">🧀 Kuu Kuu Cheesecake</option>
        </select>
        <input id="invDateInp" type="date" value="${new Date().toLocaleDateString('sv', { timeZone: 'Asia/Bangkok' })}">
        <select id="invItemSel" onchange="onInvestItemSelectChange()" style="flex:1;min-width:190px">
          ${initialOpts.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}
          <option value="__other__">✏️ Other (type custom item)…</option>
        </select>
        <input id="invCustomItemInp" type="text" placeholder="Enter custom item name…" style="display:none;flex:1;min-width:180px">
        <input id="invAmtInp" type="number" step="any" placeholder="Amount ฿" style="width:120px">
        <button class="btn btn-primary btn-sm" onclick="addInvestmentEntry()">+ Add Investment</button>
      </div>

      ${renderInvestmentLedger()}
    </div>

    <div class="panel">
      <h3 style="margin:0 0 4px">💾 Data Backup & Local File Tools</h3>
      <small style="color:var(--ink-muted);display:block;margin-bottom:12px">Export a full JSON snapshot or restore from a backup file.</small>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" onclick="exportFullBackup()">⬇️ Download Full JSON Backup</button>
        ${!IS_GAS ? `<label class="btn btn-outline btn-sm" style="cursor:pointer">⬆️ Import JSON Backup<input type="file" accept=".json" style="display:none" onchange="importFullBackup(this)"></label><button class="btn btn-danger-outline btn-sm" onclick="resetLocalDefaults()">🔄 Reset Local Defaults</button>` : ''}
      </div>
    </div>`;
}

async function updateSetting(key, rawInput, isPct) {
  const num = +rawInput;
  if (Number.isNaN(num)) return;
  const storedVal = isPct ? r2(num / 100) : num;
  try {
    await call('saveSet', key, storedVal);
    S.set[key] = storedVal;
    saveCachedLiveState(S);
    toast('Setting saved');
  } catch (e) { toast(e.message); }
}

async function addInvestmentEntry() {
  const amt = +$('invAmtInp').value;
  const selVal = $('invItemSel').value;
  const item = selVal === '__other__' ? $('invCustomItemInp').value.trim() : selVal;
  if (!amt || !item) return toast('Select or enter an item description and amount');
  try {
    await call('addInvest', $('invBrandSel').value, $('invDateInp').value, item, amt);
    toast(`Recorded ฿${f2(amt)} for "${item}"`);
    await refreshAndRender(vSet);
  } catch (e) { toast(e.message); }
}

async function deleteInvestmentEntry(b, row) {
  if (!confirm('Delete this investment entry?')) return;
  try {
    await call('delInvest', b, row);
    toast('Investment entry removed');
    await refreshAndRender(vSet);
  } catch (e) { toast(e.message); }
}

function exportFullBackup() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
  a.download = `GuckMal_POS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

function importFullBackup(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.menu || !parsed.set) throw new Error('Invalid backup file');
      saveLocalDB(parsed);
      initApp();
      toast('Backup restored!');
    } catch (err) { toast('Failed to import backup: ' + err.message); }
  };
  reader.readAsText(file);
}

function resetLocalDefaults() {
  if (!confirm('Reset local storage back to default menu, photos, and settings?')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LIVE_CACHE_KEY);
  initApp();
  toast('Reset to defaults');
}

// ==================== LIFECYCLE & BACKGROUND SYNC ====================
async function initApp() {
  // Stale-while-revalidate: render cached state immediately (< 50ms) if available
  const cached = loadCachedLiveState();
  if (cached) {
    S = cached;
    resetBuilder(brand);
    draw();
  }
  await syncLiveState(false);
  if (!builderState) resetBuilder(brand);
}

// Throttled auto-sync when returning to tab or every 60s
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncLiveState(false);
});
window.addEventListener('focus', () => syncLiveState(false));
setInterval(() => {
  if (document.visibilityState === 'visible') syncLiveState(false);
}, 60000);

initApp();
