const IDS = {
  chicken: '1LrzcU8AAW99UhVyVqcWksKTZtlO3IwxNWKEUmzuffJI',
  cheesecake: '1fQr68HQt7Tbd8nmXx4zl_GHjdRnzbtlRIQlOhanZo5c'
};
const CH = ['chicken', 'cheesecake'];
const MH = ['Menu', 'Type', 'InStore', 'Delivery', 'Image', 'Food', 'Pack', 'Steps', 'Shopee'];
const IH = ['Date', 'Item', 'Amount'];
const SH = ['Date', 'Order', 'Brand', 'Item', 'Sauces', 'Qty', 'Channel', 'UnitPrice', 'Free', 'Gross', 'Discount', 'Extra', 'GP', 'NetRevenue', 'Cost', 'Profit'];
const CH_CANCEL = ['CancelledAt', 'Reason'].concat(SH);
const DEF = {
  gp: 0.321,
  bundle: 0.17,
  bundle_2: 0.17,
  bundle_3: 0.15,
  tartar_in: 10,
  tartar_dl: 15,
  preheat: 3,
  order_edit_hours: 24,
  inv_chicken: 2843,
  inv_cheesecake: 4685,
  open_net_chicken: 2479.09,
  open_net_cheesecake: 2052.33,
  open_profit_chicken: 1280.23,
  open_profit_cheesecake: 863.14
};

const _ssCache = {};
function ss_(b) {
  if (!_ssCache[b]) {
    _ssCache[b] = SpreadsheetApp.openById(IDS[b]);
  }
  return _ssCache[b];
}

