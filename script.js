'use strict';
(function () {
/* =====================================================================
   SARAYAMART — aplikasi mini market (HTML + CSS + JavaScript murni)
   Semua data disimpan di LocalStorage (kunci: sarayamart_v1).
   Pembayaran non-tunai adalah SIMULASI, tidak terhubung ke penyedia asli.
   ===================================================================== */

const LOW = 10;                        // batas "stok terbatas"
const KEY = 'sarayamart_v1';
const ADMIN = !!window.SM_ADMIN;                       // true hanya di admin.html
const SKEY = ADMIN ? 'sarayamart_admin_session' : 'sarayamart_session';
const CKEY = 'sarayamart_cart', PKEY = 'sarayamart_profile', CHKEY = 'sarayamart_chat';
const HOME = ADMIN ? 'admin' : 'home';
const LKMSG = ADMIN ? 'Masukkan PIN admin' : 'Masukkan PIN untuk masuk';
const DEFAULT_USER_PIN = '123456';
const DEFAULT_ADMIN_PIN = '654321';
/* Link cadangan tempat folder gambar berada. Gambar dicari dulu di folder aplikasi sendiri (gambar/aqua.jpg),
   dan kalau tidak ada baru diambil dari link ini. Ganti di sini saja bila link-nya berubah. */
const IMG_BASE = 'https://sarafadilla.github.io/sara-mart/';

/* ---------- utilitas ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const rp = n => IDR.format(Math.round(n)).replace(/ /g, ' ');
const pad = n => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dateFull = d => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const dateShort = d => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const timeHMS = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const timeHM = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const mem = {};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] == null ? null : mem[k]; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { mem[k] = v; return false; } }
};
const sess = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return mem['s_' + k] == null ? null : mem['s_' + k]; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { mem['s_' + k] = v; } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { delete mem['s_' + k]; } }
};

/* ---------- bunyi notifikasi (Web Audio, tanpa file suara) ---------- */
let AC = null, audioWarned = false, audioOK = false;
function audioCtx() {
  try { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } } catch (e) {}
  return AC;
}
function unlockAudio() {                       // jalan saat pengguna klik/ketuk/tekan tombol: izinkan suara
  const ctx = audioCtx(); if (!ctx) return;
  try {
    const done = () => { if (ctx.state === 'running') { audioOK = true; const b = $('#sndbar'); if (b) b.remove(); } };
    if (ctx.state !== 'running') ctx.resume().then(done).catch(() => {}); else done();
    const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);   // kunci Safari/iOS
  } catch (e) {}
}
['pointerdown', 'mousedown', 'click', 'touchend', 'keydown'].forEach(ev => addEventListener(ev, unlockAudio, { passive: true, capture: true }));
// [frekuensi Hz, mulai (dtk), lama (dtk)]
const SND = {
  chat: [[880, 0, .13], [1175, .15, .2]],                                   // pesan chat masuk
  order: [[660, 0, .14], [880, .16, .14], [1100, .32, .14], [1320, .48, .26]], // pesanan baru (admin)
  done: [[523, 0, .14], [659, .16, .14], [784, .32, .14], [1047, .48, .32]]    // pesanan sampai (pelanggan)
};
function playTones(ctx, kind) {
  const t0 = ctx.currentTime + .02;
  (SND[kind] || []).forEach(([f, d, l]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(.5, t0 + d + .02);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + d + l);
    o.connect(g); g.connect(ctx.destination); o.start(t0 + d); o.stop(t0 + d + l + .05);
  });
  try { if (navigator.vibrate) navigator.vibrate(kind === 'chat' ? [60] : [80, 60, 80]); } catch (e) {}
}
function soundBanner() {                       // tampil bila halaman terbuka tanpa klik (mis. setelah refresh)
  if (audioOK || $('#sndbar')) return;
  const b = document.createElement('button'); b.id = 'sndbar'; b.textContent = '🔔 Ketuk untuk mengaktifkan suara notifikasi';
  appEl.appendChild(b);
}
function audioBlocked() {
  if (audioWarned) return; audioWarned = true;
  toast('🔇 Bunyi diblokir browser. Klik sekali di halaman ini, lalu tekan tombol 🔔 untuk tes.', true);
}
function beep(kind) {
  const ctx = audioCtx(); if (!ctx) return false;
  if (ctx.state === 'running') { playTones(ctx, kind); return true; }
  try { ctx.resume().then(() => { if (ctx.state === 'running') playTones(ctx, kind); else audioBlocked(); }).catch(audioBlocked); } catch (e) { audioBlocked(); }
  return false;
}

/* ---------- baterai: mengikuti baterai perangkat (tanpa angka %) ---------- */
function setBattery(level, charging) {
  const w = Math.max(1.5, 17 * Math.min(1, Math.max(0, level)));
  $$('.bat-fill').forEach(r => {
    r.setAttribute('width', w.toFixed(1));
    r.style.fill = charging ? '#34C759' : level <= .2 ? '#FF3B30' : '';
  });
}
if (navigator.getBattery) {
  navigator.getBattery().then(b => {
    const u = () => setBattery(b.level, b.charging);
    u(); ['levelchange', 'chargingchange'].forEach(ev => b.addEventListener(ev, u));
  }).catch(() => {});
}

/* ---------- ikon & logo ---------- */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.8"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  chevL: '<path d="m15 5-7 7 7 7"/>', chevR: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a3 3 0 0 0 5.3 1.9A3 3 0 0 0 14.7 10.9 3 3 0 0 0 20 9M10 20v-5h4v5"/>',
  truck: '<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  bank: '<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.1M14 21h3M21 17v4"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  alert: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17v.1"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/>',
  backspace: '<path d="M21 5H9l-6 7 6 7h12z"/><path d="m13 9.5 5 5M18 9.5l-5 5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 3.5L20 15M20 20v-5h-5"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>'
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

function logo(size = 44, mono = false) {
  const bg = mono ? '#111' : '#0E5E4B', leaf = mono ? '#111' : '#C9A54E';
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="Logo SARAYAMART"><rect width="64" height="64" rx="15" fill="${bg}"/><path d="M17 27h30l-3.2 17.5a3 3 0 0 1-3 2.5H23.2a3 3 0 0 1-3-2.5z" fill="#fff"/><path d="M24 27c0-6.5 3.4-10.5 8-10.5S40 20.5 40 27" fill="none" stroke="${mono ? '#fff' : '#FBF5E6'}" stroke-width="3.6" stroke-linecap="round"/><path d="M32 42c0-5.5 3.2-9 7.5-9 0 5.5-3.2 9-7.5 9z" fill="${leaf}"/></svg>`;
}

/* ---------- data awal ---------- */
// [nama, kategori, ukuran, harga, stok, emoji, warna, deskripsi, diskon%, terjual]
const SEED = [
  ['Indomie Goreng', 'Makanan', '85 g', 3500, 120, '🍜', '#FFE7C2', 'Mi instan goreng berbumbu gurih khas, cepat disajikan kapan saja.', 0, 420],
  ['Indomie Kuah Ayam Bawang', 'Makanan', '69 g', 3000, 90, '🍲', '#FFEFD2', 'Mi kuah rasa ayam bawang yang hangat dan menenangkan.', 0, 310],
  ['Roti Tawar', 'Makanan', '350 g', 15000, 25, '🍞', '#F9E7C9', 'Roti tawar lembut untuk sarapan, cocok dengan selai atau telur.', 10, 150],
  ['Biskuit Roma Kelapa', 'Makanan', '300 g', 12000, 40, '🍪', '#F6E3C5', 'Biskuit gurih manis dengan aroma kelapa, teman minum teh.', 0, 130],
  ['Keripik Kentang', 'Makanan', '68 g', 10000, 35, '🥔', '#FFF0B8', 'Keripik kentang renyah tipis dengan bumbu asin gurih.', 20, 210],
  ['Wafer Cokelat', 'Makanan', '140 g', 8000, 50, '🧇', '#EBD3BE', 'Wafer berlapis krim cokelat, renyah di setiap gigitan.', 15, 180],
  ['Cokelat Batang', 'Makanan', '45 g', 7500, 30, '🍫', '#E6D0C4', 'Cokelat batang manis dan lembut meleleh di mulut.', 0, 95],
  ['Sereal Sarapan', 'Makanan', '170 g', 18000, 18, '🥣', '#FFE9C9', 'Sereal jagung renyah, nikmat dengan susu dingin.', 0, 60],
  ['Mi Instan Cup', 'Makanan', '75 g', 6000, 45, '🥡', '#FFE2D2', 'Mi dalam cup praktis, cukup seduh air panas.', 0, 140],
  ['Kacang Panggang', 'Makanan', '100 g', 9000, 28, '🥜', '#F3E0C2', 'Kacang tanah panggang gurih sebagai camilan sehat.', 0, 70],
  ['Keripik Singkong', 'Makanan', '100 g', 8500, 33, '🍠', '#FBE8C4', 'Keripik singkong tipis renyah dengan rasa original.', 0, 85],
  ['Biskuit Sandwich', 'Makanan', '120 g', 9000, 38, '🥮', '#F2DDC7', 'Biskuit sandwich isi krim vanila yang lembut.', 0, 100],
  ['Permen Mint', 'Makanan', '50 g', 5000, 4, '🍬', '#D9F3E4', 'Permen mint penyegar napas dengan rasa dingin menyegarkan.', 0, 55],
  ['Popcorn', 'Makanan', '80 g', 10000, 0, '🍿', '#FFF1C9', 'Popcorn rasa karamel, camilan favorit saat menonton.', 0, 75],
  ['Oatmeal', 'Makanan', '200 g', 16000, 6, '🌾', '#F1E6CF', 'Oatmeal instan kaya serat untuk sarapan bergizi.', 0, 48],
  ['Air Mineral', 'Minuman', '600 ml', 3500, 150, '💧', '#DCEFFF', 'Air mineral murni dalam botol 600 ml.', 0, 500],
  ['Air Mineral', 'Minuman', '1,5 L', 7000, 80, '🚰', '#D3E9FB', 'Air mineral botol besar 1,5 liter untuk keluarga.', 0, 260],
  ['Susu UHT Cokelat', 'Minuman', '250 ml', 6000, 60, '🥛', '#EAD7CB', 'Susu UHT rasa cokelat, praktis dan bergizi.', 10, 190],
  ['Teh Kemasan', 'Minuman', '350 ml', 5000, 70, '🧋', '#FBE3C0', 'Teh manis dingin siap minum.', 0, 230],
  ['Kopi Susu Kemasan', 'Minuman', '220 ml', 7500, 42, '☕', '#EBDACB', 'Kopi susu siap minum dengan rasa seimbang.', 0, 160],
  ['Jus Jeruk', 'Minuman', '250 ml', 6500, 36, '🍊', '#FFE3B8', 'Jus jeruk segar kaya vitamin C.', 10, 120],
  ['Minuman Isotonik', 'Minuman', '500 ml', 8000, 8, '⚡', '#D8F0FF', 'Minuman isotonik pengganti ion tubuh setelah beraktivitas.', 0, 110],
  ['Susu Stroberi', 'Minuman', '250 ml', 6000, 48, '🍓', '#FFDCE3', 'Susu rasa stroberi manis disukai anak-anak.', 0, 125],
  ['Teh Hijau', 'Minuman', '450 ml', 6500, 55, '🍵', '#DDF1D5', 'Teh hijau kemasan yang ringan dan menyegarkan.', 0, 105],
  ['Minuman Soda', 'Minuman', '390 ml', 7000, 52, '🥤', '#FFD9D4', 'Minuman soda bersoda dengan sensasi dingin menyegarkan.', 15, 170]
];

function defaults() {
  const d = baseDefaults(), X = window.SM_DATA;      /* data.js (hasil "Unduh data produk") menjadi isi awal */
  if (X && Array.isArray(X.products) && X.products.length) {
    d.products = JSON.parse(JSON.stringify(X.products));
    if (X.settings && typeof X.settings === 'object') {
      const keep = { userPin: d.settings.userPin, adminPin: d.settings.adminPin, userName: '' };
      d.settings = Object.assign({}, d.settings, JSON.parse(JSON.stringify(X.settings)), keep);
    }
  }
  return d;
}
function baseDefaults() {
  return {
    v: 1, seq: 0, cart: [], orders: [], reviews: [],
    products: SEED.map((s, i) => ({ id: 'p' + (i + 1), name: s[0], category: s[1], size: s[2], price: s[3], stock: s[4], emoji: s[5], color: s[6], desc: s[7], discount: s[8], sold: s[9], image: '' })),
    settings: {
      storeName: 'SARAYAMART',
      address: 'Jl. Contoh No. 15, Medan, Sumatera Utara',
      phone: '0812-3456-7890',
      deliveryFee: 5000, areaFees: {}, otherFee: 15000,
      couriers: [{ n: 'J&T Express', s: 'Reguler', fee: 18000, eta: '2-4 hari' }, { n: 'SiCepat', s: 'Reguler', fee: 17000, eta: '2-3 hari' }, { n: 'JNE', s: 'Reguler', fee: 19000, eta: '2-4 hari' }],
      vouchers: [{ code: 'HEMAT10', amt: 10000, min: 50000, quota: 0, used: 0 }],
      areas: ['Medan Kota', 'Medan Baru', 'Medan Petisah', 'Medan Sunggal', 'Medan Selayang', 'Medan Helvetia', 'Medan Johor', 'Medan Denai'],
      userPin: DEFAULT_USER_PIN, adminPin: DEFAULT_ADMIN_PIN, userName: '',
      banks: [
        { id: 'BRI', name: 'Bank BRI', number: '1234-01-000123-50-1', holder: 'SARAYAMART (SIMULASI)' },
        { id: 'BCA', name: 'Bank BCA', number: '012-345-6789', holder: 'SARAYAMART (SIMULASI)' },
        { id: 'BNI', name: 'Bank BNI', number: '0123-4567-89', holder: 'SARAYAMART (SIMULASI)' }
      ],
      wallets: [
        { id: 'DANA', name: 'DANA', number: '0812-3456-7890', holder: 'SARAYAMART (SIMULASI)' },
        { id: 'OVO', name: 'OVO', number: '0812-3456-7890', holder: 'SARAYAMART (SIMULASI)' },
        { id: 'GoPay', name: 'GoPay', number: '0812-3456-7890', holder: 'SARAYAMART (SIMULASI)' }
      ]
    }
  };
}

let S = load();
function load() {
  let s = null;
  try { s = JSON.parse(store.get(KEY)); } catch (e) { s = null; }
  const d = defaults();
  if (!s || !Array.isArray(s.products) || !s.settings) return d;
  s.settings = Object.assign({}, d.settings, s.settings);
  if (!Array.isArray(s.settings.banks) || s.settings.banks.length < 3) s.settings.banks = d.settings.banks;
  if (!Array.isArray(s.settings.wallets) || s.settings.wallets.length < 3) s.settings.wallets = d.settings.wallets;
  if (!Array.isArray(s.settings.areas) || !s.settings.areas.length) s.settings.areas = d.settings.areas;
  if (!Array.isArray(s.settings.couriers)) s.settings.couriers = d.settings.couriers;
  if (!Array.isArray(s.settings.vouchers)) s.settings.vouchers = d.settings.vouchers;
  if (!s.settings.areaFees || typeof s.settings.areaFees !== 'object') s.settings.areaFees = {};
  if (!(Number(s.settings.otherFee) >= 0) || s.settings.otherFee === '' || s.settings.otherFee == null) s.settings.otherFee = 15000;
  let c = null; try { c = JSON.parse(store.get(CKEY)); } catch (e) { c = null; }
  s.cart = Array.isArray(c) ? c : (Array.isArray(s.cart) ? s.cart : []);
  s.orders = Array.isArray(s.orders) ? s.orders : [];
  s.reviews = Array.isArray(s.reviews) ? s.reviews : [];
  s.seq = Number(s.seq) || 0;
  return s;
}
function save() {
  const rest = Object.assign({}, S); delete rest.cart;
  let ok = store.set(KEY, JSON.stringify(rest));
  if (!ADMIN) ok = store.set(CKEY, JSON.stringify(S.cart)) && ok;
  if (!ok) toast('Penyimpanan penuh/diblokir. Data hanya tersimpan sementara.', true);
}
/* profil pelanggan: kunci penyimpanan sendiri, terpisah dari data admin */
let PR = (() => {
  let p = null; try { p = JSON.parse(store.get(PKEY)); } catch (e) { p = null; }
  p = p || {};
  if (p.name == null) p.name = S.settings.userName || '';
  p.photo = p.photo || ''; p.phone = p.phone || ''; p.address = p.address || '';
  p.cid = p.cid || 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return p;
})();
const savePR = () => store.set(PKEY, JSON.stringify(PR));
if (!ADMIN) savePR();

/* ---------- state UI (tidak disimpan) ---------- */
const TABS = ADMIN ? ['admin'] : ['home', 'products', 'cart', 'history', 'profile'];
const ui = {
  tab: HOME, stack: [], q: '', cat: 'all', sort: 'default', adminTab: 'products', ot: 'active', adminOK: false, aq: '', sp: (store.get('sarayamart_period') || 'all'),
  busy: false, pin: '', locked: true, co: null
};
const OTHER = '__other';
const courierOf = co => (S.settings.couriers || [])[Number(co.courier)] || null;
const voucherOf = code => (S.settings.vouchers || []).find(v => v.code === String(code || '').trim().toUpperCase());
function shipDisc(co, subtotal, fee) {
  const v = co.vApplied && voucherOf(co.vApplied);
  if (!v || !fee || subtotal < v.min || (v.quota && v.used >= v.quota)) return 0;
  return Math.min(v.amt, fee);
}
const feeFor = co => { const t = S.settings; if (co.carrier === 'courier') { const c = courierOf(co); return c ? Number(c.fee) : 0; } return co.area === OTHER ? Number(t.otherFee) : (co.area && t.areaFees[co.area] != null ? Number(t.areaFees[co.area]) : t.deliveryFee); };
const areaText = co => co.area === OTHER ? (co.areaOther || '').trim() + ' (luar daftar)' : co.area;
function freshCO() {
  return { method: 'pickup', name: PR.name || '', phone: PR.phone || '', address: PR.address || '', area: '', areaOther: '', carrier: 'local', courier: '', city: '', voucher: '', vApplied: '', note: '', pay: 'cash', bank: 'BRI', wallet: 'DANA', received: '', errors: {} };
}
ui.co = freshCO();

/* ---------- akses data ---------- */
const product = id => S.products.find(p => p.id === id);
const order = id => S.orders.find(o => o.id === id);
const unit = p => Math.round(p.price * (100 - (p.discount || 0)) / 100);
/* Satuan & varian. Stok disimpan dalam satuan dasar (mis. bungkus); renteng/karton = isi x satuan dasar. */
const baseName = p => p.baseUnit || 'pcs';
const allUnits = p => [{ n: baseName(p), q: 1, pr: 0 }].concat(p.units || []);
const hasVar = p => !!(p.variants && p.variants.length);
const vOf = (p, vid) => hasVar(p) ? p.variants.find(v => v.id === vid) : null;
const uOf = (p, un) => allUnits(p).find(u => u.n === un) || allUnits(p)[0];
const stockOf = (p, vid) => hasVar(p) ? ((vOf(p, vid) || {}).stock || 0) : p.stock;
const priceFor = (p, vid, un) => { const u = uOf(p, un), v = vOf(p, vid), raw = u.pr > 0 ? u.pr : (v ? v.price : p.price) * u.q; return Math.round(raw * (100 - (p.discount || 0)) / 100); };
const lk = c => c.id + '|' + (c.vid || '') + '|' + (c.u || '');
const lineLabel = (p, vid, un) => { const v = vOf(p, vid), u = uOf(p, un); return p.size + (v ? ' · ' + v.name : '') + (u.q > 1 ? ' · ' + u.n + ' (isi ' + u.q + ' ' + baseName(p) + ')' : ''); };
const usedBase = (p, vid) => S.cart.filter(x => x.id === p.id && (x.vid || '') === (vid || '')).reduce((a, x) => a + x.qty * uOf(p, x.u).q, 0);
function adjStock(p, vid, d) {
  if (hasVar(p)) { const v = vOf(p, vid); if (v) v.stock = Math.max(0, v.stock + d); p.stock = p.variants.reduce((a, x) => a + x.stock, 0); }
  else p.stock = Math.max(0, p.stock + d);
}
const cartCount = () => S.cart.reduce((a, c) => a + c.qty, 0);
function cartLines() {
  return S.cart.map(c => {
    const p = product(c.id); if (!p) return null;
    const u = uOf(p, c.u), pr = priceFor(p, c.vid, c.u), st = stockOf(p, c.vid);
    return { p, c, k: lk(c), u, vid: c.vid || '', qty: c.qty, price: pr, sub: pr * c.qty, base: c.qty * u.q, st, label: lineLabel(p, c.vid, c.u), room: Math.floor((st - usedBase(p, c.vid)) / u.q) };
  }).filter(Boolean);
}
function totals() {
  const lines = cartLines();
  const subtotal = lines.reduce((a, l) => a + l.sub, 0);
  const fee = ui.co.method === 'delivery' && lines.length ? feeFor(ui.co) : 0;
  const disc = shipDisc(ui.co, subtotal, fee);
  return { lines, subtotal, fee, disc, total: subtotal + fee - disc };
}
function sanitizeCart(silent) {
  let changed = false;
  S.cart = S.cart.filter(c => {
    const p = product(c.id);
    if (!p || (hasVar(p) && !vOf(p, c.vid)) || !(c.qty > 0)) { changed = true; return false; }
    const mx = Math.floor(stockOf(p, c.vid) / uOf(p, c.u).q);
    if (mx <= 0) { changed = true; return false; }
    if (c.qty > mx) { c.qty = mx; changed = true; }
    return true;
  });
  if (changed) { save(); if (!silent) toast('Keranjang disesuaikan dengan stok terbaru.'); }
  return changed;
}

/* ---------- elemen utama ---------- */
const appEl = $('#app'), view = $('#view'), tabbar = $('#tabbar'), overlay = $('#overlay'), lockEl = $('#lock'), cartbar = $('#cartbar');

/* ---------- toast, loader, dialog, sheet ---------- */
let toastT;
function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg; t.className = (isErr ? 'err ' : '') + 'on';
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 2200);
}
function loader(on, text) { $('#loader-text').textContent = text || 'Memuat…'; $('#loader').classList.toggle('on', !!on); }
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function ask({ title, msg, ok = 'OK', cancel = 'Batal', danger = false }) {
  return new Promise(res => {
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="alert" role="alertdialog"><h3>${title}</h3><p>${msg}</p><div class="abtns">${cancel ? `<button data-r="0">${cancel}</button>` : ''}<button data-r="1" class="${danger ? 'danger' : 'pri'}">${ok}</button></div></div>`;
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (b || e.target === el) { el.remove(); res(b ? b.dataset.r === '1' : false); }
    });
    overlay.appendChild(el);
  });
}
function openSheet(html) {
  closeSheet();
  const el = document.createElement('div');
  el.className = 'sheet-bd';
  el.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
  el.addEventListener('click', e => { if (e.target === el) closeSheet(); });
  overlay.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  return el.querySelector('.sheet');
}
function closeSheet() { $$('.sheet-bd', overlay).forEach(e => e.remove()); }

