#!/usr/bin/env node
/*
 * Preis-Schnappschuss: klickt auf jeder Produktseite jede Kombination der
 * Auswahl-Knöpfe durch und hält Stückpreis, Gesamtpreis, Hinweise und den
 * Warenkorb-/Anfragetext fest.
 *
 *   node tools/qa/price-snapshot.js            vergleicht mit price-snapshot.json
 *   node tools/qa/price-snapshot.js --update   schreibt price-snapshot.json neu
 *   node tools/qa/price-snapshot.js --only=burgerbox,servietten
 *   node tools/qa/price-snapshot.js --prices  vergleicht nur Preise (für Umbauten,
 *                                             bei denen sich Texte ändern dürfen)
 *
 * Braucht Playwright mit Chromium. Startet einen eigenen kleinen Webserver.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const SNAPSHOT = path.join(__dirname, 'price-snapshot.json');
const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const PRICES_ONLY = args.includes('--prices');
const ONLY = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(ROOT, p);
      if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// Auswahlgruppen des Konfigurators in Seitenreihenfolge: Knopfreihen,
// Material-Chips und Typ-Knöpfe, jeweils nur mit echten Knöpfen.
const GROUPS = '.config-panel .opt-btns, .config-panel .mat-chips, .config-panel .typ-btns';
function groupSizes() {
  window.__pfGroups = () => [...document.querySelectorAll(window.__pfSel)].filter(g => g.querySelector('button'));
  return window.__pfGroups().map(g => g.querySelectorAll('button').length);
}

// Liest den sichtbaren Zustand des Konfigurators.
function readState() {
  const t = id => { const e = document.getElementById(id); return e ? e.textContent.trim() : null; };
  const panel = document.querySelector('.config-panel');
  const hints = [...panel.querySelectorAll('.dim-hint, .stueck-hint, .blatt-hint, .pf-hint')]
    .map(e => e.textContent.trim()).filter(Boolean);
  const item = window.PF_ITEM || null;
  const decode = (id, key) => {
    const a = document.getElementById(id);
    if (!a) return null;
    const m = a.href.match(new RegExp('[?&]' + key + '=([^&]*)'));
    return m ? decodeURIComponent(m[1]) : a.href;
  };
  return {
    total: t('price-display'),
    per: t('price-per'),
    badge: [t('badge-size'), t('badge-dim') || t('badge-mat') || t('badge-lid')].filter(Boolean).join(' · '),
    hints,
    cart: item ? { title: item.title, desc: item.desc, priceTotal: item.priceTotal } : null,
    whatsapp: decode('wa-link', 'text'),
    email: decode('email-link', 'body'),
  };
}

async function snapshotPage(page, base, slug) {
  await page.goto(`${base}/produkte/${slug}/`, { waitUntil: 'load' });
  const sizes = await page.evaluate(groupSizes);
  const groupCount = sizes.length;
  const out = {};
  const idx = new Array(groupCount).fill(0);
  const total = sizes.reduce((a, b) => a * b, 1);
  for (let n = 0; n < total; n++) {
    let r = n;
    for (let g = groupCount - 1; g >= 0; g--) { idx[g] = r % sizes[g]; r = Math.floor(r / sizes[g]); }
    for (let g = 0; g < groupCount; g++) {
      await page.evaluate(([g, i]) => window.__pfGroups()[g].querySelectorAll('button')[i].click(), [g, idx[g]]);
    }
    const labels = await page.evaluate(() => window.__pfGroups().map(g => {
      const a = g.querySelector('button.active') || g.querySelector('button[aria-pressed="true"]');
      return a ? a.textContent.replace(/\s+/g, ' ').trim() : '?';
    }));
    out[labels.join(' | ')] = { auswahl: [...idx], ...(await page.evaluate(readState)) };
  }
  return out;
}

// "EUR 1.584,00" oder "1.584,00 €" -> Cent; "Preis auf Anfrage" -> null
function cents(text) {
  if (/auf Anfrage/.test(text)) return null;
  const m = /([\d.]+),(\d\d)/.exec(text);
  return m ? Number(m[1].replace(/\./g, '')) * 100 + Number(m[2]) : NaN;
}
// Stückpreis in € mit Nachkommastellen: "0,0943 € / Stück", "9,43 ct pro Stück", "7,00 € pro kg"
function unitEuro(text) {
  const m = /(\d+),(\d+) (€|EUR|ct)/.exec(text || '');
  if (!m) return null;
  const decimals = m[2].length + (m[3] === 'ct' ? 2 : 0);
  return { value: Number(m[1] + m[2]), decimals };
}
function comparePrices(a, b) {
  if (!a || !b) return 'Kombination fehlt ' + (a ? 'jetzt' : 'vorher');
  const ca = cents(a.total), cb = cents(b.total);
  if (ca !== cb) return 'Gesamtpreis';
  if (ca === null) return null;
  const ua = unitEuro(a.per), ub = unitEuro(b.per);
  if (!ua || !ub) return 'Stückpreis nicht lesbar';
  // neuen Wert auf die Stellen des alten runden (kaufmännisch)
  const shift = ub.decimals - ua.decimals;
  const rounded = shift >= 0 ? Math.floor((ub.value * 2 + 10 ** shift) / (2 * 10 ** shift)) : ub.value * 10 ** -shift;
  if (rounded !== ua.value) return 'Stückpreis';
  if (!b.cart || cents(b.cart.priceTotal) !== cb) return 'Warenkorb-Betrag';
  if (!b.whatsapp || !b.whatsapp.includes(b.total)) return 'WhatsApp-Text ohne Gesamtpreis';
  return null;
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const slugs = fs.readdirSync(path.join(ROOT, 'produkte'))
    .filter(s => fs.existsSync(path.join(ROOT, 'produkte', s, 'index.html')))
    .filter(s => !ONLY.length || ONLY.includes(s)).sort();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(sel => { window.__pfSel = sel; }, GROUPS);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const current = {};
  for (const slug of slugs) current[slug] = await snapshotPage(page, base, slug);
  await browser.close(); srv.close();
  if (errors.length) { console.error('JavaScript-Fehler:\n' + errors.join('\n')); process.exitCode = 1; }

  const combos = Object.values(current).reduce((a, o) => a + Object.keys(o).length, 0);
  if (UPDATE) {
    let saved = {};
    if (ONLY.length && fs.existsSync(SNAPSHOT)) saved = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
    Object.assign(saved, current);
    const sorted = Object.fromEntries(Object.keys(saved).sort().map(k => [k, saved[k]]));
    fs.writeFileSync(SNAPSHOT, JSON.stringify(sorted, null, 1) + '\n');
    console.log(`${slugs.length} Seiten, ${combos} Kombinationen gespeichert.`);
    return;
  }
  const saved = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const diffs = [];
  for (const slug of slugs) {
    const a = saved[slug] || {}, b = current[slug];
    if (PRICES_ONLY) {
      const byIdx = o => Object.fromEntries(Object.values(o).map(v => [v.auswahl.join(','), v]));
      const A = byIdx(a), B = byIdx(b);
      for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
        const problem = comparePrices(A[k], B[k]);
        if (problem) diffs.push({ slug, auswahl: k, problem, vorher: A[k] && [A[k].total, A[k].per], jetzt: B[k] && [B[k].total, B[k].per] });
      }
      continue;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffs.push({ slug, combo: k, vorher: a[k], jetzt: b[k] });
    }
  }
  if (diffs.length) {
    console.error(`${diffs.length} Abweichungen:`);
    for (const d of diffs.slice(0, 20)) console.error(JSON.stringify(d, null, 1));
    process.exitCode = 1;
  } else {
    console.log(`OK: ${slugs.length} Seiten, ${combos} Kombinationen ${PRICES_ONLY ? 'mit unveränderten Preisen' : 'unverändert'}.`);
  }
})();