const dt_ = (v, b) => v instanceof Date ? Utilities.formatDate(v, ss_(b).getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss') : v;

function clearCache_() {
  try {
    CacheService.getScriptCache().remove('pos_state');
  } catch (e) {}
}

// ---------- Input validation helpers ----------
function requireBrand_(b) {
  if (CH.indexOf(b) === -1) throw new Error('Invalid brand: ' + b);
}
function requireString_(v, label) {
  if (typeof v !== 'string' || !v.trim()) throw new Error(label + ' must be a non-empty string');
}
function requireNumber_(v, label) {
  if (typeof v !== 'number' || isNaN(v)) throw new Error(label + ' must be a valid number');
}
function requirePositiveInt_(v, label) {
  if (typeof v !== 'number' || isNaN(v) || v < 1 || v !== Math.floor(v)) throw new Error(label + ' must be a positive integer');
}
function requireArray_(v, label) {
  if (!Array.isArray(v) || v.length === 0) throw new Error(label + ' must be a non-empty array');
}

function tab_(b, n, h) {
  const s = ss_(b);
  let t = s.getSheetByName(n);
  if (!t) {
    t = s.insertSheet(n);
    t.appendRow(h);
  }
  return t;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'state') {
    return ContentService.createTextOutput(JSON.stringify(getState()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Guck mal! & Kuu Kuu POS')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width,initial-scale=1');
  } catch (err) {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Guck mal! & Kuu Kuu POS')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width,initial-scale=1');
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Whitelist of functions the frontend is allowed to call via doPost.
const ALLOWED_FN = [
  'getState', 'saveOrder', 'deleteOrder', 'cancelOrder', 'replaceOrder',
  'restoreOrder', 'saveIng', 'addIng', 'saveSet', 'addMenu', 'updateMenu',
  'addInvest', 'delInvest', 'savePrice'
];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const fn = body.fn;
  const args = body.args || [];
  if (ALLOWED_FN.indexOf(fn) === -1) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unknown function: ' + fn }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    const result = this[fn](...args);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function menuSeed_() {
  const P = 'ถุงพลาสติก:1;กล่อง:1;ถ้วยน้ำจิ้ม:1;กระดาษไขรองกล่อง:0.5;ตะเกียบ:1;ค่าไฟ:1;ค่าน้ำมัน:10';
  const T = 'เนื้อสะโพกไก่กรอบ:92', B = 'ชังกี้ไบท์:107.3', F = 'Wegde Fries Mccain:100',
        O = 'ไก่ป๊อบ:96.9', N = 'นักเก็ต:124.2', K = 'Chicky Stick:103';
  const j = (...a) => a.join(';'), G = 'Guck mal! ';
  return {
    chicken: [
      [G + 'Crispy Thigh', 'single', 59, 79, '', T, P, 'Thigh@16'],
      [G + 'Boneless Bites', 'single', 49, 59, '', B, P, 'Bites@8'],
      [G + 'Wedge Fries', 'single', 79, 109, '', F, P, 'Fries@12'],
      [G + 'Chicken Pop', 'single', 49, 59, '', O, P, 'Pop@6'],
      [G + 'Chicken Nuggets', 'single', 79, 89, '', N, P, 'Nuggets@12'],
      [G + 'Crispy Sticks', 'single', 79, 89, '', K, P, 'Sticks@6'],
      [G + 'Thighny Sticks', 'set', 99, 129, '', j(T, K), P, 'Sticks@6;Thigh@16'],
      [G + 'Thighny Bites', 'set', 89, 119, '', j(T, B), P, 'Bites@8;Thigh@16'],
      [G + 'Duo Snacks', 'set', 99, 129, '', j(O, N), P, 'Pop@6;Nuggets@7'],
      [G + 'Happy Trio', 'set', 139, 179, '', j(T, B, N), P, 'Bites@8;Nuggets@12;Thigh@16'],
      [G + 'Party Trio', 'set', 129, 169, '', j(B, O, K), P, 'Pop@6;Bites@6;Sticks@6'],
      ['Rice', 'addon', 10, 15, '', 'ข้าวสวย:150', 'กล่อง:1;กระดาษไขรองกล่อง:0.5', '']
    ],
    cheesecake: [
      ['Cheesecake 10 cm', 'single', 150, 189, '', 'ครีมชีส:100;ไข่ไก่เบอร์ 1:0.75;น้ำตาล:25;เกลือ:0.25;เลม่อน:1.75;วิปครีม:50;กลิ่นวนิลา:1.25;แป้งข้าวโพด:2.5', 'ถุงกระดาษ:1;กล่องกลม:1;ช้อน:2;กระดาษไขรองอบ:1;ค่าไฟ:1', ''],
      ['Biscoff topping', 'addon', 20, 20, '', 'Biscoff แท่ง:23.4', 'กระปุกบิสคอฟ:1', '']
    ]
  };
}

function ensure_() {
  const seed = menuSeed_();
  CH.forEach(b => {
    const t = tab_(b, 'POS_Menu', MH);
    if (t.getRange(1, 9).getValue() !== 'Shopee') t.getRange(1, 9).setValue('Shopee');
    if (t.getLastRow() < 2) {
      t.getRange(2, 1, seed[b].length, MH.length).setValues(seed[b].map(r => r.concat([''])));
    }
    tab_(b, 'POS_Sales', SH);
    tab_(b, 'POS_Investments', IH);
    tab_(b, 'POS_Cancelled', CH_CANCEL);
    cleanSales_(b);
  });
  const s = tab_('chicken', 'POS_Settings', ['Key', 'Value']);
  if (s.getLastRow() < 2) {
    const r = Object.entries(DEF);
    s.getRange(2, 1, r.length, 2).setValues(r);
  } else {
    // Auto-sync any missing keys from DEF into POS_Settings
    const d = s.getDataRange().getValues();
    const existing = {};
    for (let i = 1; i < d.length; i++) {
      if (d[i][0]) existing[d[i][0]] = true;
    }
    const toAppend = [];
    Object.keys(DEF).forEach(k => {
      if (!existing[k]) toAppend.push([k, DEF[k]]);
    });
    if (toAppend.length) {
      s.getRange(s.getLastRow() + 1, 1, toAppend.length, 2).setValues(toAppend);
    }
  }
}

// ---------- Cleanup of hand-entered / imported POS_Sales rows ----------
const CHANNEL_STD = {
  'in store': 'In-store', 'instore': 'In-store', 'in-store': 'In-store', 'walk in': 'In-store', 'walk-in': 'In-store',
  'dine in': 'In-store', 'dine-in': 'In-store', 'take away': 'In-store', 'takeaway': 'In-store',
  'grab': 'Grab', 'grabfood': 'Grab', 'grab food': 'Grab',
  'lineman': 'Lineman', 'line man': 'Lineman',
  'shopee': 'Shopee', 'shopeefood': 'Shopee', 'shopee food': 'Shopee'
};

// Returns {y, mo, d, h, mi, s} or null. Reads Date objects, "yyyy-MM-dd HH:mm[:ss]" and "dd/MM[/yyyy] HH:mm".
function dtParts_(v, tz) {
  if (v instanceof Date) {
    const f = Utilities.formatDate(v, tz, 'yyyy-M-d-H-m-s').split('-').map(Number);
    return { y: f[0], mo: f[1], d: f[2], h: f[3], mi: f[4], s: f[5] };
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(\d{1,2})[:.](\d{2}))?/);
  if (m) {
    let y = m[3] ? +m[3] : new Date().getFullYear();
    if (y < 100) y += 2000;
    if (y > 2400) y -= 543;            // Buddhist-era year
    return { y: y, mo: +m[2], d: +m[1], h: +(m[4] || 0), mi: +(m[5] || 0), s: 0 };
  }
  return null;
}

