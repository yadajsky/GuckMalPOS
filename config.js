/**
 * Static Configuration, Brand Themes, Kitchen Prep Specs & Settings Definitions
 */

const SAUCES = ['ซอสมะเขือเทศ', 'ซอสพริก', 'มายองเนส', 'ทาร์ทาร์ซอส'];

const SAUCE_ICONS = {
  'ซอสมะเขือเทศ': '🍅',
  'ซอสพริก': '🌶️',
  'มายองเนส': '🥣',
  'ทาร์ทาร์ซอส': '🥒'
};

const CHN = ['In-store', 'Grab', 'Lineman', 'Shopee'];

const BRAND_META = {
  chicken: {
    name: 'Guck mal! Chicken',
    short: 'Guck mal!',
    icon: '🍗',
    primary: '#E62E2D',
    primarySoft: '#FFF0F0',
    accent: '#F5A623',
    accentSoft: '#FFF8EB',
    bg: '#FAF7F2'
  },
  cheesecake: {
    name: 'Kuu Kuu Cheesecake',
    short: 'Kuu Kuu',
    icon: '🧀',
    primary: '#D94E4E',
    primarySoft: '#FDF0F0',
    accent: '#F0A830',
    accentSoft: '#FFF8EA',
    bg: '#FDF8F3'
  }
};

// Kitchen preparation piece counts & air fryer parameters (from Guck_mal_Prep.txt)
const MENU_PREP_SPECS = {
  'Guck mal! Crispy Thigh': {
    brand: 'chicken',
    pieces: 'สะโพกไก่กรอบ 1 ชิ้น',
    shortPortion: 'สะโพก 1 ชิ้น',
    temp: '200°C',
    time: '16 นาที',
    instruction: 'หม้อทอด 200°C ทอด 16 นาที'
  },
  'Guck mal! Boneless Bites': {
    brand: 'chicken',
    pieces: 'ชังกี้ไบท์ 7 ชิ้น',
    shortPortion: 'ชังกี้ไบท์ 7 ชิ้น',
    temp: '200°C',
    time: '8 นาที',
    instruction: 'หม้อทอด 200°C ทอด 8 นาที'
  },
  'Guck mal! Wedge Fries': {
    brand: 'chicken',
    pieces: 'Wedge Fries 100g',
    shortPortion: '100g',
    temp: '200°C',
    time: '12 นาที',
    instruction: 'หม้อทอด 200°C ทอด 12 นาที'
  },
  'Guck mal! Chicken Pop': {
    brand: 'chicken',
    pieces: 'ไก่ป๊อบ 8 ชิ้น',
    shortPortion: 'ไก่ป๊อบ 8 ชิ้น',
    temp: '200°C',
    time: '6 นาที',
    instruction: 'หม้อทอด 200°C ทอด 6 นาที'
  },
  'Guck mal! Chicken Nuggets': {
    brand: 'chicken',
    pieces: 'นักเก็ต 6 ชิ้น',
    shortPortion: 'นักเก็ต 6 ชิ้น',
    temp: '200°C',
    time: '12 นาที',
    instruction: 'หม้อทอด 200°C ทอด 12 นาที'
  },
  'Guck mal! Crispy Sticks': {
    brand: 'chicken',
    pieces: 'ชิกกี้สติก 7 ชิ้น',
    shortPortion: 'ชิกกี้สติก 7 ชิ้น',
    temp: '200°C',
    time: '6 นาที',
    instruction: 'หม้อทอด 200°C ทอด 6 นาที'
  },
  'Guck mal! Thighny Sticks': {
    brand: 'chicken',
    pieces: 'สะโพกไก่กรอบ 1 ชิ้น + ชิกกี้สติก 6 ชิ้น',
    shortPortion: 'สะโพก 1 + สติก 6',
    temp: '200°C',
    time: '16 นาที',
    instruction: 'หม้อทอด 200°C 16 นาที (ผ่านไป 1.5 นาทีเอา stick ออก)'
  },
  'Guck mal! Thighny Bites': {
    brand: 'chicken',
    pieces: 'สะโพกไก่กรอบ 1 ชิ้น + ชังกี้ไบท์ 7 ชิ้น',
    shortPortion: 'สะโพก 1 + ชังกี้ 7',
    temp: '200°C',
    time: '16 นาที',
    instruction: 'หม้อทอด 200°C 16 นาที (ผ่านไป 1.5 นาทีเอา ชังกี้ไบท์ ออก)'
  },
  'Guck mal! Duo Snacks': {
    brand: 'chicken',
    pieces: 'ไก่ป๊อบ 8 ชิ้น + นักเก็ต 5 ชิ้น',
    shortPortion: 'ป๊อบ 8 + นักเก็ต 5',
    temp: '200°C',
    time: '7 นาที',
    instruction: 'หม้อทอด 200°C 7 นาที (เอาป๊อบออกตอนเหลือ 1 นาที)'
  },
  'Guck mal! Happy Trio': {
    brand: 'chicken',
    pieces: 'สะโพกไก่กรอบ 1 ชิ้น + ชังกี้ไบท์ 7 ชิ้น + นักเก็ต 5 ชิ้น',
    shortPortion: 'สะโพก 1 + ชังกี้ 7 + นักเก็ต 5',
    temp: '200°C',
    time: '16 นาที',
    instruction: 'หม้อทอด 200°C 16 นาที (ผ่านไป 1.5 นาทีเอา ชังกี้ไบท์ ออก ผ่านไป 1.5 นาทีเอา นักเก็ต ออก)'
  },
  'Guck mal! Party Trio': {
    brand: 'chicken',
    pieces: 'ชังกี้ไบท์ 7 ชิ้น + ไก่ป๊อบ 7 ชิ้น + ชิกกี้สติก 6 ชิ้น',
    shortPortion: 'ชังกี้ 7 + ป๊อบ 7 + สติก 6',
    temp: '200°C',
    time: '6 นาที',
    instruction: 'หม้อทอด 200°C ทอด 6 นาที'
  },
  'Rice': {
    brand: 'chicken',
    pieces: 'ข้าวสวย 150g',
    shortPortion: '150g',
    temp: '-',
    time: '-',
    instruction: 'ตักใส่กล่องพร้อมเสิร์ฟ'
  },
  'Cheesecake 10 cm': {
    brand: 'cheesecake',
    pieces: 'เค้ก 1 ก้อน (10 ซม.)',
    shortPortion: '1 ก้อน (10 cm)',
    temp: 'แช่เย็น',
    time: '-',
    instruction: 'บรรจุกล่องกลมพร้อมช้อน 2 คัน'
  },
  'Biscoff topping': {
    brand: 'cheesecake',
    pieces: 'Biscoff 2 แท่ง (15.6g)',
    shortPortion: '2 แท่ง',
    temp: '-',
    time: '-',
    instruction: 'บรรจุกระปุกบิสคอฟ'
  }
};