/* ---------- komponen ---------- */
function imgHTML(p, big) {
  const src = (p.image || '').trim();
  const fb = src && !/^(https?:|data:)/i.test(src) ? IMG_BASE + src : '';   /* cadangan untuk alamat pendek (gambar/aqua.jpg) */
  return `<div class="pimg ${big ? 'big' : ''}" style="background:${esc(p.color || '#EEF2ED')}"><span>${esc(p.emoji || '🛒')}</span>${src ? `<img src="${esc(src)}" ${fb ? `data-fb="${esc(fb)}" ` : ''}alt="${esc(p.name)}" loading="lazy" onerror="if(this.dataset.fb&&!this.dataset.t){this.dataset.t=1;this.src=this.dataset.fb}else this.remove()">` : ''}</div>`;
}
function priceHTML(p) {
  return `<b>${rp(unit(p))}</b>${p.discount ? `<s>${rp(p.price)}</s>` : ''}`;
}
function cardHTML(p) {
  const out = p.stock <= 0, low = !out && p.stock <= LOW;
  return `<div class="pcard ${out ? 'out' : ''}" data-act="open-product" data-id="${p.id}">
    <div class="pimgwrap">${imgHTML(p)}${p.discount ? `<span class="badge disc">-${p.discount}%</span>` : ''}${out ? '<span class="badge out">Habis</span>' : low ? `<span class="badge low">Sisa ${p.stock}</span>` : ''}</div>
    <div class="pname">${esc(p.name)}</div><div class="psize">${esc(p.size)}</div>
    <div class="prow"><div class="pprice">${priceHTML(p)}</div><button class="addbtn" data-act="add" data-id="${p.id}" ${out ? 'disabled' : ''} aria-label="Tambah ${esc(p.name)} ke keranjang">${ic('plus')}</button></div></div>`;
}
function emptyHTML(em, title, text, btn) {
  return `<div class="empty"><span class="eem">${em}</span><b>${title}</b><div>${text}</div>${btn || ''}</div>`;
}
function navBar(title, { back = true, right = '' } = {}) {
  return `<div class="nav">${back ? `<button class="back" data-act="back" aria-label="Kembali">${ic('chevL')}<span>Kembali</span></button>` : '<span></span>'}<h1>${title}</h1><div class="right">${right}</div></div>`;
}
function field(label, name, val, o = {}) {
  const err = o.err;
  const input = o.area
    ? `<textarea class="in" data-bind="${name}" rows="3" placeholder="${esc(o.ph || '')}">${esc(val)}</textarea>`
    : `<input class="in" data-bind="${name}" type="${o.type || 'text'}" ${o.mode ? `inputmode="${o.mode}"` : ''} value="${esc(val)}" placeholder="${esc(o.ph || '')}" autocomplete="${o.ac || 'off'}">`;
  return `<div class="fl ${err ? 'bad' : ''}" data-f="${name}"><label>${label}</label>${input}${err ? `<div class="err">${esc(err)}</div>` : ''}</div>`;
}
const statusPill = o => {
  const cls = o.status === 'Selesai' ? 'ok' : o.status === 'Dibatalkan' ? 'no' : 'wait';
  return `<span class="pill ${cls}">${esc(o.status)}</span>`;
};
const payPill = o => {
  const cls = o.payStatus === 'Lunas' || o.payStatus === 'Simulasi Berhasil' ? 'ok' : o.payStatus === 'Dibatalkan' ? 'no' : 'wait';
  return `<span class="pill ${cls}">${esc(o.payStatus)}</span>`;
};
const payLabel = o => o.pay.type === 'cash' ? 'Tunai' : o.pay.type === 'bank' ? 'Transfer ' + o.pay.provider : o.pay.type === 'qris' ? 'QRIS (Simulasi)' : 'E-Wallet ' + o.pay.provider;
const brandColor = { BRI: '#00529C', BCA: '#0060AF', BNI: '#E8661A', DANA: '#118EEA', OVO: '#4C2A86', GoPay: '#00AA13' };
const brand = id => `<span class="brand" style="background:${brandColor[id] || '#555'}">${esc(id.toUpperCase().slice(0, 5))}</span>`;
function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
}

/* ---------- navigasi ---------- */
const curr = () => ui.stack.length ? ui.stack[ui.stack.length - 1] : { name: ui.tab, params: {} };
let lastKey = '';
function go(name, params = {}) { ui.stack.push({ name, params }); render('push'); }
function back() {
  if (ui.stack.length) {
    const leaving = curr().name;
    ui.stack.pop();
    if (leaving === 'admin') ui.adminOK = false;
    render('pop');
  }
}
function setTab(t) {
  if (ADMIN) { ui.tab = 'admin'; ui.adminTab = 'products'; ui.aq = ''; } else ui.tab = t; ui.stack = []; ui.adminOK = false;
  render('fade');
}
function replaceTop(name, params) { ui.stack[ui.stack.length - 1] = { name, params }; render('push'); }
function resetTo(name, params) { ui.stack = [{ name, params }]; ui.tab = HOME; render('push'); }
function refresh() { render(null); }

function render(anim) {
  if (ADMIN && !['admin', 'chat', 'txdetail', 'receipt'].includes(curr().name)) { ui.stack = []; ui.tab = 'admin'; ui.adminTab = 'products'; }
  if (!ADMIN && curr().name === 'admin') { ui.stack = []; ui.tab = 'home'; }
  const r = curr();
  const key = r.name + JSON.stringify(r.params || {});
  const oldScroll = $('.scroll', view);
  const keep = !anim && key === lastKey && oldScroll ? oldScroll.scrollTop : 0;
  if (r.name === 'cart' || r.name === 'checkout') sanitizeCart(false);
  view.innerHTML = VIEWS[r.name](r.params || {});
  view.className = '';
  if (anim) { void view.offsetWidth; view.classList.add('a-' + anim); }
  const sc = $('.scroll', view);
  if (sc && keep) sc.scrollTop = keep;
  lastKey = key;
  const isTab = TABS.includes(r.name);
  appEl.classList.toggle('notabs', !isTab);
  renderTabbar();
  renderCartBar();
  bindView();
  tick();
}
function renderTabbar() {
  if (ADMIN) {
    const n = unreadChat(), on = curr().name === 'admin';
    tabbar.innerHTML = [['products', 'Produk', 'box'], ['orders', 'Pesanan', 'receipt'], ['chat', 'Chat', 'chat'], ['settings', 'Pengaturan', 'sliders']]
      .map(([id, l, i]) => `<button class="${on && ui.adminTab === id ? 'on' : ''}" data-act="admin-tab" data-v="${id}" aria-label="${l}">${ic(i)}${id === 'chat' && n ? `<i class="tb">${n}</i>` : ''}<span>${l}</span></button>`).join('');
    return;
  }
  const items = [['home', 'Beranda', 'home'], ['products', 'Produk', 'grid'], ['cart', 'Keranjang', 'cart'], ['history', 'Riwayat', 'receipt'], ['profile', 'Profil', 'user']];
  const n = cartCount();
  tabbar.innerHTML = items.map(([id, label, icon]) => `<button class="${curr().name === id ? 'on' : ''}" data-act="tab" data-tab="${id}" aria-label="${label}">${ic(icon)}${id === 'cart' && n ? `<i class="tb">${n}</i>` : ''}<span>${label}</span></button>`).join('');
}
function renderCartBar() {
  const r = curr().name;
  const lines = cartLines();
  if ((r === 'home' || r === 'products') && lines.length) {
    const t = lines.reduce((a, l) => a + l.sub, 0);
    cartbar.hidden = false;
    cartbar.innerHTML = `<div class="cl">${cartCount()} barang di keranjang<b>${rp(t)}</b></div><button data-act="tab" data-tab="cart">Lihat Keranjang</button>`;
  } else cartbar.hidden = true;
}

/* ---------- jam ---------- */
function tick() {
  const d = new Date();
  $('#sb-time').textContent = timeHM(d);
  $$('[data-clock]').forEach(e => e.textContent = timeHMS(d));
  $$('[data-hm]').forEach(e => e.textContent = timeHM(d));
  $$('[data-date]').forEach(e => e.textContent = dateFull(d));
}
setInterval(tick, 1000);

/* =====================================================================
   VIEWS
   ===================================================================== */
const VIEWS = {};

/* ---------- Beranda ---------- */
VIEWS.home = () => {
  const n = cartCount();
  const popular = S.products.filter(p => p.stock > 0).sort((a, b) => b.sold - a.sold).slice(0, 8);
  const disc = S.products.filter(p => p.discount > 0 && p.stock > 0);
  const low = S.products.filter(p => p.stock > 0 && p.stock <= LOW).sort((a, b) => a.stock - b.stock);
  const cnt = c => S.products.filter(p => p.category === c).length;
  return `<div class="page"><div class="scroll" style="padding-bottom:${cartCount() ? 84 : 24}px">
    <div class="hrow">${logo(42)}<div class="hgreet"><div class="sm">${greeting()},</div><div class="hname">${esc(PR.name || 'Pelanggan')} 👋</div></div>
      <button class="iconbtn" data-act="tab" data-tab="cart" aria-label="Keranjang">${ic('cart')}${n ? `<i class="dot">${n}</i>` : ''}</button><button class="iconbtn" data-act="chat" aria-label="Chat dengan admin">${ic('chat')}${unreadChat() ? `<i class="dot">${unreadChat()}</i>` : ''}</button></div>
    <div class="hero"><div class="when" data-date></div><div class="clock" data-clock></div>
      <label class="search">${ic('search')}<input id="hq" type="search" placeholder="Cari produk di ${esc(S.settings.storeName)}" autocomplete="off" enterkeyhint="search"></label></div>
    <div class="banners" id="banners">
      <button class="banner b1" data-act="banner" data-b="promo"><b>Diskon hingga 20%</b><span>Camilan & minuman pilihan minggu ini</span><i class="bem">🏷️</i></button>
      <button class="banner b2" data-act="banner" data-b="Minuman"><b>Segarkan harimu</b><span>Aneka minuman dingin siap minum</span><i class="bem">🥤</i></button>
      <button class="banner b3" data-act="banner" data-b="Makanan"><b>Stok camilan lengkap</b><span>Ambil di toko tanpa biaya antar</span><i class="bem">🍿</i></button>
    </div><div class="bdots" id="bdots"><i class="on"></i><i></i><i></i></div>
    <div class="sec"><h2>Kategori</h2></div>
    <div class="cats">
      <button class="cat" data-act="cat" data-c="Makanan"><i class="ce">🍜</i><b>Makanan</b><small>${cnt('Makanan')} produk</small></button>
      <button class="cat" data-act="cat" data-c="Minuman"><i class="ce">🥤</i><b>Minuman</b><small>${cnt('Minuman')} produk</small></button>
      <button class="cat" data-act="cat" data-c="promo"><i class="ce">🏷️</i><b>Diskon</b><small>${S.products.filter(p => p.discount > 0).length} produk</small></button>
    </div>
    <div class="sec"><h2>Produk Populer</h2><button data-act="cat" data-c="all">Lihat semua</button></div>
    <div class="hlist">${popular.map(cardHTML).join('')}</div>
    ${disc.length ? `<div class="sec"><h2>Sedang Diskon</h2><button data-act="cat" data-c="promo">Lihat semua</button></div><div class="hlist">${disc.map(cardHTML).join('')}</div>` : ''}
    ${low.length ? `<div class="sec"><h2>Stok Terbatas</h2></div><div class="note" style="margin-top:0">${ic('alert')}<div>Segera beli sebelum kehabisan, stok tinggal sedikit.</div></div><div class="hlist">${low.map(cardHTML).join('')}</div>` : ''}
    ${reviewsHTML()}
    ${storeCard()}
  </div></div>`;
};
function storeCard() {
  const s = S.settings, tel = String(s.phone || '').replace(/[^\d+]/g, '');
  return `<div class="sec"><h2>Lokasi Toko</h2></div>
    <div class="card"><div class="srow">${ic('store')}<div><b>${esc(s.storeName)}</b><div class="hint">${esc(s.address)}</div></div></div>
      <div class="srow">${ic('phone')}<div><b>${esc(s.phone)}</b><div class="hint">Nomor HP / WhatsApp toko</div></div></div>
      <div class="obtns" style="margin-top:8px"><a class="btn sm sec2" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(s.address)}">${ic('pin')} Buka di Maps</a><a class="btn sm gray" href="tel:${esc(tel)}">${ic('phone')} Hubungi</a></div></div>`;
}