function cleanSales_(b) {
  const t = ss_(b).getSheetByName('POS_Sales');
  if (!t || t.getLastRow() < 2) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log('cleanSales_: could not acquire lock for brand ' + b + ', skipping cleanup');
    return;
  }
  try {
    const tz = t.getParent().getSpreadsheetTimeZone();
    const rng = t.getRange(2, 1, t.getLastRow() - 1, SH.length);
    const d = rng.getValues();
    const p2 = n => ('0' + n).slice(-2);
    let changed = false;

    d.forEach(r => {
      if (r.every(v => v === '' || v === null)) return;

      // Date -> same text format the app writes (yyyy-MM-dd HH:mm:ss)
      const p = r[0] !== '' ? dtParts_(r[0], tz) : null;
      if (p) {
        const txt = p.y + '-' + p2(p.mo) + '-' + p2(p.d) + ' ' + p2(p.h) + ':' + p2(p.mi) + ':' + p2(p.s);
        if (r[0] !== txt) { r[0] = txt; changed = true; }
      }

      // Order ID: same date+time = same order, e.g. IMP-2611081300
      if (!String(r[1]).trim() && p) {
        r[1] = 'IMP-' + String(p.y).slice(-2) + p2(p.mo) + p2(p.d) + p2(p.h) + p2(p.mi);
        changed = true;
      }

      // Brand: lowercase (blank -> this sheet's brand)
      let br = String(r[2]).trim().toLowerCase();
      if (!br) br = b;
      else if (/cheese|kuu/.test(br)) br = 'cheesecake';
      else if (/guck|chick/.test(br)) br = 'chicken';
      if (r[2] !== br) { r[2] = br; changed = true; }

      // Channel: standardise
      if (r[6] !== '') {
        const raw = String(r[6]).trim();
        const std = CHANNEL_STD[raw.toLowerCase()] || raw;
        if (r[6] !== std) { r[6] = std; changed = true; }
      }

      // Free: TRUE -> "FREE", FALSE -> blank
      const f = String(r[8]).trim().toUpperCase();
      const free = (r[8] === true || f === 'TRUE' || f === 'FREE') ? 'FREE' : '';
      if (r[8] !== free) { r[8] = free; changed = true; }
    });

    if (changed) {
      t.getRange(2, 1, d.length, 2).setNumberFormat('@');   // keep Date and Order as text
      rng.setValues(d);
    }
  } finally {
    lock.releaseLock();
  }
}

function getState() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get('pos_state');
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const o = { menu: [], ing: {}, sales: [], set: {}, inv: [], cancelled: [] };
  CH.forEach(b => {
    const s = ss_(b);

    const mSheet = s.getSheetByName('POS_Menu');
    if (mSheet) {
      mSheet.getDataRange().getValues().slice(1).forEach((r, i) => {
        if (r[0]) {
          o.menu.push({
            brand: b,
            row: i + 2,
            name: r[0],
            type: r[1],
            inn: +r[2],
            dl: +r[3],
            img: r[4],
            food: r[5],
            pack: r[6],
            steps: r[7],
            sp: +r[8] || 0
          });
        }
      });
    }

    const costSheet = s.getSheetByName('Cost');
    if (costSheet) {
      costSheet.getDataRange().getValues().slice(1).forEach((r, i) => {
        if (r[0]) {
          o.ing[r[0]] = {
            brand: b,
            row: i + 2,
            price: +r[1],
            batch: +r[2] || 1,
            unit: r[3] || 'unit',
            cost: +r[4] || (+r[1] / (+r[2] || 1))
          };
        }
      });
    }

    const salesSheet = s.getSheetByName('POS_Sales');
    if (salesSheet) {
      salesSheet.getDataRange().getValues().slice(1).forEach(r => {
        if (r[1]) {
          r[0] = dt_(r[0], b);
          o.sales.push(r);
        }
      });
    }

    const invSheet = s.getSheetByName('POS_Investments');
    if (invSheet) {
      invSheet.getDataRange().getValues().slice(1).forEach((r, i) => {
        if (r[2] !== '') o.inv.push([dt_(r[0], b), r[1], +r[2], b, i + 2]);
      });
    }

    const cSheet = s.getSheetByName('POS_Cancelled');
    if (cSheet) {
      cSheet.getDataRange().getValues().slice(1).forEach(r => {
        if (r[3]) {
          r[0] = dt_(r[0], b);
          r[2] = dt_(r[2], b);
          o.cancelled.push(r);
        }
      });
    }
  });

  const setSheet = ss_('chicken').getSheetByName('POS_Settings');
  if (setSheet) {
    setSheet.getDataRange().getValues().slice(1).forEach(r => {
      if (r[0]) o.set[r[0]] = +r[1];
    });
  }

  try {
    const jsonStr = JSON.stringify(o);
    if (jsonStr.length < 95000) {
      cache.put('pos_state', jsonStr, 300); // Cache for 5 min (invalidated on write)
    }
  } catch (e) {}

  return o;
}