const DEFAULT_SETTINGS = {
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

// Standard presets merged with existing investment item names in Settings
const DEFAULT_INVEST_ITEMS = {
  chicken: [
    'Packaging & Boxes',
    'Air Fryer / Kitchen Equipment',
    'Cooking Oil & Utilities',
    'Raw Chicken Stock',
    'Marketing & Ads'
  ],
  cheesecake: [
    'Cake Boxes & Spoons',
    'Baking Equipment & Moulds',
    'Cream Cheese & Dairy Stock',
    'Marketing & Ads'
  ]
};

const SETTING_GROUPS = [
  {
    title: '🛵 Delivery Commissions & Surcharges',
    desc: 'Platform fee percentages and extra sauce pricing rules',
    items: [
      { key: 'gp', title: 'Delivery App GP Fee (%)', desc: 'Commission deducted on Grab, Lineman, and Shopee orders (e.g. 32.1%)', unit: '%', isPct: true },
      { key: 'bundle_2', title: 'Chicken Custom Set — 2 Menus Discount (%)', desc: 'Discount when 2 single chicken menus are bundled (applies only to chicken)', unit: '%', isPct: true },
      { key: 'bundle_3', title: 'Chicken Custom Set — 3+ Menus Discount (%)', desc: 'Discount when 3+ single chicken menus are bundled (applies only to chicken)', unit: '%', isPct: true },
      { key: 'bundle', title: 'Custom Set Bundle Fallback Discount (%)', desc: 'Fallback discount for custom bundle sets', unit: '%', isPct: true },
      { key: 'tartar_in', title: 'Tartar Sauce Surcharge — In-Store', desc: 'Extra charge per item for dine-in / takeaway', unit: '฿' },
      { key: 'tartar_dl', title: 'Tartar Sauce Surcharge — Delivery', desc: 'Extra charge per item on delivery channels', unit: '฿' }
    ]
  },
  {
    title: '🔒 Operational Controls & Order Security',
    desc: 'Audit rules and modification time limits for submitted orders',
    items: [
      { key: 'order_edit_hours', title: 'Order Edit & Cancel Time Limit', desc: 'Hours after placement during which orders can be edited/cancelled (0 = unlimited)', unit: 'hrs' }
    ]
  },
  {
    title: '🔥 Kitchen & Prep Timing',
    desc: 'Equipment warm-up parameters for order prep schedules',
    items: [
      { key: 'preheat', title: 'Air Fryer Preheat Duration', desc: 'Warm-up time added once per batch in the cooking timeline', unit: 'min' }
    ]
  },
  {
    title: '🏦 Starting Capital & Pre-POS Opening Balances',
    desc: 'Initial investment amounts and historical figures recorded before launching this POS',
    items: [
      { key: 'inv_chicken', title: 'Guck mal! Chicken — Initial Startup Capital', desc: 'Base equipment & setup investment before dated log entries below', unit: '฿' },
      { key: 'inv_cheesecake', title: 'Kuu Kuu Cheesecake — Initial Startup Capital', desc: 'Base baking equipment & setup investment before dated log entries below', unit: '฿' },
      { key: 'open_net_chicken', title: 'Guck mal! Chicken — Pre-POS Cumulative Net Sales', desc: 'Net sales logged before launching POS (counts toward payback)', unit: '฿' },
      { key: 'open_net_cheesecake', title: 'Kuu Kuu Cheesecake — Pre-POS Cumulative Net Sales', desc: 'Net sales logged before launching POS (counts toward payback)', unit: '฿' },
      { key: 'open_profit_chicken', title: 'Guck mal! Chicken — Pre-POS Cumulative Net Profit', desc: 'Net profit earned prior to launching POS', unit: '฿' },
      { key: 'open_profit_cheesecake', title: 'Kuu Kuu Cheesecake — Pre-POS Cumulative Net Profit', desc: 'Net profit earned prior to launching POS', unit: '฿' }
    ]
  }
];