/* ---------- Produk ---------- */
function filtered() {
  let list = S.products.slice();
  const q = ui.q.trim().toLowerCase();
  if (ui.cat === 'promo') list = list.filter(p => p.discount > 0);
  else if (ui.cat !== 'all') list = list.filter(p => p.category === ui.cat);
  if (q) list = list.filter(p => (p.name + ' ' + p.category + ' ' + p.size).toLowerCase().includes(q));
  if (ui.sort === 'asc') list.sort((a, b) => unit(a) - unit(b));
  else if (ui.sort === 'desc') list.sort((a, b) => unit(b) - unit(a));
  else if (ui.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return list;
}
function listInner() {
  const list = filtered();
  if (!list.length) return emptyHTML('🔍', 'Produk tidak ditemukan', 'Coba kata kunci atau kategori lain.');
  return `<div class="pgrid">${list.map(cardHTML).join('')}</div>`;
}
VIEWS.products = () => {
  const chips = [['all', 'Semua'], ['Makanan', 'Makanan'], ['Minuman', 'Minuman'], ['promo', 'Diskon']];
  return `<div class="page"><div class="scroll" style="padding-bottom:${cartCount() ? 84 : 24}px">
    <h1 class="ltitle">Produk</h1>
    <label class="search" style="background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:12px">${ic('search')}<input id="pq" type="search" value="${esc(ui.q)}" placeholder="Cari nama produk…" autocomplete="off"></label>
    <div class="chips">${chips.map(([v, l]) => `<button class="chip ${ui.cat === v ? 'on' : ''}" data-act="chip" data-c="${v}">${l}</button>`).join('')}</div>
    <div class="sortrow"><span class="hint" id="pcount">${filtered().length} produk</span>
      <select class="sel" id="psort" aria-label="Urutkan"><option value="default" ${ui.sort === 'default' ? 'selected' : ''}>Urutkan: Bawaan</option><option value="asc" ${ui.sort === 'asc' ? 'selected' : ''}>Harga termurah</option><option value="desc" ${ui.sort === 'desc' ? 'selected' : ''}>Harga termahal</option><option value="name" ${ui.sort === 'name' ? 'selected' : ''}>Nama A–Z</option></select></div>
    <div id="plist">${listInner()}</div></div></div>`;
};
function updateList() {
  const pl = $('#plist'); if (!pl) return;
  pl.innerHTML = listInner();
  const c = $('#pcount'); if (c) c.textContent = filtered().length + ' produk';
}

/* ---------- Keranjang ---------- */
VIEWS.cart = () => {
  const { lines, subtotal } = totals();
  if (!lines.length) return `<div class="page"><div class="scroll"><h1 class="ltitle">Keranjang</h1>${emptyHTML('🛒', 'Keranjang masih kosong', 'Yuk, pilih produk favoritmu dulu.', '<button class="btn pri" style="margin-top:18px" data-act="tab" data-tab="products">Mulai Belanja</button>')}</div></div>`;
  return `<div class="page"><div class="scroll"><h1 class="ltitle">Keranjang</h1>
    ${lines.map(l => `<div class="citem"><div class="pimgwrap">${imgHTML(l.p)}</div><div class="cinfo">
      <div class="ctop"><b>${esc(l.p.name)}</b><button class="trash" data-act="remove" data-id="${l.k}" aria-label="Hapus ${esc(l.p.name)}">${ic('trash')}</button></div>
      <small>${esc(l.label)} · ${rp(l.price)}${l.p.discount && !l.vid && l.u.q === 1 ? ` <s>${rp(l.p.price)}</s>` : ''}</small>
      <div class="cmeta"><div class="stepper"><button data-act="dec" data-id="${l.k}" ${l.qty <= 1 ? 'disabled' : ''} aria-label="Kurangi">${ic('minus')}</button><span>${l.qty}</span><button data-act="inc" data-id="${l.k}" ${l.room < 1 ? 'disabled' : ''} aria-label="Tambah">${ic('plus')}</button></div><div class="csub">${rp(l.sub)}</div></div>
      ${l.room < 1 ? `<div class="hint" style="color:var(--amb);margin-top:4px">Maksimal sesuai stok (${l.st} ${esc(baseName(l.p))})</div>` : ''}</div></div>`).join('')}
    <div class="card" style="margin-top:6px"><div class="trow"><span>Subtotal (${cartCount()} barang)</span><span>${rp(subtotal)}</span></div><div class="trow"><span>Biaya pengantaran</span><span>Dihitung di checkout</span></div></div>
  </div>
  <div class="bottombar"><div class="tt"><small>Total belanja</small><b>${rp(subtotal)}</b></div><button class="btn pri" data-act="checkout">Lanjut ke Checkout</button></div></div>`;
};

/* ---------- Checkout ---------- */
function carrierSeg(co, e, s) {
  const cs = s.couriers || [];
  return `<div class="seg" style="margin-bottom:10px"><button type="button" class="${co.carrier !== 'courier' ? 'on' : ''}" data-act="set-carrier" data-v="local">Antar toko (lokal)</button><button type="button" class="${co.carrier === 'courier' ? 'on' : ''}" data-act="set-carrier" data-v="courier">Ekspedisi (luar kota)</button></div>
  ${co.carrier === 'courier' ? `<div class="fl ${e.courier ? 'bad' : ''}"><label>Pilih kurir &amp; layanan</label><select class="in" data-bind="courier"><option value="">Pilih kurir…</option>${cs.map((x, i) => `<option value="${i}" ${String(co.courier) === String(i) ? 'selected' : ''}>${esc(x.n)} ${esc(x.s)} · ${rp(x.fee)}${x.eta ? ' · est. ' + esc(x.eta) : ''}</option>`).join('')}</select>${e.courier ? `<div class="err">${esc(e.courier)}</div>` : ''}</div>${field('Kota / kabupaten tujuan', 'city', co.city, { ph: 'Contoh: Jakarta Selatan', err: e.city })}` : ''}
  <div class="fl"><label>Kode voucher ongkir (opsional)</label><div style="display:flex;gap:8px"><input class="in" data-bind="voucher" value="${esc(co.voucher)}" placeholder="Contoh: HEMAT10" style="text-transform:uppercase"><button class="btn pri" type="button" data-act="apply-voucher" style="width:auto;padding:0 16px">Pakai</button></div>${co.vApplied ? `<div class="hint" style="color:var(--g2)">Voucher ${esc(co.vApplied)} aktif</div>` : ''}</div>`;
}
/* Simulasi integrasi ekspedisi: resi dibuat otomatis saat pembayaran dikonfirmasi, pelacakan maju tiap 1 menit. */
function makeResi(n) {
  const d = k => Array.from({ length: k }, () => Math.floor(Math.random() * 10)).join(''), u = String(n).toUpperCase();
  return u.startsWith('J&T') ? 'JP' + d(10) : u.includes('SICEPAT') ? '00' + d(10) : u.includes('JNE') ? 'CM' + d(11) : (u.replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X') + d(11));
}
const TRACK = [[0, 'Paket dijemput kurir'], [1, 'Tiba di hub kota asal'], [2, 'Dalam perjalanan ke kota tujuan'], [3, 'Tiba di hub kota tujuan'], [4, 'Kurir sedang mengantar paket']];
function trackHTML(o) {
  if (!o.ship || !o.ship.resi || o.status === 'Dibatalkan') return '';
  const sh = o.ship, now = Date.now(), ev = [{ at: sh.booked || o.ts, l: 'Resi dibuat, menunggu paket diserahkan ke kurir' }];
  if (sh.shippedAt) TRACK.forEach(([m, l]) => { const at = sh.shippedAt + m * 60000; if (at <= now) ev.push({ at, l }); });
  if (o.status === 'Selesai') ev.push({ at: sh.doneAt || now, l: 'Paket telah diterima' });
  ev.reverse();
  return `<div style="padding:10px 0 2px"><b>Pelacakan ${esc(sh.n)} · ${esc(sh.resi)}</b><div class="hint" style="margin-bottom:4px">Simulasi integrasi ekspedisi: tahap bergerak tiap 1 menit.</div>` +
    ev.map(e => `<div style="padding:6px 0 6px 10px;margin-left:4px;border-left:2px solid var(--g)"><div>${esc(e.l)}</div><small class="hint">${dateShort(new Date(e.at))} ${timeHM(new Date(e.at))}</small></div>`).join('') + '</div>';
}
function shipRows(o, cls) {
  const r = (a, b) => `<div class="${cls}"><span>${a}</span><span>${b}</span></div>`;
  return (o.disc ? r('Diskon ongkir (' + esc(o.voucher) + ')', '-' + rp(o.disc)) : '') + (o.ship ? r('Kurir', esc(o.ship.n + ' ' + o.ship.s) + (o.ship.eta ? ' · est. ' + esc(o.ship.eta) : '')) + r('No. resi', o.ship.resi ? esc(o.ship.resi) : 'Dibuat otomatis setelah pembayaran dikonfirmasi') + (cls === 'trow' ? trackHTML(o) : '') : '');
}
function payOptions(t) {
  const co = ui.co, s = S.settings;
  const opt = (id, icon, title, sub) => `<button class="opt ${co.pay === id ? 'on' : ''}" data-act="set-pay" data-v="${id}"><span class="oi">${ic(icon)}</span><span class="ot"><b>${title}</b><small>${sub}</small></span><span class="radio"></span></button>`;
  let detail = '';
  if (co.pay === 'cash') {
    const recv = Number(co.received) || 0, diff = recv - t.total;
    detail = `<div class="paybox"><div class="fl" data-f="received" style="margin-bottom:0"><label>Uang yang diterima (Rp)</label><input class="in" data-bind="received" inputmode="numeric" value="${esc(co.received)}" placeholder="contoh: 50000" autocomplete="off">${co.errors.received ? `<div class="err">${esc(co.errors.received)}</div>` : ''}</div>
      <div class="quick"><button class="btn sm gray" data-act="cash-quick" data-v="exact">Uang pas</button><button class="btn sm gray" data-act="cash-quick" data-v="50000">50.000</button><button class="btn sm gray" data-act="cash-quick" data-v="100000">100.000</button></div>
      <div class="change ${recv && diff >= 0 ? 'ok' : recv ? 'no' : ''}" id="changeBox">${cashText(t.total)}</div></div>`;
  } else if (co.pay === 'bank') {
    const b = s.banks.find(x => x.id === co.bank) || s.banks[0];
    detail = `<div class="paybox"><div class="chips" style="margin:0 0 8px;padding:0">${s.banks.map(x => `<button class="chip ${co.bank === x.id ? 'on' : ''}" data-act="set-bank" data-v="${x.id}">${esc(x.id)}</button>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:center">${brand(b.id)}<div><b>${esc(b.name)}</b><div class="hint">a.n. ${esc(b.holder)}</div></div></div>
      <div class="accno"><b>${esc(b.number)}</b><button data-act="copy" data-v="${esc(b.number)}">${ic('copy')}Salin</button></div>
      <div class="hint" style="margin-top:8px">Nomor rekening simulasi. Instruksi transfer ditampilkan setelah pesanan dikonfirmasi.</div></div>`;
  } else if (co.pay === 'qris') {
    detail = `<div class="paybox"><div class="note g" style="margin:0">${ic('info')}<div>QR akan ditampilkan setelah pesanan dikonfirmasi. <b>QR ini hanya untuk demonstrasi</b> dan tidak terhubung ke penyedia pembayaran asli.</div></div></div>`;
  } else if (co.pay === 'wallet') {
    const w = s.wallets.find(x => x.id === co.wallet) || s.wallets[0];
    detail = `<div class="paybox"><div class="chips" style="margin:0 0 8px;padding:0">${s.wallets.map(x => `<button class="chip ${co.wallet === x.id ? 'on' : ''}" data-act="set-wallet" data-v="${x.id}">${esc(x.name)}</button>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:center">${brand(w.id)}<div><b>${esc(w.name)}</b><div class="hint">a.n. ${esc(w.holder)}</div></div></div>
      <div class="accno"><b>${esc(w.number)}</b><button data-act="copy" data-v="${esc(w.number)}">${ic('copy')}Salin</button></div>
      <div class="hint" style="margin-top:8px">Nomor e-wallet simulasi, tidak ada transaksi asli.</div></div>`;
  }
  return opt('cash', 'cash', 'Tunai / Cash', 'Bayar langsung, kembalian dihitung otomatis') + (co.pay === 'cash' ? detail : '') +
    opt('bank', 'bank', 'Transfer Bank', 'BRI · BCA · BNI') + (co.pay === 'bank' ? detail : '') +
    opt('qris', 'qr', 'QRIS', 'Scan kode QR (simulasi)') + (co.pay === 'qris' ? detail : '') +
    opt('wallet', 'wallet', 'E-Wallet', 'DANA · OVO · GoPay') + (co.pay === 'wallet' ? detail : '');
}
function cashText(total) {
  const recv = Number(ui.co.received) || 0;
  if (!recv) return `Total yang harus dibayar: ${rp(total)}`;
  const d = recv - total;
  return d >= 0 ? `Kembalian: ${rp(d)}` : `Uang kurang ${rp(-d)}`;
}
VIEWS.checkout = () => {
  const co = ui.co, t = totals(), e = co.errors || {}, s = S.settings;
  return `<div class="page">${navBar('Checkout')}<div class="scroll" id="cosc">
    <div class="gtitle" style="margin-top:6px">Ringkasan pesanan</div>
    <div class="card" style="padding:6px 14px">${t.lines.map(l => `<div class="mini"><div class="pimgwrap">${imgHTML(l.p)}</div><div class="mt"><b>${esc(l.p.name)}</b><small>${esc(l.p.size)} · ${l.qty} × ${rp(l.price)}</small></div><div class="mp">${rp(l.sub)}</div></div>`).join('')}</div>
    <button class="btn sm sec2" style="margin-top:8px" data-act="back">${ic('edit')} Edit keranjang</button>
    <div class="gtitle">Pengambilan / pengantaran</div>
    <div class="seg"><button class="${co.method === 'pickup' ? 'on' : ''}" data-act="set-method" data-v="pickup">Ambil di toko</button><button class="${co.method === 'delivery' ? 'on' : ''}" data-act="set-method" data-v="delivery">Pesan antar</button></div>
    ${co.method === 'pickup' ? `<div class="card"><div style="display:flex;gap:10px"><span class="row ri" style="display:grid;width:34px;height:34px;border-radius:10px;background:var(--gl);color:var(--g2);place-items:center;flex:none">${ic('store')}</span><div><b>${esc(s.storeName)}</b><div class="hint">${esc(s.address)}<br>Telp: ${esc(s.phone)}</div></div></div><div class="note g" style="margin-bottom:0">${ic('info')}<div>Ambil pesanan langsung di toko. Tanpa biaya pengantaran. <i>Alamat & nomor kontak adalah data simulasi.</i></div></div></div>
      <div style="margin-top:12px">${field('Nama pembeli (opsional)', 'name', co.name, { ph: 'Nama Anda', ac: 'name', err: e.name })}</div>`
      : `${field('Nama penerima', 'name', co.name, { ph: 'Nama lengkap penerima', ac: 'name', err: e.name })}
      ${field('Nomor HP', 'phone', co.phone, { ph: '0812xxxxxxxx', mode: 'tel', type: 'tel', ac: 'tel', err: e.phone })}
      ${field('Alamat lengkap', 'address', co.address, { ph: 'Jalan, nomor rumah, RT/RW, patokan', area: true, err: e.address })}
      ${carrierSeg(co, e, s)}<div class="fl ${e.area ? 'bad' : ''}" data-f="area" ${co.carrier === 'courier' ? 'hidden' : ''}><label>Kecamatan / area pengantaran</label><select class="in" data-bind="area"><option value="">Pilih area…</option>${s.areas.map(a => `<option value="${esc(a)}" ${co.area === a ? 'selected' : ''}>${esc(a)} · ${rp(s.areaFees[a] != null ? s.areaFees[a] : s.deliveryFee)}</option>`).join('')}<option value="${OTHER}" ${co.area === OTHER ? 'selected' : ''}>Lainnya / luar kota (ketik sendiri) · ${rp(s.otherFee)}</option></select>${e.area ? `<div class="err">${esc(e.area)}</div>` : ''}</div>
      ${co.carrier !== 'courier' && co.area === OTHER ? field('Kota / tujuan pengantaran', 'areaOther', co.areaOther, { ph: 'Contoh: Binjai, Lubuk Pakam', err: e.areaOther }) : ''}
      ${field('Catatan tambahan (opsional)', 'note', co.note, { ph: 'Contoh: titip di satpam', area: true })}`}
    <div class="gtitle">Metode pembayaran</div>${payOptions(t)}
    <div class="gtitle">Rincian pembayaran</div>
    <div class="card"><div class="trow"><span>Subtotal</span><span>${rp(t.subtotal)}</span></div><div class="trow"><span>Biaya pengantaran</span><span>${t.fee ? rp(t.fee) : co.method === 'pickup' ? 'Gratis' : rp(0)}</span></div>${t.disc ? `<div class="trow"><span>Diskon ongkir</span><span>-${rp(t.disc)}</span></div>` : ''}<div class="trow total"><span>Total pembayaran</span><span>${rp(t.total)}</span></div></div>
    <div class="hint" style="margin-top:10px">Pembayaran non-tunai pada aplikasi ini adalah simulasi. Stok baru dikurangi setelah Anda mengonfirmasi pesanan.</div>
  </div><div class="bottombar"><div class="tt"><small>Total pembayaran</small><b id="cotot">${rp(t.total)}</b></div><button class="btn pri" data-act="confirm-order">Konfirmasi Pesanan</button></div></div>`;
};

function validateCO() {
  const co = ui.co, e = {};
  const t = totals();
  if (co.method === 'delivery') {
    if (!/^[A-Za-zÀ-ÿ'.\- ]{3,60}$/.test(co.name.trim())) e.name = 'Nama penerima wajib diisi (minimal 3 huruf).';
    const ph = co.phone.replace(/[\s\-().]/g, '');
    if (!/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(ph)) e.phone = 'Nomor HP tidak valid. Contoh: 081234567890.';
    if (co.address.trim().length < 10) e.address = 'Alamat lengkap wajib diisi (minimal 10 karakter).';
    if (co.carrier === 'courier') {
      if (!courierOf(co)) e.courier = 'Pilih kurir dan layanan pengiriman.';
      if ((co.city || '').trim().length < 3) e.city = 'Tulis kota / kabupaten tujuan.';
    } else if (!co.area) e.area = 'Pilih kecamatan / area pengantaran.';
    else if (co.area === OTHER && (co.areaOther || '').trim().length < 3) e.areaOther = 'Tulis kota / tujuan pengantaran.';
  } else if (co.name.trim() && !/^[A-Za-zÀ-ÿ'.\- ]{2,60}$/.test(co.name.trim())) e.name = 'Nama hanya boleh berisi huruf.';
  if (co.pay === 'cash') {
    const r = Number(co.received);
    if (!co.received || !/^\d+$/.test(co.received)) e.received = 'Masukkan jumlah uang yang diterima.';
    else if (r < t.total) e.received = `Uang kurang. Minimal ${rp(t.total)}.`;
  }
  return e;
}
function stockProblems() {
  const bad = [];
  const need = {};
  S.cart.forEach(c => { const p = product(c.id); if (!p || (hasVar(p) && !vOf(p, c.vid))) bad.push('Produk/varian sudah tidak tersedia'); else { const k = c.id + '|' + (c.vid || ''); need[k] = (need[k] || 0) + c.qty * uOf(p, c.u).q; } });
  Object.keys(need).forEach(k => { const [pid, vid] = k.split('|'), p = product(pid), have = stockOf(p, vid); if (have < need[k]) bad.push(`${p.name}${vOf(p, vid) ? ' ' + vOf(p, vid).name : ''}: stok tersisa ${have} ${baseName(p)}`); });
  return bad;
}

/* ---------- Pembayaran (simulasi) ---------- */
function qrSVG(seed) {
  const N = 25; let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const m = Array.from({ length: N }, () => Array.from({ length: N }, () => rnd() > .5));
  const finder = (r, c) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const y = r + i, x = c + j; if (y < 0 || x < 0 || y >= N || x >= N) continue;
      const on = i >= 0 && i <= 6 && j >= 0 && j <= 6 && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
      m[y][x] = on;
    }
  };
  finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
  let d = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y][x]) d += `M${x} ${y}h1v1h-1z`;
  return `<svg class="qr" viewBox="-1 -1 ${N + 2} ${N + 2}" shape-rendering="crispEdges" role="img" aria-label="Kode QR simulasi"><rect x="-1" y="-1" width="${N + 2}" height="${N + 2}" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
}
VIEWS.pay = ({ id }) => {
  const o = order(id);
  if (!o) return `<div class="page">${navBar('Pembayaran')}<div class="scroll">${emptyHTML('🧾', 'Transaksi tidak ditemukan', '')}</div></div>`;
  const s = S.settings;
  let body = '';
  if (o.pay.type === 'qris') {
    body = `<div class="qrbox"><span class="qrtag">SIMULASI</span><div style="font-weight:700;margin-top:8px">Scan untuk membayar</div>${qrSVG(o.no)}<div class="hint">Kode QR ini <b>hanya untuk demonstrasi</b>, tidak dapat dipindai oleh aplikasi pembayaran asli.</div></div>`;
  } else {
    const list = o.pay.type === 'bank' ? s.banks : s.wallets;
    const a = list.find(x => x.id === o.pay.provider) || list[0];
    body = `<div class="card"><div style="display:flex;gap:10px;align-items:center">${brand(a.id)}<div><b>${esc(o.pay.type === 'bank' ? a.name : a.name + ' (E-Wallet)')}</b><div class="hint">a.n. ${esc(a.holder)}</div></div></div>
      <div class="accno"><b>${esc(a.number)}</b><button data-act="copy" data-v="${esc(a.number)}">${ic('copy')}Salin</button></div>
      <div class="hint" style="margin-top:10px">${o.pay.type === 'bank' ? 'Transfer ke rekening di atas sesuai total pembayaran.' : 'Kirim saldo ke nomor di atas sesuai total pembayaran.'} Ini simulasi, tidak ada uang yang berpindah.</div></div>`;
  }
  return `<div class="page">${navBar('Pembayaran', { back: false, right: '' })}<div class="scroll">
    <div class="card" style="text-align:center;margin-bottom:12px"><div class="hint">Total yang harus dibayar</div><div style="font-size:32px;font-weight:800;letter-spacing:-1px;color:var(--g2)">${rp(o.total)}</div><div class="hint">No. transaksi ${esc(o.no)}</div><div style="margin-top:6px">${payPill(o)}</div></div>
    ${body}
    ${o.payStatus === 'Lunas' ? `<div class="note" style="background:var(--gl)">${ic('check')}<div><b>Pembayaran dikonfirmasi admin ✓</b> Pesanan Anda sedang diproses.</div></div>` : `<div class="note">${ic('alert')}<div><b>Menunggu konfirmasi admin.</b> Setelah transfer, unggah bukti pembayaran. Status baru menjadi lunas setelah admin memeriksa pembayaran. Anda tidak dapat mengubah status sendiri.</div></div>
    <div class="card" style="margin-top:10px"><b>Bukti transfer</b>${o.proof ? `<img src="${o.proof}" alt="Bukti transfer" style="width:100%;max-height:220px;object-fit:contain;margin:8px 0;border-radius:10px"><div class="hint">Bukti terkirim. Menunggu pemeriksaan admin.</div>` : '<div class="hint" style="margin:6px 0">Belum ada bukti diunggah.</div>'}
    <label class="btn gray" style="cursor:pointer;margin-top:8px">${o.proof ? 'Ganti bukti' : 'Unggah bukti transfer'}<input type="file" accept="image/*" hidden data-proof="${o.id}"></label></div>`}
    <div class="stack" style="margin-top:8px"><button class="btn ${o.payStatus === 'Lunas' ? 'pri' : 'gray'}" data-act="pay-later" data-id="${o.id}">${o.payStatus === 'Lunas' ? 'Lihat Struk' : 'Kembali (cek status di Riwayat)'}</button></div>
  </div></div>`;
};

/* ---------- Struk ---------- */
function barcode(txt) {
  let x = 0, bars = '';
  for (const ch of txt) { const c = ch.charCodeAt(0); [1 + (c % 3), 1 + ((c >> 2) % 2)].forEach((w, i) => { if (i === 0) bars += `<rect x="${x}" y="0" width="${w}" height="30"/>`; x += w + 1; }); }
  return `<svg width="${Math.min(x, 200)}" height="30" viewBox="0 0 ${x} 30" preserveAspectRatio="none" fill="#111" aria-hidden="true">${bars}</svg>`;
}
function receiptHTML(o) {
  const d = new Date(o.ts), s = S.settings, cu = o.customer || {};
  const items = o.items.map(i => `<div class="it"><div class="nm">${esc(i.name)} ${esc(i.size)}</div><div class="r"><span>${i.qty} x ${rp(i.price)}${i.orig && i.orig !== i.price ? ' *' : ''}</span><span>${rp(i.sub)}</span></div></div>`).join('');
  const anyDisc = o.items.some(i => i.orig && i.orig !== i.price);
  return `<div class="receipt">
    <div class="c"><div class="rlogo">${logo(46, true)}</div><h4>${esc(o.store.name)}</h4><div>${esc(o.store.address)}</div><div>Telp: ${esc(o.store.phone)}</div></div><hr>
    <div class="r"><span>No. Transaksi</span><span>${esc(o.no)}</span></div>
    <div class="r"><span>Tanggal</span><span>${dateShort(d)}</span></div>
    <div class="r"><span>Jam</span><span>${timeHMS(d)}</span></div>
    <div class="r"><span>Pembeli</span><span>${esc(cu.name || 'Pelanggan')}</span></div>
    <div class="r"><span>Layanan</span><span>${o.method === 'pickup' ? 'Ambil di Toko' : 'Pesan Antar'}</span></div>
    ${o.method === 'delivery' ? `<div class="r"><span>Telp</span><span>${esc(cu.phone)}</span></div><div style="margin-top:2px">Alamat: ${esc(cu.address)}, ${esc(cu.area)}</div>${cu.note ? `<div>Catatan: ${esc(cu.note)}</div>` : ''}` : ''}<hr>
    ${items}<hr>
    <div class="r"><span>Subtotal</span><span>${rp(o.subtotal)}</span></div>
    <div class="r"><span>Biaya antar</span><span>${rp(o.fee)}</span></div>${shipRows(o, 'r')}
    <div class="r tot"><span>TOTAL</span><span>${rp(o.total)}</span></div><hr>
    <div class="r"><span>Pembayaran</span><span>${esc(payLabel(o))}</span></div>
    <div class="r"><span>Status</span><span>${esc(o.payStatus)}</span></div>
    ${o.pay.type === 'cash' ? `<div class="r"><span>Tunai diterima</span><span>${rp(o.pay.received)}</span></div><div class="r"><span>Kembalian</span><span>${rp(o.pay.change)}</span></div>` : ''}
    ${o.pay.type !== 'cash' ? `<div class="sim">Pembayaran non-tunai adalah SIMULASI untuk demonstrasi tugas.</div>` : ''}
    ${anyDisc ? '<div style="margin-top:4px">* harga sudah termasuk diskon</div>' : ''}<hr>
    <div class="c">Terima kasih telah berbelanja<br>di ${esc(o.store.name)}!<div class="bar">${barcode(o.no)}</div><div>${esc(o.no)}</div></div></div>`;
}
VIEWS.receipt = ({ id }) => {
  const o = order(id);
  if (!o) return `<div class="page">${navBar('Struk')}<div class="scroll">${emptyHTML('🧾', 'Struk tidak ditemukan', '')}</div></div>`;
  return `<div class="page">${navBar('Struk Pembayaran', { back: ADMIN })}<div class="scroll" style="padding-top:14px">
    <div class="paper">${receiptHTML(o)}</div>
    <div class="stack" style="margin-top:22px">
      ${o.payStatus === 'Menunggu Pembayaran' && o.pay.type !== 'cash' && !ADMIN ? `<button class="btn pri" data-act="open-pay" data-id="${o.id}">Bayar &amp; Unggah Bukti</button>` : ''}
      <button class="btn ${o.payStatus === 'Menunggu Pembayaran' ? 'sec2' : 'pri'}" data-act="print" data-id="${o.id}">${ic('print')} Cetak Struk</button>
      <button class="btn sec2" data-act="pdf" data-id="${o.id}">${ic('download')} Simpan sebagai PDF</button>
      <button class="btn gray" data-act="view-tx" data-id="${o.id}">Lihat Detail Transaksi</button>
      <button class="btn gray" data-act="home">${ADMIN ? 'Kembali ke Panel Admin' : 'Kembali ke Beranda'}</button></div></div></div>`;
};

/* ---------- Riwayat & detail ---------- */
function orderCard(o, admin) {
  const d = new Date(o.ts);
  return `<div class="ocard"><div class="otop"><div><b>${esc(o.no)}</b><small>${dateShort(d)} · ${timeHMS(d)}</small></div>${statusPill(o)}</div>
    <div class="omid"><div><small>${esc(payLabel(o))} · ${o.method === 'pickup' ? 'Ambil di toko' : 'Pesan antar'}</small>${payPill(o)}</div><div style="text-align:right"><small>Total</small><b class="tot">${rp(o.total)}</b></div></div>
    ${ratingHTML(o)}${admin ? adminOrderBox(o) : ''}<div class="obtns"><button class="btn sm sec2" data-act="view-tx" data-id="${o.id}">Detail</button><button class="btn sm gray" data-act="print" data-id="${o.id}">${ic('print')} Cetak Ulang</button>${o.payStatus === 'Menunggu Pembayaran' && o.pay.type !== 'cash' && !admin ? `<button class="btn sm pri" data-act="open-pay" data-id="${o.id}">Bayar</button>` : ''}${o.status === 'Selesai' && !admin ? `<button class="btn sm pri" data-act="rate-open" data-id="${o.id}">★ ${o.rating ? 'Ubah Penilaian' : 'Beri Penilaian'}</button>` : ''}${isFinal(o) ? `<button class="btn sm danger" data-act="${admin ? 'admin-del-order' : 'cust-del-order'}" data-id="${o.id}">${ic('trash')} Hapus</button>` : ''}</div></div>`;
}
const ST = ['Diproses', 'Siap', 'Dikirim', 'Selesai', 'Dibatalkan'];
const isFinal = o => o.status === 'Selesai' || o.status === 'Dibatalkan';
/* periode penjualan: hari ini, minggu ini (mulai Senin), bulan ini, semua; berdasarkan waktu pesanan dibuat */
const PERIODS = [['today', 'Hari ini'], ['week', 'Minggu ini'], ['month', 'Bulan ini'], ['all', 'Semua']];
function periodStart(p) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (p === 'today') return d.getTime();
  if (p === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
  if (p === 'month') { d.setDate(1); return d.getTime(); }
  return 0;
}
const salesList = () => { const st = periodStart(ui.sp); return S.orders.filter(o => isPaid(o) && o.ts >= st); };
const periodLabel = () => (PERIODS.find(x => x[0] === ui.sp) || PERIODS[3])[1];
const isPaid = o => o.payStatus === 'Lunas' || o.payStatus === 'Simulasi Berhasil';
const starsTxt = n => '★'.repeat(n) + '☆'.repeat(5 - n);
/* ulasan toko: disimpan terpisah dari pesanan, jadi tetap ada walau transaksinya dihapus admin */
const reviewerName = o => { const n = String((o.customer || {}).name || 'Pelanggan').trim().split(/\s+/); return n[0] + (n[1] ? ' ' + n[n.length - 1].charAt(0).toUpperCase() + '.' : ''); };
function syncReview(o) {
  if (!o.rating) return;
  S.reviews = S.reviews || [];
  const r = { id: o.id, name: reviewerName(o), stars: o.rating.stars, comment: o.rating.comment || '', ts: o.rating.ts };
  const i = S.reviews.findIndex(x => x.id === o.id);
  if (i >= 0) S.reviews[i] = r; else S.reviews.push(r);
}
function allReviews() {
  const m = {};
  S.orders.forEach(o => { if (o.rating) m[o.id] = { id: o.id, name: reviewerName(o), stars: o.rating.stars, comment: o.rating.comment || '', ts: o.rating.ts }; });
  (S.reviews || []).forEach(r => { m[r.id] = r; });
  return Object.values(m).sort((a, b) => b.ts - a.ts);
}
function reviewsHTML() {
  const rs = allReviews(), n = rs.length, avg = n ? rs.reduce((a, r) => a + r.stars, 0) / n : 0;
  const head = n
    ? `<div class="card" style="display:flex;gap:14px;align-items:center"><div style="text-align:center;flex:none"><div style="font-size:38px;font-weight:800;letter-spacing:-1px;color:var(--g2)">${avg.toFixed(1)}</div><div class="rstars">${starsTxt(Math.round(avg))}</div><div class="hint">${n} penilaian</div></div><div style="flex:1;min-width:0">${[5, 4, 3, 2, 1].map(k => { const c = rs.filter(r => r.stars === k).length; return `<div class="bar5"><span>${k}★</span><i><b style="width:${Math.round(c / n * 100)}%"></b></i><span>${c}</span></div>`; }).join('')}</div></div>`
    : `<div class="card"><div class="hint" style="text-align:center">Belum ada penilaian. Jadilah yang pertama setelah pesananmu sampai.</div></div>`;
  const list = rs.filter(r => r.comment).slice(0, 5).map(r => `<div class="rev"><div><span class="rstars">${starsTxt(r.stars)}</span> <b>${esc(r.name)}</b> <small class="hint">${dateShort(new Date(r.ts))}</small></div><div>${esc(r.comment)}</div></div>`).join('');
  return `<div class="sec"><h2>Rating &amp; Ulasan Toko</h2></div>${head}${list ? `<div class="card" style="margin-top:10px;padding:4px 14px">${list}</div>` : ''}`;
}
function ratingHTML(o) {
  const r = o.rating; if (!r) return '';
  return `<div class="rbox"><span class="rstars">${starsTxt(r.stars)}</span> <b>${r.stars}/5</b>${r.comment ? `<div>“${esc(r.comment)}”</div>` : ''}</div>`;
}
function adminOrderBox(o) {
  const cu = o.customer || {}, final = o.status === 'Selesai' || o.status === 'Dibatalkan';
  return `<div class="hint" style="margin-top:8px">${esc(cu.name || 'Pelanggan')} · ${o.items.map(i => esc(i.name) + ' ×' + i.qty).join(', ')}</div>
    ${o.proof ? `<div class="hint" style="margin-top:8px">Bukti transfer dari pelanggan:</div><img src="${o.proof}" alt="Bukti transfer" style="width:100%;max-height:200px;object-fit:contain;border-radius:10px;background:#fff;margin-bottom:6px">` : ''}${o.ship ? `<div class="fl" style="margin:8px 0"><label>No. resi ${esc(o.ship.n)} (dibuat otomatis sistem ekspedisi, bisa diubah)</label><input class="in" data-resi="${o.id}" value="${esc(o.ship.resi || '')}" maxlength="40" placeholder="Nomor resi"></div>` : ''}<div class="fl" style="margin:8px 0"><label>Status pesanan${final ? ' (final)' : ''}</label><select class="in" data-ostat="${o.id}" ${final ? 'disabled' : ''}>${ST.map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    ${o.payStatus !== 'Lunas' && o.status !== 'Dibatalkan' ? `<button class="btn sm pri" data-act="mark-paid" data-id="${o.id}" style="margin-bottom:8px">Konfirmasi Pembayaran (Tandai Lunas)</button>` : '<div class="pill ok" style="margin-bottom:8px">Pembayaran sudah dikonfirmasi</div>'}`;
}
VIEWS.history = () => {
  const list = S.orders.filter(o => (!o.cid || o.cid === PR.cid) && !o.hideC).sort((a, b) => b.ts - a.ts);
  return `<div class="page"><div class="scroll"><h1 class="ltitle">Riwayat</h1>${list.some(isFinal) ? `<button class="btn sm danger" data-act="cust-clear-done" style="margin-bottom:12px">${ic('trash')} Hapus semua yang selesai/dibatalkan</button>` : ''}${list.length ? list.map(o => orderCard(o)).join('') : emptyHTML('🧾', 'Belum ada transaksi', 'Transaksi yang selesai akan tampil di sini.', '<button class="btn pri" style="margin-top:18px" data-act="tab" data-tab="products">Belanja Sekarang</button>')}</div></div>`;
};
VIEWS.txdetail = ({ id }) => {
  const o = order(id);
  if (!o) return `<div class="page">${navBar('Detail')}<div class="scroll">${emptyHTML('🧾', 'Transaksi tidak ditemukan', '')}</div></div>`;
  const d = new Date(o.ts), cu = o.customer || {};
  const kv = (k, v) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`;
  return `<div class="page">${navBar('Detail Transaksi')}<div class="scroll">
    <div class="gtitle" style="margin-top:6px">Informasi</div>
    <div class="group">${kv('No. transaksi', esc(o.no))}${kv('Tanggal', dateShort(d))}${kv('Jam', timeHMS(d))}${kv('Status', statusPill(o))}${kv('Status pembayaran', payPill(o))}${kv('Metode bayar', esc(payLabel(o)))}${o.pay.type === 'cash' ? kv('Tunai diterima', rp(o.pay.received)) + kv('Kembalian', rp(o.pay.change)) : ''}</div>
    <div class="gtitle">${o.method === 'pickup' ? 'Ambil di toko' : 'Pengantaran'}</div>
    <div class="group">${kv('Pembeli', esc(cu.name || 'Pelanggan'))}${o.method === 'delivery' ? kv('No. HP', esc(cu.phone)) + kv('Alamat', esc(cu.address)) + kv('Area', esc(cu.area)) + (cu.note ? kv('Catatan', esc(cu.note)) : '') : kv('Lokasi', esc(o.store.address))}</div>
    <div class="gtitle">Barang</div>
    <div class="card" style="padding:6px 14px">${o.items.map(i => `<div class="mini"><div class="mt"><b>${esc(i.name)}</b><small>${esc(i.size)} · ${i.qty} × ${rp(i.price)}</small></div><div class="mp">${rp(i.sub)}</div></div>`).join('')}</div>
    <div class="card" style="margin-top:12px"><div class="trow"><span>Subtotal</span><span>${rp(o.subtotal)}</span></div><div class="trow"><span>Biaya pengantaran</span><span>${rp(o.fee)}</span></div>${shipRows(o, 'trow')}<div class="trow total"><span>Total</span><span>${rp(o.total)}</span></div></div>
    <div class="stack" style="margin-top:16px">
      ${o.payStatus === 'Menunggu Pembayaran' && o.pay.type !== 'cash' && !ADMIN ? `<button class="btn pri" data-act="open-pay" data-id="${o.id}">Bayar &amp; Unggah Bukti</button>` : ''}${ratingHTML(o)}${o.status === 'Selesai' && !ADMIN ? `<button class="btn pri" data-act="rate-open" data-id="${o.id}">★ ${o.rating ? 'Ubah Penilaian' : 'Beri Penilaian'}</button>` : ''}${o.status === 'Diproses' ? `<button class="btn danger" data-act="cancel-order" data-id="${o.id}">Batalkan Pesanan</button>` : ''}
      <button class="btn sec2" data-act="view-receipt" data-id="${o.id}">${ic('receipt')} Lihat Struk</button>
      <button class="btn gray" data-act="print" data-id="${o.id}">${ic('print')} Cetak Struk</button>${isFinal(o) && !(ADMIN && o.hideA) ? `<button class="btn danger" data-act="${ADMIN ? 'admin-del-order' : 'cust-del-order'}" data-id="${o.id}">${ic('trash')} Hapus Transaksi</button>` : ''}</div></div></div>`;
};

/* ---------- Profil ---------- */
VIEWS.profile = () => {
  const s = S.settings, name = PR.name || 'Pelanggan';
  const row = (icon, t, sub, act, cls = '') => `<button class="row ${cls}" data-act="${act}"><span class="ri">${ic(icon)}</span><span class="rt"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span>${ic('chevR', 'chev')}</button>`;
  return `<div class="page"><div class="scroll"><h1 class="ltitle">Profil</h1>
    <div class="pcenter"><div class="avatar" data-act="photo">${PR.photo ? `<img src="${PR.photo}" alt="Foto profil">` : esc(name.trim().charAt(0).toUpperCase() || 'P')}</div><b>${esc(name)}</b><small>Pelanggan ${esc(s.storeName)}</small></div>
    <div class="gtitle" style="margin-top:0">Data pelanggan</div>
    <div class="group">${row('edit', 'Nama', esc(name), 'change-name')}${row('phone', 'Nomor HP', esc(PR.phone || 'Belum diisi'), 'change-name')}${row('pin', 'Alamat', esc(PR.address || 'Belum diisi'), 'change-name')}</div>
    <div class="gtitle">Akun</div>
    <div class="group">${row('user', 'Foto profil', PR.photo ? 'Ganti atau hapus foto' : 'Unggah foto', 'photo')}${row('chat', 'Chat dengan admin', 'Tanya stok atau pesanan', 'chat')}${row('lock', 'Ubah PIN aplikasi', 'PIN 4–6 digit', 'change-pin')}</div>
    <div class="gtitle">Aplikasi</div>
    <div class="group">${row('share', 'Pasang di layar utama iPhone', 'Panduan menambahkan sebagai PWA', 'a2hs')}${row('lock', 'Kunci aplikasi', 'Kembali ke layar PIN', 'lock')}${row('logout', 'Keluar akun', '', 'logout')}</div>
    <p class="hint" style="text-align:center;margin-top:16px">SARAYAMART v1.0 · Pembayaran non-tunai hanyalah simulasi.</p></div></div>`;
};

/* ---------- Admin ---------- */
VIEWS.admin = () => {
  if (!ADMIN) return '';
  const sales = salesList().reduce((a, o) => a + o.total, 0);
  const lowN = S.products.filter(p => p.stock <= LOW).length;
  const tabs = [['products', 'Produk'], ['orders', 'Transaksi' + (activeN() ? ' (' + activeN() + ')' : '')], ['settings', 'Pengaturan']];
  let body = '';
  if (ui.adminTab === 'products') {
    body = `<button class="btn pri" data-act="admin-add" style="margin-bottom:12px">${ic('plus')} Tambah Produk</button>${searchBox('Cari produk (nama, kategori, ukuran)…')}<div id="alist">${adminList()}</div>`;
  } else if (ui.adminTab === 'orders') body = `${searchBox('Cari transaksi (no., nama pembeli, barang)…')}<div id="alist">${adminList()}</div>`;
  else if (ui.adminTab === 'chat') body = `${searchBox('Cari percakapan atau isi pesan…')}<div id="alist">${adminList()}</div>`;
  else body = settingsForm() + `<button class="btn sec2" data-act="export-data" style="margin:6px 0 4px">Unduh data produk (data.js)</button><div class="hint" style="margin-bottom:14px">Menyimpan semua produk &amp; pengaturan toko ke file <b>data.js</b>. Taruh file itu di folder aplikasi (gantikan data.js lama) lalu upload ulang, supaya semua orang yang membuka melihat produk yang sama. PIN, pesanan, dan chat tidak ikut.</div><button class="btn danger" data-act="reset" style="margin:6px 0 18px">Reset data demo (produk, stok, pesanan)</button>`;
  return `<div class="page">${navBar('Panel Admin', { back: false, right: '<button data-act="test-sound" aria-label="Tes bunyi notifikasi" style="margin-right:12px;font-size:18px">🔔</button><button data-act="lock" style="color:var(--g);font-weight:700">Kunci</button>' })}<div class="scroll">
    <div class="stats"><button class="stat" data-act="admin-stat" data-v="orders"><small>Transaksi</small><b>${S.orders.length}</b><i class="sgo">Lihat daftar ›</i></button><button class="stat" data-act="admin-stat" data-v="sales"><small>Total penjualan · ${periodLabel()}</small><b>${rp(sales)}</b><i class="sgo">Lihat rincian ›</i></button><button class="stat" data-act="admin-stat" data-v="products"><small>Produk</small><b>${S.products.length}</b><i class="sgo">Lihat produk ›</i></button><button class="stat" data-act="admin-stat" data-v="low"><small>Stok menipis/habis</small><b>${lowN}</b><i class="sgo">Lihat stok ›</i></button></div>
    ${body}</div></div>`;
};
function searchBox(ph) {
  return `<label class="search" style="background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:12px">${ic('search')}<input id="aq" type="search" value="${esc(ui.aq)}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
}
const activeN = () => S.orders.filter(o => !isFinal(o)).length;
const doneN = () => S.orders.filter(o => isFinal(o) && !o.hideA).length;
function ordSeg() {
  const t = (k, n, c) => `<button class="chip ${ui.ot === k ? 'on' : ''}" data-act="admin-ot" data-v="${k}">${n} (${c})</button>`;
  return `<div class="chips wrap" style="margin-bottom:12px">${t('active', 'Aktif', activeN())}${t('done', 'Selesai', doneN())}</div>`;
}
function adminList() {
  const q = String(ui.aq || '').trim().toLowerCase(), has = s => String(s == null ? '' : s).toLowerCase().includes(q);
  if (ui.adminTab === 'products') {
    if (!S.products.length) return emptyHTML('📦', 'Belum ada produk', 'Tambahkan produk pertama Anda.');
    const l = S.products.filter(p => !q || has(p.name + ' ' + p.category + ' ' + p.size));
    return l.length ? l.map(p => `<div class="arow"><div class="pimgwrap">${imgHTML(p)}</div><div class="at"><b>${esc(p.name)} · ${esc(p.size)}</b><small>${esc(p.category)} · ${rp(p.price)}${p.discount ? ` (-${p.discount}%)` : ''} · Stok ${p.stock}${p.stock <= 0 ? ' (Habis)' : p.stock <= LOW ? ' (Menipis)' : ''}</small></div><div class="ab"><button data-act="admin-edit" data-id="${p.id}" aria-label="Edit">${ic('edit')}</button><button class="d" data-act="admin-del" data-id="${p.id}" aria-label="Hapus">${ic('trash')}</button></div></div>`).join('') : emptyHTML('🔍', 'Produk tidak ditemukan', 'Coba kata kunci lain.');
  }
  if (ui.adminTab === 'orders') {
    const done = ui.ot === 'done';
    const all = S.orders.filter(o => done ? (isFinal(o) && !o.hideA) : !isFinal(o)).sort((a, b) => done ? b.ts - a.ts : a.ts - b.ts);
    const seg = ordSeg();
    if (!all.length) return seg + (done ? emptyHTML('🧾', 'Belum ada transaksi selesai', 'Pesanan yang Selesai/Dibatalkan akan masuk ke sini. Total penjualan tidak terpengaruh walau daftar ini dibersihkan.') : emptyHTML('✅', 'Tidak ada pesanan aktif', 'Semua pesanan sudah selesai. Pesanan baru akan muncul di sini.'));
    const l = all.filter(o => !q || has([o.no, (o.customer || {}).name, (o.customer || {}).phone, o.status, o.payStatus, payLabel(o)].concat(o.items.map(i => i.name)).join(' ')));
    return seg + (!q && done ? `<button class="btn sm danger" data-act="admin-clear-done" style="margin-bottom:6px">${ic('trash')} Bersihkan daftar selesai/dibatalkan</button><div class="hint" style="margin-bottom:12px">Hanya daftar yang dibersihkan. Total penjualan tetap.</div>` : '') + (l.length ? l.map(o => orderCard(o, true)).join('') : emptyHTML('🔍', 'Transaksi tidak ditemukan', 'Coba nomor transaksi, nama pembeli, atau nama barang.'));
  }
  return adminChat(q);
}
function statSheet(kind) {
  const orowT = o => { const d = new Date(o.ts); return `<button class="arow" style="width:100%;text-align:left" data-act="admin-stat-order" data-id="${o.id}"><div class="at"><b>${esc(o.no)} · ${esc((o.customer || {}).name || 'Pelanggan')}</b><small>${dateShort(d)} ${timeHM(d)} · ${esc(payLabel(o))} · ${esc(o.status)}</small></div><b style="color:var(--g2);font-size:14px;flex:none">${rp(o.total)}</b></button>`; };
  const prow = p => `<button class="arow" style="width:100%;text-align:left" data-act="admin-stat-product" data-id="${p.id}"><div class="pimgwrap">${imgHTML(p)}</div><div class="at"><b>${esc(p.name)} · ${esc(p.size)}</b><small>${esc(p.category)} · ${rp(p.price)}${p.discount ? ` (-${p.discount}%)` : ''}</small></div><span class="pill ${p.stock <= 0 ? 'no' : p.stock <= LOW ? 'wait' : 'ok'}">${p.stock <= 0 ? 'Habis' : 'Stok ' + p.stock}</span></button>`;
  const byTs = (a, b) => b.ts - a.ts;
  let h = '';
  if (kind === 'orders') {
    const l = S.orders.filter(o => !o.hideA).sort(byTs), cnt = s => l.filter(o => o.status === s).length, hid = S.orders.length - l.length;
    h = `<h3>Semua Transaksi (${S.orders.length})</h3>${hid ? `<div class="hint" style="margin-bottom:8px">${hid} transaksi sudah dibersihkan dari daftar admin, tetap dihitung di total.</div>` : ''}` + (l.length ? `<div class="hint" style="margin-bottom:10px">Diproses ${cnt('Diproses')} · Siap ${cnt('Siap')} · Dikirim ${cnt('Dikirim')} · Selesai ${cnt('Selesai')} · Dibatalkan ${cnt('Dibatalkan')}. Ketuk transaksi untuk melihat detail.</div>` + l.map(orowT).join('') : emptyHTML('🧾', 'Belum ada transaksi', ''));
  } else if (kind === 'sales') {
    const l = salesList().sort(byTs), sum = l.reduce((a, o) => a + o.total, 0);
    const meth = { cash: ['Tunai', 0], bank: ['Transfer Bank', 0], qris: ['QRIS', 0], wallet: ['E-Wallet', 0] };
    l.forEach(o => { if (meth[o.pay.type]) meth[o.pay.type][1] += o.total; });
    h = `<h3>Total Penjualan</h3><div class="chips wrap">${PERIODS.map(([k, n]) => `<button class="chip ${ui.sp === k ? 'on' : ''}" data-act="admin-period" data-v="${k}">${n}</button>`).join('')}</div><div class="card" style="text-align:center;margin-bottom:12px"><div class="hint">${periodLabel()} · dari ${l.length} transaksi lunas</div><div style="font-size:30px;font-weight:800;color:var(--g2);letter-spacing:-1px">${rp(sum)}</div></div>` +
      (l.length ? `<div class="group" style="margin-bottom:12px">${Object.values(meth).map(([n, v]) => `<div class="kv"><span>${n}</span><span>${rp(v)}</span></div>`).join('')}</div>` + l.map(orowT).join('') : emptyHTML('💰', 'Belum ada penjualan', 'Belum ada transaksi lunas pada periode ini.'));
  } else if (kind === 'products') {
    const l = S.products.slice().sort((a, b) => a.name.localeCompare(b.name, 'id'));
    h = `<h3>Semua Produk (${l.length})</h3><div class="hint" style="margin-bottom:10px">Ketuk produk untuk mengedit.</div>` + (l.length ? l.map(prow).join('') : emptyHTML('📦', 'Belum ada produk', ''));
  } else {
    const l = S.products.filter(p => p.stock <= LOW).sort((a, b) => a.stock - b.stock);
    h = `<h3>Stok Menipis / Habis (${l.length})</h3><div class="hint" style="margin-bottom:10px">Stok ${LOW} atau kurang. Ketuk produk untuk menambah stok.</div>` + (l.length ? l.map(prow).join('') : emptyHTML('✅', 'Semua stok aman', 'Tidak ada produk yang menipis atau habis.'));
  }
  openSheet(h + '<button class="btn gray" data-act="close-sheet" style="margin-top:10px">Tutup</button>');
}
function settingsForm() {
  const s = S.settings;
  const acc = (arr, kind) => arr.map(a => `<div class="card" style="margin-bottom:8px"><b>${esc(a.name)}</b>
    <div class="fl" style="margin:8px 0 0"><label>Nomor ${kind}</label><input class="in" name="${kind}-${a.id}-number" value="${esc(a.number)}"></div>
    <div class="fl" style="margin:8px 0 0"><label>Atas nama</label><input class="in" name="${kind}-${a.id}-holder" value="${esc(a.holder)}"></div></div>`).join('');
  return `<form id="setform" novalidate>
    <div class="gtitle" style="margin-top:0">Toko</div>
    <div class="fl"><label>Nama toko</label><input class="in" name="storeName" value="${esc(s.storeName)}"></div>
    <div class="fl"><label>Alamat toko</label><textarea class="in" name="address" rows="2">${esc(s.address)}</textarea></div>
    <div class="fl"><label>Nomor kontak</label><input class="in" name="phone" inputmode="tel" value="${esc(s.phone)}"></div>
    <div class="fl"><label>Ongkir standar (Rp) — dipakai bila area tidak punya tarif sendiri</label><input class="in" name="deliveryFee" inputmode="numeric" value="${s.deliveryFee}"></div>
    <div class="fl"><label>Area pengantaran &amp; ongkirnya — satu baris per area: Nama | ongkir (kosongkan ongkir = pakai ongkir standar)</label><textarea class="in" name="areas" rows="5" placeholder="Medan Kota | 5000&#10;Binjai | 12000">${esc(s.areas.map(a => s.areaFees[a] != null ? a + ' | ' + s.areaFees[a] : a).join('\n'))}</textarea></div>
    <div class="fl"><label>Ongkir untuk tujuan di luar daftar / luar kota (Rp)</label><input class="in" name="otherFee" inputmode="numeric" value="${s.otherFee}"></div>
    <div class="gtitle">Ekspedisi (kirim luar kota)</div>
    <div class="fl"><label>Kurir — satu baris per layanan: Kurir | Layanan | ongkir | estimasi. Ongkir diisi manual oleh admin (bukan tarif otomatis dari ekspedisi).</label><textarea class="in" name="couriers" rows="4" placeholder="J&amp;T Express | Reguler | 18000 | 2-4 hari">${esc((s.couriers || []).map(c => [c.n, c.s, c.fee, c.eta].join(' | ')).join('\n'))}</textarea></div>
    <div class="gtitle">Voucher ongkir</div>
    <div class="fl"><label>Satu baris per voucher: KODE | potongan ongkir (Rp) | minimal belanja | kuota (0 = tanpa batas)</label><textarea class="in" name="vouchers" rows="3" placeholder="HEMAT10 | 10000 | 50000 | 0">${esc((s.vouchers || []).map(v => [v.code, v.amt, v.min, v.quota].join(' | ')).join('\n'))}</textarea></div>
    <div class="gtitle">Rekening bank (simulasi)</div>${acc(s.banks, 'bank')}
    <div class="gtitle">E-wallet (simulasi)</div>${acc(s.wallets, 'wallet')}
    <div class="gtitle">Keamanan</div>
    <div class="fl"><label>PIN admin baru (kosongkan jika tidak diubah)</label><input class="in" name="adminPin" inputmode="numeric" maxlength="6" placeholder="4–6 digit angka" type="password" autocomplete="new-password"></div>
    <div class="err" id="seterr" style="margin-bottom:8px"></div>
    <div class="sticky-save"><button class="btn pri" type="submit">Simpan Pengaturan</button></div></form>`;
}
function saveSettings(form) {
  const f = n => form.elements[n].value.trim();
  const err = m => { $('#seterr').textContent = m; toast(m, true); };
  const fee = f('deliveryFee');
  if (!/^\d+$/.test(fee) || Number(fee) > 1000000) return err('Biaya pengantaran harus berupa angka 0 atau lebih.');
  if (!f('storeName')) return err('Nama toko wajib diisi.');
  if (f('address').length < 8) return err('Alamat toko terlalu pendek.');
  if (!/^[0-9+\-\s()]{8,20}$/.test(f('phone'))) return err('Nomor kontak tidak valid.');
  const areas = [], fees = {};
  for (const ln of f('areas').split(/[\n,]+/).map(x => x.trim()).filter(Boolean)) {
    const [n, fe] = ln.split('|').map(x => x.trim());
    if (fe && !/^\d+$/.test(fe)) return err(`Ongkir area "${n}" harus berupa angka.`);
    if (!areas.includes(n)) areas.push(n);
    if (fe) fees[n] = Number(fe);
  }
  if (!areas.length) return err('Isi minimal satu area pengantaran.');
  const ofee = f('otherFee');
  if (!/^\d+$/.test(ofee) || Number(ofee) > 1000000) return err('Ongkir luar kota harus berupa angka 0 atau lebih.');
  const couriers = [], vouchers = [], rows = n => f(n).split('\n').map(x => x.trim()).filter(Boolean);
  for (const ln of rows('couriers')) {
    const [n, sv, fe, eta] = ln.split('|').map(x => x.trim());
    if (!n || !/^\d+$/.test(fe || '')) return err(`Kurir "${ln}" salah. Format: Kurir | Layanan | ongkir | estimasi`);
    couriers.push({ n, s: sv || 'Reguler', fee: Number(fe), eta: eta || '' });
  }
  for (const ln of rows('vouchers')) {
    const [cd, am, mn, qt] = ln.split('|').map(x => x.trim());
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(cd || '') || !/^\d+$/.test(am || '') || (mn && !/^\d+$/.test(mn)) || (qt && !/^\d+$/.test(qt))) return err(`Voucher "${ln}" salah. Format: KODE | potongan | minimal belanja | kuota`);
    const old = (S.settings.vouchers || []).find(v => v.code === cd.toUpperCase());
    vouchers.push({ code: cd.toUpperCase(), amt: Number(am), min: Number(mn) || 0, quota: Number(qt) || 0, used: old ? old.used || 0 : 0 });
  }
  const checkAcc = (arr, kind) => {
    for (const a of arr) {
      const n = f(`${kind}-${a.id}-number`), h = f(`${kind}-${a.id}-holder`);
      if (!/^[0-9\-\s+]{6,25}$/.test(n)) return `Nomor ${a.name} tidak valid (hanya angka, spasi, atau tanda -).`;
      if (!h) return `Nama pemilik ${a.name} wajib diisi.`;
    }
    return '';
  };
  const e1 = checkAcc(S.settings.banks, 'bank') || checkAcc(S.settings.wallets, 'wallet');
  if (e1) return err(e1);
  const np = f('adminPin');
  if (np && !/^\d{4,6}$/.test(np)) return err('PIN admin harus 4–6 digit angka.');
  const s = S.settings;
  s.storeName = f('storeName'); s.address = f('address'); s.phone = f('phone'); s.deliveryFee = Number(fee); s.areas = areas; s.areaFees = fees; s.otherFee = Number(ofee); s.couriers = couriers; s.vouchers = vouchers;
  s.banks.forEach(a => { a.number = f(`bank-${a.id}-number`); a.holder = f(`bank-${a.id}-holder`); });
  s.wallets.forEach(a => { a.number = f(`wallet-${a.id}-number`); a.holder = f(`wallet-${a.id}-holder`); });
  if (np) s.adminPin = np;
  save(); toast('Pengaturan tersimpan ✓'); refresh();
}

/* =====================================================================
   AKSI KERANJANG
   ===================================================================== */
function addToCart(id, qty = 1, silent, vid, un) {
  const p = product(id);
  if (!p) return toast('Produk tidak ditemukan.', true);
  if (hasVar(p) && !vOf(p, vid)) { if (!silent) productSheet(id); toast('Pilih varian terlebih dahulu.', true); return false; }
  un = un && un !== baseName(p) ? un : ''; vid = hasVar(p) ? vid : '';
  const u = uOf(p, un), st = stockOf(p, vid), key = { id, vid, u: un };
  const room = Math.floor((st - usedBase(p, vid)) / u.q);
  if (room <= 0) { toast(`Stok ${p.name} tidak cukup untuk ${u.n} (tersisa ${st} ${baseName(p)}).`, true); return false; }
  if (qty > room) { toast(`Stok hanya cukup untuk ${room} ${u.n}.`, true); qty = room; }
  const c = S.cart.find(x => lk(x) === lk(key));
  if (c) c.qty += qty; else S.cart.push(Object.assign(key, { qty }));
  save();
  if (!silent) toast(`✓ ${p.name} masuk keranjang`);
  renderTabbar(); renderCartBar();
  if (curr().name === 'home') {
    const b = $('.hrow .iconbtn');
    if (b) b.innerHTML = `${ic('cart')}<i class="dot">${cartCount()}</i>`;
    const sc = $('.scroll', view); if (sc) sc.style.paddingBottom = '84px';
  }
  return true;
}

/* =====================================================================
   PEMBUATAN TRANSAKSI
   ===================================================================== */
async function confirmOrder() {
  if (ui.busy) return;
  const t = totals();
  if (!t.lines.length) return toast('Keranjang masih kosong.', true);
  const bad = stockProblems();
  if (bad.length) return ask({ title: 'Stok berubah', msg: esc(bad.join('; ')) + '. Silakan sesuaikan keranjang.', ok: 'Mengerti', cancel: '' }).then(() => { sanitizeCart(true); setTab('cart'); });
  ui.co.errors = validateCO();
  if (Object.keys(ui.co.errors).length) {
    refresh();
    toast('Periksa kembali data yang ditandai merah.', true);
    const first = $('.fl.bad', view); if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  const co = ui.co, s = S.settings;
  const payTxt = co.pay === 'cash' ? `Tunai (diterima ${rp(Number(co.received))}, kembali ${rp(Number(co.received) - t.total)})` : co.pay === 'bank' ? 'Transfer ' + co.bank : co.pay === 'qris' ? 'QRIS (Simulasi)' : 'E-Wallet ' + co.wallet;
  const sh = openSheet(`<h3>Periksa pesanan Anda</h3>
    <div class="card" style="padding:6px 14px">${t.lines.map(l => `<div class="mini"><div class="mt"><b>${esc(l.p.name)}</b><small>${l.qty} × ${rp(l.price)}</small></div><div class="mp">${rp(l.sub)}</div></div>`).join('')}</div>
    <div class="card" style="margin-top:10px"><div class="trow"><span>Subtotal</span><span>${rp(t.subtotal)}</span></div><div class="trow"><span>Pengantaran</span><span>${rp(t.fee)}</span></div>${t.disc ? `<div class="trow"><span>Diskon ongkir</span><span>-${rp(t.disc)}</span></div>` : ''}<div class="trow total"><span>Total</span><span>${rp(t.total)}</span></div></div>
    <div class="group" style="margin-top:10px"><div class="kv"><span>Layanan</span><span>${co.method === 'pickup' ? 'Ambil di toko' : 'Pesan antar'}</span></div>${co.method === 'delivery' ? `<div class="kv"><span>Penerima</span><span>${esc(co.name)}<br>${esc(co.phone)}</span></div><div class="kv"><span>Alamat</span><span>${esc(co.address)}, ${esc(areaText(co))}</span></div>` : `<div class="kv"><span>Lokasi</span><span>${esc(s.address)}</span></div>`}<div class="kv"><span>Pembayaran</span><span>${esc(payTxt)}</span></div></div>
    <div class="stack" style="margin-top:16px"><button class="btn pri" data-act="do-order">Ya, Selesaikan Transaksi</button><button class="btn gray" data-act="close-sheet">Periksa Lagi</button></div>`);
  return sh;
}
async function createOrder() {
  if (ui.busy) return;
  ui.busy = true; closeSheet();
  loader(true, 'Memproses pesanan…');
  await wait(750);
  try {
    S = load();                       // data terbaru (stok bisa diubah admin)
    const bad = stockProblems();
    if (bad.length || !S.cart.length) { loader(false); ui.busy = false; toast('Stok berubah, transaksi dibatalkan: ' + (bad[0] || 'keranjang kosong'), true); sanitizeCart(true); setTab('cart'); return; }
    const co = ui.co, t = totals();
    const err = validateCO();
    if (Object.keys(err).length) { loader(false); ui.busy = false; co.errors = err; refresh(); return; }
    const now = new Date();
    S.seq += 1;
    const no = `SM${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${String(S.seq).padStart(4, '0')}`;
    const cash = co.pay === 'cash';
    const o = {
      id: 'o' + now.getTime() + '_' + S.seq, no, ts: now.getTime(),
      store: { name: S.settings.storeName, address: S.settings.address, phone: S.settings.phone },
      items: t.lines.map(l => ({ pid: l.p.id, name: l.p.name, size: l.label, vid: l.vid, vname: (vOf(l.p, l.vid) || {}).name || '', code: (vOf(l.p, l.vid) || {}).code || '', unit: l.u.n, uq: l.u.q, base: l.base, qty: l.qty, price: l.price, orig: l.p.price, sub: l.sub })),
      subtotal: t.subtotal, fee: t.fee, total: t.total, method: co.method, disc: t.disc, voucher: t.disc ? co.vApplied : '', ship: co.method === 'delivery' && co.carrier === 'courier' ? { n: courierOf(co).n, s: courierOf(co).s, eta: courierOf(co).eta, resi: '' } : null,
      customer: { name: co.name.trim() || PR.name || 'Pelanggan', phone: co.method === 'delivery' ? co.phone.trim() : '', address: co.method === 'delivery' ? co.address.trim() : '', area: co.method === 'delivery' ? (co.carrier === 'courier' ? co.city.trim() : areaText(co)) : '', note: co.method === 'delivery' ? co.note.trim() : '' },
      pay: { type: co.pay, provider: co.pay === 'bank' ? co.bank : co.pay === 'wallet' ? co.wallet : '', received: cash ? Number(co.received) : 0, change: cash ? Number(co.received) - t.total : 0 },
      payStatus: 'Menunggu Pembayaran', status: 'Diproses', stockDeducted: false, cid: PR.cid
    };
    // kurangi stok tepat satu kali
    o.items.forEach(i => { const p = product(i.pid); if (p) { adjStock(p, i.vid, -(i.base || i.qty)); p.sold = (p.sold || 0) + (i.base || i.qty); } });
    o.stockDeducted = true;
    if (t.disc) { const vv = voucherOf(co.vApplied); if (vv) vv.used = (vv.used || 0) + 1; }
    S.orders.push(o); S.cart = [];
    save();
    if (co.method === 'delivery') {
      let ch = false;
      if (!PR.phone && co.phone.trim()) { PR.phone = co.phone.trim(); ch = true; }
      if (!PR.address && co.address.trim()) { PR.address = co.address.trim(); ch = true; }
      if (ch) savePR();
    }
    snapOrders();
    ui.co = freshCO();
    loader(false); ui.busy = false;
    if (cash) { toast('Transaksi berhasil ✓'); resetTo('receipt', { id: o.id }); }
    else resetTo('pay', { id: o.id });
  } catch (e) { console.error(e); loader(false); ui.busy = false; toast('Terjadi kesalahan saat memproses transaksi.', true); }
}
function settlePayment(id) {
  const o = order(id);
  if (!o || o.payStatus !== 'Menunggu Pembayaran') return;
  o.payStatus = 'Simulasi Berhasil'; save();
}
/* satu pintu untuk semua perubahan status: stok dikembalikan tepat sekali saat dibatalkan.
   Aturan: pesanan Selesai/Dibatalkan bersifat final. Pelanggan hanya boleh membatalkan saat status Diproses. */
function applyStatus(id, st) {
  S = load();
  const o = order(id);
  if (!o || o.status === st || o.status === 'Dibatalkan' || o.status === 'Selesai') return false;
  if ((st === 'Dikirim' || st === 'Selesai') && o.payStatus !== 'Lunas') return false;   // belum lunas tidak boleh dikirim/selesai
  if (st === 'Dibatalkan') {
    if (o.stockDeducted) {
      o.items.forEach(i => { const p = product(i.pid); if (p) { adjStock(p, i.vid, i.base || i.qty); p.sold = Math.max(0, (p.sold || 0) - (i.base || i.qty)); } });
      o.stockDeducted = false;
    }
    o.payStatus = 'Dibatalkan';
    if (o.voucher) { const vv = voucherOf(o.voucher); if (vv && vv.used > 0) vv.used--; }
  }
  o.status = st;
  if (o.ship) {
    if (st === 'Dikirim') { if (!o.ship.resi) { o.ship.resi = makeResi(o.ship.n); o.ship.booked = Date.now(); } if (!o.ship.shippedAt) o.ship.shippedAt = Date.now(); }
    if (st === 'Selesai') o.ship.doneAt = Date.now();
  }
  save(); return true;
}
async function cancelOrder(id) {
  const o = order(id);
  if (!o || o.status !== 'Diproses') return toast('Pesanan sudah diproses admin dan tidak bisa dibatalkan.', true);
  if (!await ask({ title: 'Batalkan pesanan?', msg: `Pesanan ${esc(o.no)} akan dibatalkan dan stok dikembalikan.`, ok: 'Batalkan', cancel: 'Tidak', danger: true })) return;
  if (applyStatus(id, 'Dibatalkan')) toast('Pesanan dibatalkan, stok dikembalikan.'); else toast('Pesanan tidak dapat dibatalkan.', true);
  refresh();
}
async function deleteOrders(ids) {
  S = load();
  const list = S.orders.filter(o => ids.includes(o.id) && isFinal(o) && !(ADMIN && o.hideA));
  if (!list.length) { toast('Hanya transaksi selesai/dibatalkan yang bisa dihapus.', true); return false; }
  const what = list.length > 1 ? list.length + ' transaksi' : 'Transaksi ' + esc(list[0].no);
  const msg = ADMIN
    ? `${what} akan dihapus dari daftar transaksi admin. Total penjualan dan jumlah transaksi TIDAK berkurang. Riwayat di sisi pelanggan tidak berubah.`
    : `${what} akan dihapus dari riwayat Anda. Data toko tetap tersimpan.`;
  if (!await ask({ title: 'Hapus transaksi?', msg, ok: 'Hapus', danger: true })) return false;
  S = load();
  if (ADMIN) S.orders.forEach(o => { if (ids.includes(o.id) && isFinal(o)) { syncReview(o); o.hideA = true; delete o.proof; } });   /* hanya disembunyikan, data tetap untuk total */
  else S.orders.forEach(o => { if (ids.includes(o.id) && isFinal(o)) o.hideC = true; });
  save(); snapOrders(); toast('Transaksi dihapus ✓');
  return true;
}
function exportData() {
  S = load();
  const st = Object.assign({}, S.settings); delete st.userPin; delete st.adminPin; delete st.userName;
  const json = JSON.stringify({ products: S.products, settings: st }, null, 1).replace(/<\/(script)/gi, '<\\/$1').replace(/[\u2028\u2029]/g, '');
  const txt = '/* Data awal SARAYAMART. Dibuat dari Admin > Pengaturan > Unduh data produk. */\nwindow.SM_DATA = ' + json + ';\n';
  try {
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' }));
    const a = document.createElement('a'); a.href = url; a.download = 'data.js'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) { return toast('Gagal membuat file unduhan.', true); }
  const mb = txt.length / 1048576;
  toast(`data.js diunduh ✓ (${S.products.length} produk${mb >= 1 ? ', ' + mb.toFixed(1) + ' MB, gambar unggahan membuatnya besar' : ''})`);
}
function printOrder(id) {
  const o = order(id); if (!o) return;
  $('#printArea').innerHTML = receiptHTML(o);
  setTimeout(() => window.print(), 80);
}

/* =====================================================================
   SHEET PRODUK, ADMIN, PROFIL
   ===================================================================== */
function productSheet(id) {
  const p = product(id); if (!p) return;
  ui.sel = { id, vid: hasVar(p) && p.variants.length === 1 ? p.variants[0].id : '', un: '' };
  const au = allUnits(p);
  const sh = openSheet(`<div class="pimgwrap" id="simg" style="aspect-ratio:16/10;margin-bottom:12px">${imgHTML(p, true)}${p.discount ? `<span class="badge disc">-${p.discount}%</span>` : ''}</div>
    <div class="hint">${esc(p.category)} · ${esc(p.size)}</div><h3 style="margin-top:2px">${esc(p.name)}</h3>
    <div style="display:flex;align-items:baseline;gap:10px"><b id="sprice" style="font-size:26px;color:var(--g2)"></b></div><div class="hint" id="sper"></div>
    <p style="line-height:1.5;color:#3b4640;margin:10px 0">${esc(p.desc)}</p>
    ${hasVar(p) ? `<div class="hint" style="font-weight:700;margin-bottom:6px">Pilih varian</div><div class="chips wrap">${p.variants.map(v => `<button class="chip" data-act="sel-var" data-v="${esc(v.id)}">${esc(v.name)}${v.stock <= 0 ? ' (habis)' : ''}</button>`).join('')}</div>` : ''}
    ${au.length > 1 ? `<div class="hint" style="font-weight:700;margin-bottom:6px">Pilih satuan beli</div><div class="chips wrap">${au.map(u => `<button class="chip" data-act="sel-unit" data-v="${esc(u.n)}">${esc(u.n)}${u.q > 1 ? ' · isi ' + u.q : ''}</button>`).join('')}</div>` : ''}
    <div class="pill ok" id="sstock" style="margin-bottom:14px"></div>
    <div style="display:flex;gap:12px;align-items:center"><div class="stepper" data-max="1"><button data-act="sq-dec" aria-label="Kurangi">${ic('minus')}</button><span id="sq">1</span><button data-act="sq-inc" aria-label="Tambah">${ic('plus')}</button></div><button class="btn pri" data-act="sq-add" data-id="${p.id}"><span id="sqt"></span></button></div>`);
  sheetUpdate();
  return sh;
}
function sheetUpdate() {
  const sl = ui.sel, p = product(sl.id); if (!p) return;
  $$('[data-act=sel-var]').forEach(b => b.classList.toggle('on', b.dataset.v === sl.vid));
  $$('[data-act=sel-unit]').forEach(b => b.classList.toggle('on', b.dataset.v === (sl.un || baseName(p))));
  const u = uOf(p, sl.un), need = hasVar(p) && !sl.vid, st = need ? 0 : stockOf(p, sl.vid), mx = Math.max(0, Math.floor(st / u.q)), pr = priceFor(p, sl.vid, sl.un);
  $('#sprice').textContent = need ? 'Mulai ' + rp(unit(p)) : rp(pr);
  $('#sper').textContent = need ? 'Pilih varian terlebih dahulu' : (u.q > 1 ? `1 ${u.n} = ${u.q} ${baseName(p)} · ` : '') + `${rp(Math.round(pr / u.q))} per ${baseName(p)}`;
  const se = $('#sstock'); se.className = 'pill ' + (need ? 'wait' : st <= 0 ? 'no' : st <= LOW ? 'wait' : 'ok');
  se.textContent = need ? 'Pilih varian untuk melihat stok' : st <= 0 ? 'Habis' : `Stok: ${st} ${baseName(p)}` + (u.q > 1 ? ` (≈ ${mx} ${u.n})` : '');
  $('.stepper').dataset.max = mx; $('#sq').textContent = mx ? 1 : 0;
  const ad = $('[data-act=sq-add]'); ad.disabled = need || mx < 1;
  $('#sqt').textContent = need ? 'Pilih varian' : mx < 1 ? 'Stok tidak cukup' : `Tambah • ${rp(pr)}`;
  const v = vOf(p, sl.vid); if (v && v.image) $('#simg').innerHTML = imgHTML(Object.assign({}, p, { image: v.image }), true) + (p.discount ? `<span class="badge disc">-${p.discount}%</span>` : '');
}
function productForm(id) {
  const p = id ? product(id) : { name: '', category: 'Makanan', size: '', price: '', stock: '', desc: '', discount: 0, image: '', emoji: '🛒', color: '#E9F5EC' };
  const sh = openSheet(`<h3>${id ? 'Edit Produk' : 'Tambah Produk'}</h3><form id="pform" data-id="${id || ''}" novalidate>
    <div class="imgprev"><div class="pimgwrap" id="pprev">${imgHTML(p)}</div><div class="hint">Isi URL gambar atau unggah foto. Bila kosong/gagal dimuat, ikon emoji dipakai sebagai gambar cadangan.</div></div>
    <div class="fl"><label>URL gambar (opsional)</label><input class="in" name="image" value="${esc(String(p.image || '').startsWith('data:') ? '' : p.image || '')}" placeholder="https://…"></div>
    <div class="fl"><label>Atau unggah gambar</label><input class="in" type="file" name="file" accept="image/*" style="padding:9px"></div>
    <div class="fl"><label>Emoji cadangan</label><input class="in" name="emoji" value="${esc(p.emoji)}" maxlength="4"></div>
    <div class="fl"><label>Nama produk</label><input class="in" name="name" value="${esc(p.name)}"></div>
    <div class="fl"><label>Kategori</label><select class="in" name="category"><option ${p.category === 'Makanan' ? 'selected' : ''}>Makanan</option><option ${p.category === 'Minuman' ? 'selected' : ''}>Minuman</option></select></div>
    <div class="fl"><label>Ukuran / isi (mis. 85 g, 600 ml)</label><input class="in" name="size" value="${esc(p.size)}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="fl"><label>Harga (Rp)</label><input class="in" name="price" inputmode="numeric" value="${esc(p.price)}"></div><div class="fl"><label>Stok</label><input class="in" name="stock" inputmode="numeric" value="${esc(p.stock)}"></div></div>
    <div class="fl"><label>Satuan dasar (mis. bungkus, botol, pcs)</label><input class="in" name="baseUnit" value="${esc(p.baseUnit || '')}" placeholder="pcs"></div>
    <div class="fl"><label>Satuan grosir lain — satu baris per satuan: Nama | isi (jumlah satuan dasar) | harga (kosongkan = otomatis)</label><textarea class="in" name="units" rows="3" placeholder="Renteng | 10 | 25000&#10;Karton | 40">${esc((p.units || []).map(u => [u.n, u.q, u.pr || ''].join(' | ').replace(/ \| $/, '')).join('\n'))}</textarea></div>
    <div class="fl"><label>Varian (rasa/ukuran/warna) — satu baris per varian: Nama | Kode | Harga | Stok | URL gambar (opsional). Bila diisi, Harga &amp; Stok di atas diabaikan.</label><textarea class="in" name="variants" rows="4" placeholder="Ayam Bawang | IM-AB | 3200 | 120&#10;Soto | IM-ST | 3300 | 80">${esc((p.variants || []).map(x => [x.name, x.code, x.price, x.stock, x.image].join(' | ').replace(/( \| )+$/, '')).join('\n'))}</textarea></div>
    <div class="fl"><label>Diskon % (0–90)</label><input class="in" name="discount" inputmode="numeric" value="${esc(p.discount || 0)}"></div>
    <div class="fl"><label>Deskripsi</label><textarea class="in" name="desc" rows="3">${esc(p.desc)}</textarea></div>
    <div class="err" id="perr"></div>
    <div class="stack" style="margin-top:8px"><button class="btn pri" type="submit">Simpan Produk</button><button class="btn gray" type="button" data-act="close-sheet">Batal</button></div></form>`);
  const form = $('#pform', sh); let uploaded = null;
  form.elements.file.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    if (!/^image\//.test(f.type)) return $('#perr').textContent = 'File harus berupa gambar.';
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const max = 480, k = Math.min(1, max / Math.max(im.width, im.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        uploaded = cv.toDataURL('image/jpeg', .82);
        $('#pprev', sh).innerHTML = imgHTML({ name: 'preview', emoji: form.elements.emoji.value, color: p.color, image: uploaded });
      };
      im.onerror = () => $('#perr').textContent = 'Gambar tidak dapat dibaca.';
      im.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = n => form.elements[n].value.trim();
    const err = m => { $('#perr').textContent = m; toast(m, true); };
    if (v('name').length < 2) return err('Nama produk wajib diisi.');
    if (!v('size')) return err('Ukuran / isi wajib diisi.');
    const hv = !!v('variants');
    if (!hv && (!/^\d+$/.test(v('price')) || Number(v('price')) < 1)) return err('Harga harus angka bulat lebih dari 0 (tidak boleh negatif).');
    if (!hv && Number(v('price')) > 100000000) return err('Harga terlalu besar.');
    if (!hv && (!/^\d+$/.test(v('stock')) || Number(v('stock')) > 1000000)) return err('Stok harus angka bulat 0 atau lebih (tidak boleh negatif).');
    if (!/^\d+$/.test(v('discount')) || Number(v('discount')) > 90) return err('Diskon harus angka 0–90.');
    if (v('image') && !/^(https?:\/\/|data:image\/|\.?\/?[\w\-./]+\.(png|jpe?g|webp|gif|svg))/i.test(v('image'))) return err('URL gambar tidak valid.');
    const rows = n => v(n).split('\n').map(x => x.trim()).filter(Boolean), base = (v('baseUnit') || 'pcs'), seen = new Set([base.toLowerCase()]), units = [], vars = [];
    for (const ln of rows('units')) {
      const [n, q, pr] = ln.split('|').map(x => x.trim());
      if (!n || !/^\d+$/.test(q || '') || Number(q) < 2 || (pr && !/^\d+$/.test(pr))) return err(`Satuan "${ln}" salah. Format: Nama | isi (angka ≥ 2) | harga (opsional)`);
      if (seen.has(n.toLowerCase())) return err('Nama satuan ganda: ' + n);
      seen.add(n.toLowerCase()); units.push({ n, q: Number(q), pr: Number(pr) || 0 });
    }
    const oldV = (id && product(id).variants) || [];
    for (const ln of rows('variants')) {
      const [n, code, pr, st, img] = ln.split('|').map(x => x.trim());
      if (!n || !/^\d+$/.test(pr || '') || Number(pr) < 1 || !/^\d+$/.test(st || '')) return err(`Varian "${ln}" salah. Format: Nama | Kode | Harga | Stok | URL gambar (opsional)`);
      if (vars.some(x => x.name.toLowerCase() === n.toLowerCase())) return err('Nama varian ganda: ' + n);
      const o = oldV.find(x => x.name === n);
      vars.push({ id: o ? o.id : 'v' + Date.now().toString(36) + vars.length, name: n, code: code || '', price: Number(pr), stock: Number(st), image: img || '' });
    }
    const data = {
      baseUnit: base === 'pcs' ? '' : base, units, variants: vars,
      name: v('name'), category: v('category'), size: v('size'), price: Number(v('price')), stock: Number(v('stock')),
      discount: Number(v('discount')), desc: v('desc') || 'Belum ada deskripsi.', emoji: v('emoji') || '🛒',
      image: uploaded || v('image')
    };
    if (vars.length) { data.price = Math.min(...vars.map(x => x.price)); data.stock = vars.reduce((a, x) => a + x.stock, 0); }
    if (id) Object.assign(product(id), data);
    else S.products.push(Object.assign({ id: 'p' + Date.now().toString(36), color: data.category === 'Makanan' ? '#FFF1D6' : '#DDF1FF', sold: 0 }, data));
    sanitizeCart(true);
    save(); closeSheet(); toast(id ? 'Produk diperbarui ✓' : 'Produk ditambahkan ✓'); refresh();
  });
}

/* ---------- Layar kunci ---------- */
function renderLock() {
  const s = S.settings;
  lockEl.innerHTML = `<div class="lk-logo">${logo(64)}</div><div class="lk-name">${esc(s.storeName)}</div>
    <div class="lk-date" data-date></div><div class="lk-clock" data-clock></div>
    <div class="lk-msg" id="lkmsg">${LKMSG}</div>
    <div class="dots" id="dots">${'<i></i>'.repeat(6)}</div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}" aria-label="${n}">${n}</button>`).join('')}
      <button class="fn" data-k="clear" aria-label="Koreksi (hapus semua)">Koreksi</button><button data-k="0" aria-label="0">0</button><button class="fn" data-k="del" aria-label="Hapus satu angka">${ic('backspace')}</button></div>
    <button class="btn pri lk-enter" id="lkenter">Masuk</button>
    ${!ADMIN && s.userPin === DEFAULT_USER_PIN ? `<div class="lk-demo">PIN demo: ${DEFAULT_USER_PIN} (dapat diubah di menu Profil)</div>` : '<div class="lk-demo">&nbsp;</div>'}`;
  ui.pin = ''; updateDots(); tick();
}
function updateDots() { $$('#dots i').forEach((d, i) => d.classList.toggle('f', i < ui.pin.length)); }
function pinKey(k) {
  if (!ui.locked || ui.busy) return;
  const m = $('#lkmsg'); m.className = 'lk-msg';
  if (k === 'del') ui.pin = ui.pin.slice(0, -1);
  else if (k === 'clear') ui.pin = '';
  else if (/^\d$/.test(k) && ui.pin.length < 6) ui.pin += k;
  updateDots();
  if (m.textContent !== LKMSG) m.textContent = LKMSG;
}
async function tryUnlock() {
  if (!ui.locked || ui.busy) return;
  const dots = $('#dots'), m = $('#lkmsg');
  if (ui.pin.length < 4) { m.textContent = 'PIN minimal 4 digit'; m.className = 'lk-msg bad'; dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); return; }
  if (ui.pin === (ADMIN ? S.settings.adminPin : S.settings.userPin)) {
    ui.busy = true; dots.classList.add('ok'); m.textContent = 'PIN benar ✓';
    if (navigator.vibrate) navigator.vibrate(20);
    await wait(450); loader(true, 'Membuka SARAYAMART…'); await wait(550); loader(false);
    ui.busy = false; ui.locked = false; sess.set(SKEY, '1');
    lockEl.classList.add('gone'); setTimeout(() => lockEl.hidden = true, 420); setTimeout(checkRatingPrompt, 900);
  } else {
    m.textContent = 'PIN salah, coba lagi'; m.className = 'lk-msg bad';
    dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
    if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
    ui.pin = ''; setTimeout(updateDots, 450);
  }
}
function lockApp() {
  closeSheet(); ui.locked = true; ui.adminOK = false; ui.stack = []; ui.tab = HOME;
  sess.del(SKEY); renderLock(); lockEl.hidden = false; void lockEl.offsetWidth; lockEl.classList.remove('gone'); render(null);
}

/* ---------- PIN admin ---------- */
function adminGate() {
  const sh = openSheet(`<h3>Akses Admin</h3><p class="hint">Masukkan PIN admin (terpisah dari PIN pengguna).</p>
    <form id="agate" novalidate><div class="fl"><input class="in" name="pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN admin" autocomplete="off" style="text-align:center;letter-spacing:8px;font-size:22px"><div class="err" id="aerr"></div></div>
    <div class="stack"><button class="btn pri" type="submit">Masuk Admin</button><button class="btn gray" type="button" data-act="close-sheet">Batal</button></div></form>`);
  const f = $('#agate', sh); setTimeout(() => f.elements.pin.focus(), 350);
  f.addEventListener('submit', e => {
    e.preventDefault();
    if (f.elements.pin.value === S.settings.adminPin) { ui.adminOK = true; ui.adminTab = 'products'; closeSheet(); go('admin'); }
    else { $('#aerr').textContent = 'PIN admin salah.'; f.elements.pin.value = ''; }
  });
}

/* ---------- Profil: ubah nama / PIN ---------- */
function nameSheet() {
  const sh = openSheet(`<h3>Data Pelanggan</h3><form id="nform" novalidate>
    <div class="fl"><label>Nama</label><input class="in" name="n" value="${esc(PR.name)}" placeholder="Nama Anda" maxlength="30"></div>
    <div class="fl"><label>Nomor HP</label><input class="in" name="p" type="tel" inputmode="tel" value="${esc(PR.phone)}" placeholder="0812xxxxxxxx" maxlength="16" autocomplete="tel"></div>
    <div class="fl"><label>Alamat</label><textarea class="in" name="a" rows="3" maxlength="200" placeholder="Jalan, nomor rumah, RT/RW, patokan">${esc(PR.address)}</textarea></div>
    <div class="err" id="nerr"></div>
    <div class="stack"><button class="btn pri" type="submit">Simpan</button><button class="btn gray" type="button" data-act="close-sheet">Batal</button></div></form>`);
  $('#nform', sh).addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target.elements, v = f.n.value.trim(), ph = f.p.value.trim(), ad = f.a.value.trim();
    const err = m => { $('#nerr').textContent = m; };
    if (v && !/^[A-Za-zÀ-ÿ'.\- ]{2,30}$/.test(v)) return err('Nama: gunakan huruf saja (2–30 karakter).');
    if (ph && !/^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(ph.replace(/[\s\-().]/g, ''))) return err('Nomor HP tidak valid. Contoh: 081234567890.');
    if (ad && ad.length < 10) return err('Alamat minimal 10 karakter.');
    PR.name = v; PR.phone = ph; PR.address = ad;
    ui.co.name = ui.co.name || v; ui.co.phone = ui.co.phone || ph; ui.co.address = ui.co.address || ad;
    savePR(); closeSheet(); toast('Data tersimpan ✓'); refresh();
  });
}
/* ---------- Penilaian & komentar (setelah pesanan sampai) ---------- */
const STAR_LBL = ['Ketuk bintang untuk menilai', 'Sangat buruk', 'Kurang', 'Cukup', 'Bagus', 'Sangat bagus'];
function starPaint() {
  $$('#stars button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) <= ui.rate.stars));
  const l = $('#starlbl'); if (l) l.textContent = STAR_LBL[ui.rate.stars] || STAR_LBL[0];
}
function rateSheet(id) {
  const o = order(id); if (!o || o.status !== 'Selesai') return;
  const cur = o.rating || { stars: 0, comment: '' };
  ui.rate = { id, stars: cur.stars || 0 };
  openSheet(`<h3>Beri penilaian</h3><div class="hint">Pesanan ${esc(o.no)} sudah sampai. Bagaimana pengalaman Anda?</div>
    <div class="stars" id="stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="rate-star" data-v="${n}" aria-label="${n} bintang">★</button>`).join('')}</div>
    <div class="hint" id="starlbl" style="text-align:center;min-height:18px;margin-bottom:10px"></div>
    <div class="fl"><label>Komentar (opsional)</label><textarea class="in" id="rcom" rows="3" maxlength="300" placeholder="Ceritakan pengalaman belanja Anda…">${esc(cur.comment || '')}</textarea></div>
    <div class="err" id="rerr"></div>
    <div class="stack" style="margin-top:8px"><button class="btn pri" data-act="rate-save">Kirim Penilaian</button><button class="btn gray" data-act="close-sheet">Nanti saja</button></div>`);
  starPaint();
}
function rateSave() {
  const r = ui.rate; if (!r) return;
  if (!r.stars) { $('#rerr').textContent = 'Pilih jumlah bintang dulu.'; return; }
  S = load(); const o = order(r.id);
  if (!o || o.status !== 'Selesai') { closeSheet(); return toast('Pesanan tidak ditemukan.', true); }
  o.rating = { stars: r.stars, comment: ($('#rcom').value || '').trim().slice(0, 300), ts: Date.now() };
  syncReview(o);
  save(); closeSheet(); toast('Terima kasih atas penilaian Anda ⭐'); refresh();
}
function photoSheet() {
  const sh = openSheet(`<h3>Foto Profil</h3><div class="pcenter"><div class="avatar">${PR.photo ? `<img src="${PR.photo}" alt="">` : esc((PR.name || 'P').charAt(0).toUpperCase())}</div></div>
    <label class="btn pri" style="cursor:pointer">${PR.photo ? 'Ganti foto' : 'Unggah foto'}<input type="file" accept="image/*" hidden id="pfile"></label>
    ${PR.photo ? '<button class="btn danger" style="margin-top:10px" data-act="photo-del">Hapus foto</button>' : ''}
    <button class="btn gray" style="margin-top:10px" data-act="close-sheet">Tutup</button>`);
  $('#pfile', sh).addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    if (!/^image\//.test(f.type)) return toast('File harus berupa gambar.', true);
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 256 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
        cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        PR.photo = cv.toDataURL('image/jpeg', .85); savePR(); closeSheet(); toast('Foto tersimpan ✓'); refresh();
      };
      im.onerror = () => toast('Gambar tidak dapat dibaca.', true);
      im.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
}
function pinSheet() {
  const sh = openSheet(`<h3>Ubah PIN Aplikasi</h3><form id="pinform" novalidate>
    <div class="fl"><label>PIN lama</label><input class="in" name="o" type="password" inputmode="numeric" maxlength="6"></div>
    <div class="fl"><label>PIN baru (4–6 digit)</label><input class="in" name="n" type="password" inputmode="numeric" maxlength="6"></div>
    <div class="fl"><label>Ulangi PIN baru</label><input class="in" name="c" type="password" inputmode="numeric" maxlength="6"></div>
    <div class="err" id="perr2"></div><div class="stack" style="margin-top:8px"><button class="btn pri" type="submit">Simpan PIN</button><button class="btn gray" type="button" data-act="close-sheet">Batal</button></div></form>`);
  $('#pinform', sh).addEventListener('submit', e => {
    e.preventDefault(); const f = e.target.elements, err = m => $('#perr2').textContent = m;
    if (f.o.value !== S.settings.userPin) return err('PIN lama salah.');
    if (!/^\d{4,6}$/.test(f.n.value)) return err('PIN baru harus 4–6 digit angka.');
    if (f.n.value !== f.c.value) return err('Konfirmasi PIN tidak sama.');
    S.settings.userPin = f.n.value; save(); closeSheet(); toast('PIN berhasil diubah ✓'); renderLock();
  });
}
function a2hsSheet() {
  openSheet(`<h3>Pasang di Layar Utama</h3>
    <div class="group"><div class="kv"><span>1</span><span>Buka aplikasi ini di <b>Safari</b> (iPhone) melalui alamat http(s)</span></div><div class="kv"><span>2</span><span>Ketuk ikon <b>Bagikan</b> (kotak dengan panah)</span></div><div class="kv"><span>3</span><span>Pilih <b>Tambah ke Layar Utama</b></span></div><div class="kv"><span>4</span><span>Ketuk <b>Tambah</b>, SARAYAMART tampil seperti aplikasi</span></div></div>
    <div class="note" style="margin-top:12px">${ic('info')}<div>Ini adalah <b>aplikasi web (PWA)</b>, bukan aplikasi native iOS dari App Store. Mode offline/instal penuh memerlukan akses lewat HTTPS atau localhost.</div></div>
    <button class="btn gray" data-act="close-sheet" style="margin-top:8px">Tutup</button>`);
}

/* =====================================================================
   CHAT (localStorage: hanya antar tab/jendela di browser & perangkat yang sama)
   ===================================================================== */
const chatLoad = () => { try { const c = JSON.parse(store.get(CHKEY)); return c && c.threads ? c : { threads: {} }; } catch (e) { return { threads: {} }; } };
const chatSave = c => store.set(CHKEY, JSON.stringify(c));
const MY = ADMIN ? 'a' : 'c';
const visMsg = m => !(m.h && m.h[MY]);
function unreadChat() {
  const th = chatLoad().threads;
  return ADMIN ? Object.values(th).reduce((a, t) => a + (t.ua || 0), 0) : ((th[PR.cid] || {}).uc || 0);
}
function chatSend(cid, text) {
  const c = chatLoad(), t = c.threads[cid] || (c.threads[cid] = { id: cid, name: PR.name || 'Pelanggan', msgs: [], ua: 0, uc: 0 });
  if (!ADMIN) t.name = PR.name || 'Pelanggan';
  t.msgs.push({ id: 'm' + Date.now() + Math.random().toString(36).slice(2, 5), from: ADMIN ? 'a' : 'c', text, ts: Date.now() });
  if (ADMIN) t.uc = (t.uc || 0) + 1; else t.ua = (t.ua || 0) + 1;
  t.msgs = t.msgs.slice(-200); chatSave(c);
}
function chatRead(cid) {
  const c = chatLoad(), t = c.threads[cid]; if (!t) return;
  const other = ADMIN ? 'c' : 'a', k = ADMIN ? 'ua' : 'uc'; let ch = false;
  t.msgs.forEach(m => { if (m.from === other && m.r !== 1) { m.r = 1; ch = true; } });
  if (t[k]) { t[k] = 0; ch = true; }
  if (ch) chatSave(c);
}
function bubbles(t) {
  const ms = t ? t.msgs.filter(visMsg) : [];
  if (!ms.length) return '<div class="hint" style="text-align:center;padding:24px 8px">Belum ada pesan. Tulis pesan pertama.</div>';
  return ms.map(m => {
    const mine = (m.from === 'a') === ADMIN, d = new Date(m.ts);
    const body = m.del ? `<div>🚫 ${mine ? 'Anda membatalkan pesan ini' : 'Pesan ini dibatalkan'}</div>` : `<div>${esc(m.text)}</div>`;
    return `<div class="bub ${mine ? 'me' : ''} ${m.del ? 'del' : ''}" data-act="msg-menu" data-cid="${esc(t.id)}" data-id="${esc(m.id)}">${body}<small>${mine ? '' : (m.from === 'a' ? 'Admin' : esc(t.name)) + ' · '}${dateShort(d)} ${timeHM(d)}</small></div>`;
  }).join('');
}
VIEWS.chat = ({ cid }) => {
  chatRead(cid);
  const t = chatLoad().threads[cid];
  const clr = `<button data-act="chat-clear" data-cid="${esc(cid)}" aria-label="Bersihkan chat" style="color:var(--red);width:40px;height:40px;display:grid;place-items:center">${ic('trash')}</button>`;
  return `<div class="page">${navBar(ADMIN ? esc(t ? t.name : 'Chat') + (ADMIN ? ' <small style="font-weight:500;color:var(--mut)">#' + esc(cid.slice(-5)) + '</small>' : '') : 'Chat dengan Admin', { right: clr })}
    <div class="hint" style="padding:0 16px 6px;text-align:center">Chat demo: tersambung antar tab/jendela di browser &amp; perangkat yang sama. Ketuk pesan untuk batal kirim atau hapus.</div>
    <div class="msgs" id="msgs">${bubbles(t)}</div>
    <form class="cform" id="cform" data-cid="${esc(cid)}"><input class="in" name="t" maxlength="500" placeholder="Tulis pesan…" autocomplete="off"><button class="btn pri" type="submit" style="width:auto;min-width:72px">Kirim</button></form></div>`;
};
function updateChat() {
  const ms = $('#msgs'); if (!ms) return;
  const cid = curr().params.cid; chatRead(cid);
  ms.innerHTML = bubbles(chatLoad().threads[cid]); ms.scrollTop = ms.scrollHeight;
}
function adminChat(q) {
  const vis = t => t.msgs.filter(visMsg);
  q = String(q || '').trim().toLowerCase();
  const last = t => { const v = vis(t); return v.length ? v[v.length - 1].ts : 0; };
  const th = Object.values(chatLoad().threads).filter(t => vis(t).length).sort((a, b) => last(b) - last(a));
  if (!th.length) return emptyHTML('💬', 'Belum ada percakapan', 'Pesan dari pelanggan akan muncul di sini.');
  const th2 = q ? th.filter(t => (t.name || '').toLowerCase().includes(q) || vis(t).some(m => !m.del && String(m.text).toLowerCase().includes(q))) : th;
  if (!th2.length) return emptyHTML('🔍', 'Percakapan tidak ditemukan', 'Coba nama pelanggan atau kata dalam pesan.');
  return th2.map(t => { const v = vis(t), l = v[v.length - 1] || {}, txt = l.del ? '🚫 Pesan dibatalkan' : (l.text || '');
    return `<button class="arow" style="width:100%;text-align:left" data-act="chat-open" data-id="${esc(t.id)}"><span class="avatar" style="width:44px;height:44px;font-size:18px;margin:0;flex:none">${esc((t.name || 'P').charAt(0).toUpperCase())}</span><div class="at"><b>${esc(t.name)} <small style="font-weight:500;color:var(--mut)">#${esc(t.id.slice(-5))}</small>${t.ua ? ` <span class="pill no">${t.ua} baru</span>` : ''}</b><small>${l.from === 'a' ? 'Anda: ' : ''}${esc(txt)} · ${l.ts ? dateShort(new Date(l.ts)) + ' ' + timeHM(new Date(l.ts)) : ''}</small></div></button>`; }).join('');
}
/* batal kirim (hilang untuk semua) & hapus untuk saya */
function msgMenu(cid, mid) {
  const m = ((chatLoad().threads[cid] || {}).msgs || []).find(x => x.id === mid); if (!m) return;
  const mine = (m.from === 'a') === ADMIN;
  openSheet(`<h3>Pesan</h3><div class="card" style="margin-bottom:14px;word-break:break-word">${m.del ? '<i>Pesan dibatalkan</i>' : esc(m.text)}</div>
    <div class="stack">${mine && !m.del ? `<button class="btn danger" data-act="msg-unsend" data-cid="${esc(cid)}" data-id="${esc(mid)}">${ic('x')} Batal kirim (hilang untuk semua)</button>` : ''}
    <button class="btn sec2" data-act="msg-hide" data-cid="${esc(cid)}" data-id="${esc(mid)}">${ic('trash')} Hapus untuk saya</button>
    <button class="btn gray" data-act="close-sheet">Tutup</button></div>`);
}
function msgChange(cid, mid, fn) {
  const c = chatLoad(), t = c.threads[cid], m = t && t.msgs.find(x => x.id === mid);
  if (!m) return false;
  fn(m, t); chatSave(c); return true;
}
function msgUnsend(cid, mid) {
  const ok = msgChange(cid, mid, (m, t) => {
    if ((m.from === 'a') !== ADMIN || m.del) return;
    if (m.r !== 1) { const k = ADMIN ? 'uc' : 'ua'; t[k] = Math.max(0, (t[k] || 0) - 1); }
    m.del = true; m.text = '';
  });
  closeSheet(); if (ok) toast('Pesan dibatalkan ✓'); updateChat();
}
function msgHide(cid, mid) {
  msgChange(cid, mid, m => { m.h = m.h || {}; m.h[MY] = 1; });
  closeSheet(); toast('Pesan dihapus dari tampilan Anda.'); updateChat();
}
async function chatClear(cid) {
  if (!await ask({ title: 'Bersihkan chat?', msg: 'Semua pesan dihapus dari tampilan Anda. Pesan di sisi lawan bicara tetap ada.', ok: 'Bersihkan', danger: true })) return;
  const c = chatLoad(), t = c.threads[cid];
  if (t) { t.msgs.forEach(m => { m.h = m.h || {}; m.h[MY] = 1; }); t[ADMIN ? 'ua' : 'uc'] = 0; chatSave(c); }
  toast('Chat dibersihkan ✓'); if (ADMIN) { ui.stack = []; render('pop'); } else updateChat();
}

/* =====================================================================
   EVENT
   ===================================================================== */
let copyFallback = t => { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); };
appEl.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id, v = el.dataset.v;
  if (!ADMIN && /^(admin|mark-paid|reset)/.test(act)) return;   // pelanggan tidak punya akses pengelolaan
  switch (act) {
    case 'tab': setTab(el.dataset.tab); break;
    case 'back': back(); break;
    case 'home': setTab(HOME); break;
    case 'close-sheet': closeSheet(); break;
    case 'cat': ui.cat = el.dataset.c; ui.q = ''; setTab('products'); break;
    case 'banner': ui.cat = el.dataset.b; ui.q = ''; setTab('products'); break;
    case 'chip': ui.cat = el.dataset.c; $$('.chip', view).forEach(c => c.classList.toggle('on', c.dataset.c === ui.cat)); updateList(); break;
    case 'open-product': productSheet(id); break;
    case 'add': e.stopPropagation(); addToCart(id); break;
    case 'inc': { const c = S.cart.find(x => lk(x) === id), p = c && product(c.id); if (c && p && Math.floor((stockOf(p, c.vid) - usedBase(p, c.vid)) / uOf(p, c.u).q) >= 1) { c.qty++; save(); refresh(); } else toast('Jumlah mencapai batas stok.', true); break; }
    case 'dec': { const c = S.cart.find(x => lk(x) === id); if (c && c.qty > 1) { c.qty--; save(); refresh(); } break; }
    case 'remove': {
      const p = product(id.split('|')[0]);
      if (await ask({ title: 'Hapus dari keranjang?', msg: esc(p ? p.name : 'Barang') + ' akan dihapus dari keranjang.', ok: 'Hapus', danger: true })) { S.cart = S.cart.filter(x => lk(x) !== id); save(); toast('Barang dihapus dari keranjang.'); refresh(); }
      break;
    }
    case 'sq-inc': case 'sq-dec': {
      const st = el.closest('.stepper'), max = Number(st.dataset.max), sq = $('#sq'); let n = Number(sq.textContent);
      n = act === 'sq-inc' ? Math.min(max, n + 1) : Math.max(1, n - 1);
      if (act === 'sq-inc' && n === Number(sq.textContent)) toast(`Stok hanya ${max}.`, true);
      sq.textContent = n; const pid = $('[data-act=sq-add]').dataset.id; $('#sqt').textContent = `Tambah • ${rp(priceFor(product(pid), ui.sel.vid, ui.sel.un) * n)}`; break;
    }
    case 'sq-add': { const n = Number($('#sq').textContent); if (n > 0 && addToCart(id, n, false, ui.sel.vid, ui.sel.un)) closeSheet(); break; }
    case 'sel-var': ui.sel.vid = v; sheetUpdate(); break;
    case 'sel-unit': ui.sel.un = v; sheetUpdate(); break;
    case 'checkout': {
      sanitizeCart(false);
      if (!S.cart.length) return toast('Keranjang masih kosong.', true);
      const bad = stockProblems(); if (bad.length) return toast(bad[0], true);
      ui.co.errors = {}; go('checkout'); break;
    }
    case 'set-method': ui.co.method = v; ui.co.errors = {}; refresh(); break;
    case 'set-pay': ui.co.pay = v; ui.co.errors = {}; refresh(); break;
    case 'set-bank': ui.co.bank = v; refresh(); break;
    case 'set-wallet': ui.co.wallet = v; refresh(); break;
    case 'cash-quick': {
      const t = totals().total; ui.co.received = String(v === 'exact' ? t : v); ui.co.errors = {}; refresh(); break;
    }
    case 'copy': try { await navigator.clipboard.writeText(v); } catch (er) { copyFallback(v); } toast('Nomor disalin ✓'); break;
    case 'confirm-order': confirmOrder(); break;
    case 'do-order': createOrder(); break;
    case 'pay-later': { const o2 = order(id); if (o2 && o2.payStatus !== 'Lunas') toast('Status: menunggu konfirmasi admin'); replaceTop('receipt', { id }); break; }
    case 'open-pay': go('pay', { id }); break;
    case 'view-tx': go('txdetail', { id }); break;
    case 'view-receipt': go('receipt', { id }); break;
    case 'cancel-order': cancelOrder(id); break;
    case 'print': printOrder(id); break;
    case 'pdf': toast('Pada dialog cetak, pilih “Simpan sebagai PDF”.'); setTimeout(() => printOrder(id), 700); break;
    case 'change-name': nameSheet(); break;
    case 'change-pin': pinSheet(); break;
    case 'a2hs': a2hsSheet(); break;
    case 'lock': lockApp(); break;
    case 'logout': if (await ask({ title: 'Keluar akun?', msg: 'Anda akan kembali ke layar PIN. Data belanja tetap tersimpan.', ok: 'Keluar', danger: true })) lockApp(); break;
    case 'export-data': exportData(); break;
    case 'reset':
      if (await ask({ title: 'Reset data demo?', msg: 'Produk, stok, keranjang, riwayat, dan pengaturan akan dikembalikan ke data awal (isi data.js bila ada). PIN kembali menjadi bawaan.', ok: 'Reset', danger: true })) {
        S = defaults(); ui.co = freshCO(); save(); toast('Data demo dikembalikan ✓'); renderLock(); setTab(HOME);
      }
      break;
    case 'set-carrier': ui.co.carrier = v; ui.co.errors = {}; refresh(); break;
    case 'apply-voucher': {
      const code = (ui.co.voucher || '').trim().toUpperCase(), vv = voucherOf(code), t = totals(); ui.co.vApplied = '';
      if (!code) toast('Voucher dilepas.');
      else if (!vv) toast('Kode voucher tidak ditemukan.', true);
      else if (t.subtotal < vv.min) toast(`Minimal belanja ${rp(vv.min)} untuk voucher ini.`, true);
      else if (vv.quota && vv.used >= vv.quota) toast('Kuota voucher sudah habis.', true);
      else { ui.co.vApplied = code; toast(`Voucher dipakai: potongan ongkir hingga ${rp(vv.amt)} ✓`); }
      refresh(); break;
    }
    case 'photo': photoSheet(); break;
    case 'photo-del': PR.photo = ''; savePR(); closeSheet(); toast('Foto dihapus.'); refresh(); break;
    case 'chat': go('chat', { cid: PR.cid }); break;
    case 'chat-open': go('chat', { cid: id }); break;
    case 'test-sound': audioWarned = false; toast('🔔 Tes bunyi notifikasi'); beep('order'); break;
    case 'msg-menu': msgMenu(el.dataset.cid, id); break;
    case 'msg-unsend': msgUnsend(el.dataset.cid, id); break;
    case 'msg-hide': msgHide(el.dataset.cid, id); break;
    case 'chat-clear': chatClear(el.dataset.cid); break;
    case 'rate-open': rateSheet(id); break;
    case 'rate-star': ui.rate.stars = Number(v); starPaint(); break;
    case 'rate-save': rateSave(); break;
    case 'admin-stat': statSheet(v); break;
    case 'admin-period': ui.sp = v; store.set('sarayamart_period', v); statSheet('sales'); refresh(); break;
    case 'admin-stat-order': closeSheet(); go('txdetail', { id }); break;
    case 'admin-stat-product': closeSheet(); productForm(id); break;
    case 'admin-del-order': case 'cust-del-order':
      if (await deleteOrders([id])) {
        if (['txdetail', 'receipt'].includes(curr().name)) { ui.stack = ui.stack.filter(r => !(r.params && r.params.id === id)); render('pop'); } else refresh();
      }
      break;
    case 'admin-clear-done': case 'cust-clear-done': {
      S = load();
      const ids = S.orders.filter(o => isFinal(o) && (ADMIN ? !o.hideA : (!o.hideC && (!o.cid || o.cid === PR.cid)))).map(o => o.id);
      if (!ids.length) return toast('Belum ada transaksi selesai/dibatalkan.');
      if (await deleteOrders(ids)) refresh();
      break;
    }
    case 'mark-paid': { if (!await ask({ title: 'Konfirmasi pembayaran?', msg: 'Pastikan uang sudah benar-benar masuk di mutasi rekening / e-wallet Anda.', ok: 'Sudah masuk', cancel: 'Belum' })) break; S = load(); const o = order(id); if (o && o.status !== 'Dibatalkan' && o.payStatus !== 'Lunas') { o.payStatus = 'Lunas'; if (o.ship && !o.ship.resi) { o.ship.resi = makeResi(o.ship.n); o.ship.booked = Date.now(); } save(); toast(o.ship ? `Lunas ✓ · Resi ${o.ship.resi} dibuat otomatis (simulasi ${o.ship.n})` : 'Ditandai lunas ✓'); } refresh(); break; }
    case 'admin-open': break;
    case 'admin-tab': ui.adminTab = v; ui.aq = ''; refresh(); break;
    case 'admin-ot': ui.ot = v; ui.aq = ''; refresh(); break;
    case 'admin-add': productForm(null); break;
    case 'admin-edit': productForm(id); break;
    case 'admin-del': {
      const p = product(id);
      if (await ask({ title: 'Hapus produk?', msg: `“${esc(p.name)} ${esc(p.size)}” akan dihapus permanen dari katalog.`, ok: 'Hapus', danger: true })) {
        S.products = S.products.filter(x => x.id !== id); S.cart = S.cart.filter(x => x.id !== id); save(); toast('Produk dihapus.'); refresh();
      }
      break;
    }
  }
});

/* input & form di dalam view */
function bindView() {
  const hq = $('#hq');
  if (hq) hq.addEventListener('input', () => { ui.q = hq.value; ui.cat = 'all'; setTab('products'); const pq = $('#pq'); if (pq) { pq.focus(); pq.setSelectionRange(pq.value.length, pq.value.length); } });
  const pq = $('#pq');
  if (pq) pq.addEventListener('input', () => { ui.q = pq.value; updateList(); });
  const ps = $('#psort');
  if (ps) ps.addEventListener('change', () => { ui.sort = ps.value; updateList(); });
  const bn = $('#banners');
  if (bn) bn.addEventListener('scroll', () => {
    const i = Math.round(bn.scrollLeft / (bn.scrollWidth / 3));
    $$('#bdots i').forEach((d, k) => d.classList.toggle('on', k === i));
  }, { passive: true });
  const ms = $('#msgs'); if (ms) ms.scrollTop = ms.scrollHeight;
  const aq = $('#aq');
  if (aq) aq.addEventListener('input', () => { ui.aq = aq.value; const l = $('#alist'); if (l) l.innerHTML = adminList(); });
  const cf = $('#cform');
  if (cf) cf.addEventListener('submit', e => { e.preventDefault(); const i = cf.elements.t, t = i.value.trim(); if (!t) return; chatSend(cf.dataset.cid, t); i.value = ''; updateChat(); i.focus(); });
  const sf = $('#setform');
  if (sf) sf.addEventListener('submit', e => { e.preventDefault(); saveSettings(sf); });
}
view.addEventListener('input', e => {
  const b = e.target.dataset && e.target.dataset.bind; if (!b || !ui.co) return;
  let val = e.target.value;
  if (b === 'received') { val = val.replace(/\D/g, '').slice(0, 10); if (e.target.value !== val) e.target.value = val; }
  ui.co[b] = val;
  if (ui.co.errors) delete ui.co.errors[b];
  const fl = e.target.closest('.fl'); if (fl) { fl.classList.remove('bad'); const er = $('.err', fl); if (er) er.remove(); }
  if (b === 'received') { const cb = $('#changeBox'); if (cb) { const recv = Number(val) || 0, t = totals().total; cb.textContent = cashText(t); cb.className = 'change ' + (recv && recv >= t ? 'ok' : recv ? 'no' : ''); } }
});
view.addEventListener('change', async e => {
  if (!ADMIN && e.target.dataset && e.target.dataset.proof) {
    const f = e.target.files[0], oid = e.target.dataset.proof; if (!f) return;
    if (!/^image\//.test(f.type)) return toast('Bukti harus berupa gambar.', true);
    const rd = new FileReader();
    rd.onload = () => { const im = new Image(); im.onload = () => {
      const k = Math.min(1, 800 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
      cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      S = load(); const o = order(oid);
      if (o && o.payStatus !== 'Lunas' && o.status !== 'Dibatalkan') { o.proof = cv.toDataURL('image/jpeg', .7); o.proofAt = Date.now(); save(); toast('Bukti terkirim. Menunggu konfirmasi admin.'); }
      refresh();
    }; im.onerror = () => toast('Gambar tidak dapat dibaca.', true); im.src = rd.result; };
    rd.readAsDataURL(f); return;
  }
  if (ADMIN && e.target.dataset && e.target.dataset.ostat) {
    const id = e.target.dataset.ostat, st = e.target.value;
    { const o0 = order(id); if ((st === 'Dikirim' || st === 'Selesai') && o0 && o0.payStatus !== 'Lunas') { toast('Konfirmasi pembayaran dulu (tombol Konfirmasi Pembayaran) sebelum dikirim atau diselesaikan.', true); return refresh(); } }
    if (st === 'Dibatalkan' && !await ask({ title: 'Batalkan pesanan?', msg: 'Stok barang pesanan ini akan dikembalikan satu kali. Status Dibatalkan bersifat final.', ok: 'Batalkan', cancel: 'Tidak', danger: true })) return refresh();
    if (applyStatus(id, st)) toast('Status diperbarui ✓'); else toast('Status tidak dapat diubah.', true);
    return refresh();
  }
  if (ADMIN && e.target.dataset && e.target.dataset.resi) {
    S = load(); const o = order(e.target.dataset.resi);
    if (o && o.ship) { o.ship.resi = e.target.value.trim().slice(0, 40); save(); toast('No. resi disimpan ✓'); }
    return;
  }
  const b = e.target.dataset && e.target.dataset.bind;
  if (b === 'courier') { ui.co.courier = e.target.value; refresh(); return; }
  if (b === 'area') { ui.co.area = e.target.value; refresh(); return; const fl = e.target.closest('.fl'); if (fl) { fl.classList.remove('bad'); const er = $('.err', fl); if (er) er.remove(); } }
});

/* keypad layar kunci */
lockEl.addEventListener('click', e => {
  const k = e.target.closest('[data-k]'); if (k) return pinKey(k.dataset.k);
  if (e.target.closest('#lkenter')) tryUnlock();
});
document.addEventListener('keydown', e => {
  const h = $('#hs'); if (h && !h.classList.contains('gone')) return;
  if (ui.locked && !lockEl.hidden) {
    if (/^\d$/.test(e.key)) pinKey(e.key);
    else if (e.key === 'Backspace') pinKey('del');
    else if (e.key === 'Escape') pinKey('clear');
    else if (e.key === 'Enter') tryUnlock();
  } else if (e.key === 'Escape') closeSheet();
});

/* skala bingkai perangkat di layar besar */
function fit() {
  const s = Math.min(1, (innerHeight - 20) / 876, (innerWidth - 20) / 417);
  document.documentElement.style.setProperty('--s', s.toFixed(3));
}
addEventListener('resize', fit); fit();

/* ---------- deteksi pesanan & pesan baru (untuk bunyi notifikasi) ---------- */
let seenOrd = {}, knownMsgs = new Set();
const snapOrders = () => { seenOrd = {}; S.orders.forEach(o => { seenOrd[o.id] = o.status; }); };
const allMsgs = () => { const out = []; Object.values(chatLoad().threads).forEach(t => { if (ADMIN || t.id === PR.cid) t.msgs.forEach(m => out.push(m)); }); return out; };
const snapMsgs = () => { knownMsgs = new Set(allMsgs().map(m => m.id)); };
function incomingCheck() {                 // true bila ada pesan chat baru dari lawan bicara
  const other = ADMIN ? 'c' : 'a';
  const fresh = allMsgs().filter(m => !knownMsgs.has(m.id) && m.from === other && !m.del && visMsg(m));
  snapMsgs();
  if (fresh.length) beep('chat');
  return fresh.length > 0;
}
function orderAlerts() {
  const fresh = [], done = [];
  S.orders.forEach(o => {
    if (ADMIN) { if (!(o.id in seenOrd)) fresh.push(o); }
    else if (o.cid === PR.cid && o.status === 'Selesai' && seenOrd[o.id] !== 'Selesai') done.push(o);
  });
  snapOrders();
  if (fresh.length) { beep('order'); toast('Pesanan baru masuk 🛒 ' + fresh[0].no + (fresh.length > 1 ? ' (+' + (fresh.length - 1) + ')' : '')); }
  if (done.length) {
    beep('done'); toast('Pesanan Anda telah sampai 📦 Beri penilaian ya');
    const o = done.sort((a, b) => b.ts - a.ts)[0];
    if (!o.rating && !o.ratePrompted) { markPrompted(o.id); setTimeout(() => rateSheet(o.id), 700); }
  }
}
/* form penilaian otomatis hanya muncul SEKALI per pesanan (penanda disimpan di data pesanan, bukan di memori).
   Setelahnya pelanggan menilai lewat tombol "Beri Penilaian" di Riwayat. */
function markPrompted(id) {
  S = load(); const o = order(id);
  if (o && !o.ratePrompted) { o.ratePrompted = true; save(); snapOrders(); }
}
function checkRatingPrompt() {             // tawarkan penilaian untuk pesanan selesai yang belum dinilai & belum pernah ditawari (7 hari terakhir)
  if (ADMIN) return;
  S = load();
  const o = S.orders.filter(x => x.cid === PR.cid && !x.hideC && x.status === 'Selesai' && !x.rating && !x.ratePrompted && Date.now() - x.ts < 7 * 864e5).sort((a, b) => b.ts - a.ts)[0];
  if (!o) return;
  markPrompted(o.id); beep('done'); rateSheet(o.id);
}

/* sinkron antar tab browser */
addEventListener('storage', e => {
  if (e.key === CHKEY) {
    const got = incomingCheck();
    if (curr().name === 'chat') return updateChat();
    if (got) toast(ADMIN ? 'Pesan baru dari pelanggan 💬' : 'Balasan baru dari admin 💬');
    renderTabbar();
    if ((ADMIN && curr().name === 'admin' && ui.adminTab === 'chat') || (!ADMIN && curr().name === 'home')) refresh();
    return;
  }
  if (e.key === KEY || e.key === CKEY) {
    const a = document.activeElement; S = load(); if (e.key === KEY) orderAlerts(); sanitizeCart(true);
    if (!ui.busy && !(view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) refresh();
  }
});

/* PWA */
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------- mulai ---------- */
sanitizeCart(true);
snapOrders(); snapMsgs();
renderLock();
if (sess.get(SKEY) === '1') { ui.locked = false; lockEl.hidden = true; }
render(null);
if (!ui.locked) soundBanner();
if (!ADMIN && !ui.locked) setTimeout(checkRatingPrompt, 900);
setInterval(() => { if (!ADMIN && ['txdetail', 'receipt'].includes(curr().name)) { const o = order(curr().params.id); if (o && o.ship && o.status === 'Dikirim') refresh(); } }, 15000);
const hs = $('#hs');
if (hs) {
  $('.sb-icons', hs).innerHTML = $('#statusbar .sb-icons').innerHTML;
  $('.hs-ic', hs).innerHTML = logo(64);
  $('#hs-open').addEventListener('click', () => hs.classList.add('gone'));
  $('#homebar').addEventListener('click', () => { hs.classList.remove('gone'); tick(); });
  tick();
}
window.__SM = { get S() { return S; }, ui };
})();