function saveOrder(rows) {
  requireArray_(rows, 'rows');
  CH.forEach(b => {
    const mine = rows.filter(r => r[2] === b);
    if (mine.length) {
      const t = tab_(b, 'POS_Sales', SH);
      const n = t.getLastRow() + 1;
      t.getRange(n, 1, mine.length, 1).setNumberFormat('@');
      t.getRange(n, 1, mine.length, SH.length).setValues(mine);
    }
  });
  clearCache_();
  return true;
}

function deleteOrder(id) {
  requireString_(String(id), 'Order ID');
  CH.forEach(b => {
    const t = ss_(b).getSheetByName('POS_Sales');
    if (!t) return;
    const d = t.getDataRange().getValues();
    for (let i = d.length - 1; i > 0; i--) {
      if (d[i][1] === id) t.deleteRow(i + 1);
    }
  });
  clearCache_();
  return true;
}

// Check if order edit/cancel is within allowed time window
function checkOrderEditAllowed_(id) {
  let maxHours = 24;
  try {
    const s = ss_('chicken').getSheetByName('POS_Settings');
    if (s) {
      const vals = s.getDataRange().getValues();
      for (let i = 1; i < vals.length; i++) {
        if (vals[i][0] === 'order_edit_hours') {
          const v = Number(vals[i][1]);
          if (!isNaN(v)) maxHours = v;
          break;
        }
      }
    }
  } catch (e) {}
  if (maxHours <= 0) return;

  for (let bi = 0; bi < CH.length; bi++) {
    const b = CH[bi];
    const t = ss_(b).getSheetByName('POS_Sales');
    if (!t) continue;
    const d = t.getDataRange().getValues();
    const tz = t.getParent().getSpreadsheetTimeZone();
    for (let i = 1; i < d.length; i++) {
      if (d[i][1] === id) {
        const p = dtParts_(d[i][0], tz);
        if (p) {
          const orderDate = new Date(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
          const diffHours = (Date.now() - orderDate.getTime()) / 3600000;
          if (diffHours > maxHours) {
            throw new Error('Order #' + id + ' is locked. Modifications are not allowed after ' + maxHours + ' hours (' + Math.floor(diffHours) + 'h elapsed).');
          }
        }
        return;
      }
    }
  }
}

function cancelOrder(id, reason) {
  requireString_(String(id), 'Order ID');
  checkOrderEditAllowed_(id);
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  CH.forEach(b => {
    const t = ss_(b).getSheetByName('POS_Sales');
    if (!t) return;
    const cTab = tab_(b, 'POS_Cancelled', CH_CANCEL);
    const d = t.getDataRange().getValues();
    const toArchive = [];
    for (let i = d.length - 1; i > 0; i--) {
      if (d[i][1] === id) {
        const rowCopy = d[i].slice();
        rowCopy[0] = dt_(rowCopy[0], b);
        toArchive.unshift([nowStr, reason || 'Cancelled by user'].concat(rowCopy));
        t.deleteRow(i + 1);
      }
    }
    if (toArchive.length) {
      const n = cTab.getLastRow() + 1;
      cTab.getRange(n, 1, toArchive.length, 1).setNumberFormat('@');
      cTab.getRange(n, 3, toArchive.length, 1).setNumberFormat('@');
      cTab.getRange(n, 1, toArchive.length, CH_CANCEL.length).setValues(toArchive);
    }
  });
  clearCache_();
  return true;
}

function restoreOrder(id) {
  requireString_(String(id), 'Order ID');
  CH.forEach(b => {
    const cTab = ss_(b).getSheetByName('POS_Cancelled');
    if (!cTab) return;
    const sTab = tab_(b, 'POS_Sales', SH);
    const d = cTab.getDataRange().getValues();
    const toRestore = [];
    for (let i = d.length - 1; i > 0; i--) {
      if (d[i][3] === id) {
        toRestore.unshift(d[i].slice(2));
        cTab.deleteRow(i + 1);
      }
    }
    if (toRestore.length) {
      const n = sTab.getLastRow() + 1;
      sTab.getRange(n, 1, toRestore.length, 1).setNumberFormat('@');
      sTab.getRange(n, 1, toRestore.length, SH.length).setValues(toRestore);
    }
  });
  clearCache_();
  return true;
}

function replaceOrder(id, rows) {
  requireString_(String(id), 'Order ID');
  requireArray_(rows, 'rows');
  checkOrderEditAllowed_(id);
  deleteOrder(id);
  return saveOrder(rows);
}

function saveIng(brand, name, price) {
  requireBrand_(brand);
  requireString_(name, 'Ingredient name');
  requireNumber_(+price, 'Price');
  const t = ss_(brand).getSheetByName('Cost');
  if (!t) return false;
  const r = t.getDataRange().getValues().findIndex((x, i) => i > 0 && x[0] === name) + 1;
  if (r > 0) {
    t.getRange(r, 2).setValue(+price);
    const c = t.getRange(r, 5);
    if (!c.getFormula()) c.setValue((+price) / (t.getRange(r, 3).getValue() || 1));
  }
  clearCache_();
  return true;
}

function addIng(brand, name, price, batch, unit) {
  requireBrand_(brand);
  requireString_(name, 'Ingredient name');
  requireNumber_(+price, 'Price');
  const t = ss_(brand).getSheetByName('Cost');
  if (!t) return false;
  const bQty = +batch || 1;
  t.appendRow([name, +price, bQty, unit || 'unit', (+price) / bQty]);
  clearCache_();
  return true;
}

function saveSet(key, val) {
  requireString_(key, 'Setting key');
  const t = tab_('chicken', 'POS_Settings');
  const d = t.getDataRange().getValues();
  const i = d.findIndex(x => x[0] === key);
  if (i < 0) t.appendRow([key, val]);
  else t.getRange(i + 1, 2).setValue(val);
  clearCache_();
  return true;
}

function uploadImg_(img, fallbackName) {
  if (!img || !img.data) return '';
  const f = DriveApp.createFile(Utilities.newBlob(Utilities.base64Decode(img.data), img.mime || 'image/jpeg', img.name || fallbackName || 'menu.jpg'));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w400';
}

function addMenu(brand, row, img) {
  requireBrand_(brand);
  requireArray_(row, 'Menu row');
  if (img && img.data) {
    row[4] = uploadImg_(img, row[0] + '.jpg');
  }
  while (row.length < MH.length) row.push('');
  tab_(brand, 'POS_Menu', MH).appendRow(row.slice(0, MH.length));
  clearCache_();
  return true;
}

function updateMenu(brand, rowIdx, row, img) {
  requireBrand_(brand);
  requirePositiveInt_(+rowIdx, 'Row index');
  requireArray_(row, 'Menu row');
  const t = tab_(brand, 'POS_Menu', MH);
  if (img && img.data) {
    row[4] = uploadImg_(img, row[0] + '.jpg');
  }
  while (row.length < MH.length) row.push('');
  t.getRange(+rowIdx, 1, 1, MH.length).setValues([row.slice(0, MH.length)]);
  clearCache_();
  return true;
}

function addInvest(brand, date, item, amount) {
  requireBrand_(brand);
  requireString_(item, 'Investment item');
  requireNumber_(+amount, 'Amount');
  const t = tab_(brand, 'POS_Investments', IH);
  const n = t.getLastRow() + 1;
  t.getRange(n, 1).setNumberFormat('@');
  t.getRange(n, 1, 1, 3).setValues([[date, item, +amount]]);
  clearCache_();
  return true;
}

function delInvest(brand, row) {
  requireBrand_(brand);
  requirePositiveInt_(+row, 'Row index');
  ss_(brand).getSheetByName('POS_Investments').deleteRow(+row);
  clearCache_();
  return true;
}

function savePrice(brand, row, col, val) {
  requireBrand_(brand);
  requirePositiveInt_(+row, 'Row index');
  requirePositiveInt_(+col, 'Column index');
  requireNumber_(+val, 'Price value');
  ss_(brand).getSheetByName('POS_Menu').getRange(+row, +col).setValue(+val);
  clearCache_();
  return true;
}
