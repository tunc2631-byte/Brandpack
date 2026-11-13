#!/usr/bin/env node
/*
 * Erzeugt alle Seiten der Website:
 *   produkte/<slug>/index.html  aus data/products.json (Auswahl, Preise, Hinweise,
 *                               passende Produkte) und content/produkte/<slug>.html (Texte)
 *   index.html, ueber-uns/, designservice/, impressum/, datenschutz/
 *                               aus content/seiten/<name>.html und data/site.json
 *
 *   node tools/build_site.js           Seiten schreiben
 *   node tools/build_site.js --check   nur prüfen, ob die Seiten aktuell sind
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const PF = require('../assets/pf-pricing.js');
const V = require('../assets/pf-view.js');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/products.json'), 'utf8'));
const bySlug = Object.fromEntries(products.map(p => [p.slug, p]));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const small = img => img.replace('-960.webp', '-480.webp');
const WA_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
const CART_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
const CHECK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/site.json'), 'utf8'));
const year = 2026;
const ORIGIN = 'https://pack-factory.de';

// Vorschaubild für WhatsApp, Facebook usw.: /Bilder/og/<name>-1200.jpg (1200 × 630, weißer Grund),
// erzeugt von tools/build_images.py aus demselben Original wie /Bilder/web/<name>-960.webp
const ogImage = img => ORIGIN + img.replace(/^\/Bilder\/web\/([a-z0-9-]+)-960\.webp$/, '/Bilder/og/$1-1200.jpg');
const DEFAULT_OG = ogImage(products.find(p => p.slug === 'tueten').image);

// "ab 12,00 ct" → "ab 12 ct" (für Titel)
const shortPrice = p => V.fromPrice(p).replace(',00 ', ' ');

// Texte aus den Inhaltsdateien (mit HTML-Zeichen wie &uuml;) als reiner Text für JSON-LD
const ENT = { amp: '&', quot: '"', lt: '<', gt: '>', nbsp: ' ', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', ndash: '–', mdash: '—', times: '×', shy: '', eacute: 'é', sup2: '²', sup3: '³', euro: '€', bdquo: '„', ldquo: '“', rdquo: '”', middot: '·' };
const plain = s => String(s).replace(/<[^>]*>/g, '').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&(\w+);/g, (m, k) => {
  if (!(k in ENT)) throw new Error('Unbekanntes HTML-Zeichen ' + m);
  return ENT[k];
}).replace(/\s+/g, ' ').trim();

// Produktdaten für Google: "ab"-Preis netto aus data/products.json, gültig ab der Menge, für die er gilt.
// Keine Bewertungen und keine Verfügbarkeit, solange es dafür keine echten Angaben gibt.
function productLd(p, c) {
  const q = PF.lowest(p).quote;
  const price = Number((q.unitFraction[0] / q.unitFraction[1]).toFixed(4));
  const unitCode = q.per === 'kg' ? 'KGM' : 'H87';
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: plain(c.name).replace(/( mit Logo.*)?$/, ' mit Logo'),
    description: plain(c.description),
    image: [ORIGIN + p.image],
    url: ORIGIN + p.url,
    category: p.catalog.title,
    offers: {
      '@type': 'Offer',
      url: ORIGIN + p.url,
      priceCurrency: 'EUR',
      price,
      priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: 'EUR', valueAddedTaxIncluded: false,
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode } },
      eligibleQuantity: { '@type': 'QuantitativeValue', minValue: q.qty, unitCode },
      seller: { '@id': ORIGIN + '/#organization' },
    },
  }, null, 2);
}

// Kopf der Seite mit Navigation
function top(o) {
  return `<!DOCTYPE html>
<html lang="${o.lang || 'de'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${o.title}</title>
  <link rel="canonical" href="${ORIGIN}${o.path}">
  <meta name="description" content="${o.description}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="PackFactory">
  <meta property="og:locale" content="${o.lang === 'tr' ? 'tr_TR' : 'de_DE'}">${altLinks(o.path)}
  <meta property="og:url" content="${ORIGIN}${o.path}">
  <meta property="og:title" content="${o.title.replace(/ \| PackFactory$/, '')}">
  <meta property="og:description" content="${o.description}">
  <meta property="og:image" content="${o.image || DEFAULT_OG}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" type="image/png" sizes="96x96" href="/Bilder/favicon-96.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/Bilder/favicon-192.png">
  <link rel="apple-touch-icon" href="/Bilder/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${asset('/assets/pf.css')}">${[o.jsonld].concat(o.extraLd || []).filter(Boolean).map(ld => `
  <script type="application/ld+json">
${ld}
  </script>`).join('')}
</head>
<body class="pf-page">
<!-- Erzeugt von tools/build_site.js aus ${o.source}. Nicht von Hand ändern. -->

<div class="nav-wrapper" id="navWrapper">
  <nav aria-label="Hauptnavigation">
    <div class="nav-inner">
      <a href="/" class="nav-home"><img src="/Bilder/packfactory-logo.webp" alt="PackFactory" class="nav-logo" width="900" height="637"></a>
      <div class="nav-links">
        <a href="/">Home</a>
        <a href="/#produkte">Produkte</a>
        <a href="/designservice/">Designservice</a>
        <a href="/muster/">Muster</a>
        <a href="/ratgeber/">Ratgeber</a>
        <a href="/ueber-uns/">&Uuml;ber uns</a>
        <a href="/#kontakt">Kontakt</a>
      </div>
      <div class="nav-right">
        <a href="/#produkte" class="pf-btn pf-btn-primary pf-btn-sm nav-cta">Jetzt bestellen</a>
        <button class="hamburger" type="button" onclick="toggleMenu()" aria-label="Men&uuml;" aria-controls="mobileMenu" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
    </div>
  </nav>
</div>
<div class="mobile-menu" id="mobileMenu">
  <a href="/" onclick="closeMenu()">Home</a>
  <a href="/#produkte" onclick="closeMenu()">Produkte</a>
  <a href="/designservice/" onclick="closeMenu()">Designservice</a>
  <a href="/muster/" onclick="closeMenu()">Kostenlose Muster</a>
  <a href="/ratgeber/" onclick="closeMenu()">Ratgeber</a>
  <a href="/ueber-uns/" onclick="closeMenu()">&Uuml;ber uns</a>
  <a href="/#kontakt" onclick="closeMenu()">Kontakt</a>
  <p class="mm-title">Beliebt</p>
  <div class="mm-grid">
${site.bestseller.slice(0, 4).map(s => `    <a href="${esc(bySlug[s].url)}" onclick="closeMenu()"><img src="${esc(small(bySlug[s].image))}" alt="" width="480" height="480" loading="lazy" decoding="async">${esc(bySlug[s].catalog.title)}</a>`).join('\n')}
  </div>
  <a class="pf-btn pf-btn-primary mm-cta" href="/#kontakt" onclick="closeMenu()">Kostenlos anfragen</a>
</div>

`;
}

function footer() {
  const link = (href, text) => `<li><a href="${href}">${text}</a></li>`;
  return `<footer class="pf-footer">
  <div class="pf-wrap pf-foot-grid">
    <div class="pf-foot-brand">
      <img src="/Bilder/packfactory-logo.webp" alt="PackFactory" width="900" height="637" loading="lazy">
      <p>Individuelle Verpackungslösungen für Gastronomie und Foodservice.</p>
      <p><a href="https://wa.me/491776990017" target="_blank" rel="noopener">WhatsApp</a> · <a href="tel:+491776990017">0177 6990017</a> · <a href="mailto:info@pack-factory.de">info@pack-factory.de</a></p>
    </div>
    <nav aria-label="Produkte"><h2>Produkte</h2><ul>
      ${site.categories.filter(c => c.seite).map(c => link(c.seite, esc(c.label))).join('\n      ')}
      ${['salatschalen', 'einschlagpapier', 'servietten'].map(s => link(bySlug[s].url, esc(bySlug[s].catalog.title))).join('\n      ')}
      ${link('/doenerpapier-bedrucken/', 'Dönerpapier')}
      ${link('/burgerpapier-bedrucken/', 'Burgerpapier')}
      ${link('/baeckertueten-bedrucken/', 'Bäckertüten')}
      ${link('/asiaboxen-bedrucken/', 'Asiaboxen')}
      ${link('/#produkte', 'Alle Produkte')}
    </ul></nav>
    <nav aria-label="Branchen"><h2>Branchen</h2><ul>
      ${branchen.map(b => link(b.url, esc(b.label))).join('\n      ')}
    </ul></nav>
    <nav aria-label="Unternehmen"><h2>Unternehmen</h2><ul>
      ${link('/ueber-uns/', '&Uuml;ber uns')}
      ${link('/designservice/', 'Designservice')}
      ${link('/designservice/#druckdateien', 'Druckdateien')}
      ${link('/muster/', 'Kostenlose Muster')}
      ${link('/ratgeber/', 'Ratgeber')}
      ${link('/tr/', 'Türkçe')}
      ${link('/#kontakt', 'Kontakt')}
    </ul></nav>
    <nav aria-label="Rechtliches"><h2>Rechtliches</h2><ul>
      ${link('/impressum/', 'Impressum')}
      ${link('/datenschutz/', 'Datenschutz')}
    </ul></nav>
  </div>
  <p class="pf-wrap pf-foot-copy">&copy; ${year} PackFactory. Alle Rechte vorbehalten. Alle Preise netto zzgl. MwSt.</p>
</footer>`;
}

// CSS/JS mit Inhalts-Kennung (?v=…): nach jeder Änderung lädt der Browser die neue Datei,
// statt eine alte aus dem Zwischenspeicher mit der neuen Seite zu mischen.
function asset(url) {
  const body = url === '/assets/pf-katalog.js' ? katalog() : fs.readFileSync(path.join(ROOT, url), 'utf8');
  return url + '?v=' + crypto.createHash('sha1').update(body).digest('hex').slice(0, 8);
}
function scripts(list) {
  return ['/assets/pf-site.js'].concat(list, ['/assets/pf-katalog.js', '/cart.js']).map(s => `<script src="${asset(s)}"></script>`).join('\n') + '\n</body>\n</html>\n';
}

// Echte Kundendesigns: wischen, ziehen oder Farbpunkt wählen. Verhalten in assets/pf-site.js.
// Weißer Grund ohne Rahmen, damit das Produkt frei schwebt.
// Quelle: data/products.json → designs { wort, bilder: [{ file, name, color }] }.
function designsOf(p) {
  return p.designs ? { name: p.name, wort: p.designs.wort, bilder: p.designs.bilder, titel: p.designs.titel, artikel: p.designs.artikel } : null;
}
function designPick(set, kind, sizes) {
  const h = { name: set.name, designs: set.bilder };
  const img = (d, i) => `        <img class="pf-design${i ? '' : ' is-on'}" src="/Bilder/${kind}/${esc(d.file)}-960.webp" srcset="/Bilder/${kind}/${esc(d.file)}-480.webp 480w, /Bilder/${kind}/${esc(d.file)}-960.webp 960w" sizes="${sizes}" alt="${esc(h.name + ' im Design von ' + d.name)}" width="960" height="960" draggable="false"${i ? ' decoding="async"' : ' fetchpriority="high"'}>`;
  const swatch = (d, i) => `        <button type="button" class="pf-swatch${i ? '' : ' is-on'}" style="--c:${esc(d.color)}" data-name="${esc(d.name)}" aria-pressed="${i ? 'false' : 'true'}" aria-label="Design von ${esc(d.name)} zeigen"></button>`;
  return `      <div class="pf-design-pick" data-designs>
      <div class="pf-designs" tabindex="0" role="region" aria-roledescription="Bildergalerie" aria-label="Echte Kundendesigns, zum Wechseln wischen">
${h.designs.map(img).join('\n')}
      </div>
      <div class="pf-swatches" role="group" aria-label="Kundendesign wählen">
${h.designs.map(swatch).join('\n')}
      </div>
      <p class="pf-design-cap">${esc(set.titel || 'Beispiel aus unserer Produktion')}: <b data-design-name aria-live="polite">${esc(h.designs[0].name)}</b><span>${esc(set.artikel || 'Deine')} ${esc(set.wort)} bekommt dein Logo in deinen Farben.</span></p>
      </div>`;
}

function productCard(p, opts) {
  const o = opts || {};
  const badge = o.badge && p.badge ? `<i class="pf-badge${p.badge === 'Neu' ? ' pf-badge-new' : ''}">${esc(p.badge)}</i>` : '';
  const attrs = o.filter ? ` data-cat="${esc(p.catalog.tags.join(' '))}" data-branchen="${esc(p.branchen.join(' '))}"` : '';
  return `<a class="${o.cls || 'pf-card'}" href="${esc(p.url)}"${attrs}><span class="pf-card-img"><img src="${esc(small(p.image))}" srcset="${esc(small(p.image))} 480w, ${esc(p.image)} 960w" sizes="(max-width: 700px) 46vw, (min-width: 1600px) 360px, 280px" alt="${esc(p.catalog.title)}" loading="lazy" decoding="async" width="480" height="480"></span>${badge}<b>${esc(p.catalog.title)}</b><span class="pf-price">${esc(V.fromPrice(p))}</span></a>`;
}


function blocks() {
  // Kundenlogos aus data/site.json: einfarbig, optisch gleich groß (w/h in px)
  const logo = hidden => site.kunden.map(k => `      <img class="pf-logo" src="/Bilder/logos/${esc(k.file)}-440.webp" alt="${hidden ? '' : esc(k.alt)}" width="${k.w}" height="${k.h}" style="--w:${k.w}px;--h:${k.h}px" loading="lazy" decoding="async">`).join('\n');
  // Branchen-Leiste: ein Tipp filtert "Alle Produkte" nach Branche (Bild: branchen[].bild in data/site.json)
  const branche = b => {
    const n = products.filter(p => p.branchen.includes(b.id)).length;
    return `      <button type="button" class="pf-cat" data-branche="${esc(b.id)}" aria-pressed="false"><span class="pf-cat-img"><img src="${esc(small(bySlug[b.bild].image))}" alt="" width="480" height="480" loading="lazy" decoding="async"></span><b>${esc(b.label)}</b><span>${n} Produkte</span></button>`;
  };
  // Einstieg wie bei Apple: Reiter wählen ein Bestseller-Produkt, darunter echte Kundendesigns zum Wischen
  // (data/site.json → hero.produkte; Umschalten in assets/pf-home.js, ohne JavaScript bleibt das erste sichtbar)
  const h = site.hero;
  const tab = (x, i) => `        <button type="button" class="pf-shop-tab${i ? '' : ' is-on'}" role="tab" id="pf-tab-${esc(x.slug)}" aria-controls="pf-panel-${esc(x.slug)}" aria-selected="${i ? 'false' : 'true'}"${i ? ' tabindex="-1"' : ''}>${esc(x.name)}</button>`;
  const copy = (x, i) => {
    const hp = bySlug[x.slug];
    return `      <div class="pf-shop-panel" id="pf-panel-${esc(x.slug)}" role="tabpanel" aria-labelledby="pf-tab-${esc(x.slug)}" data-panel="${i}"${i ? ' hidden' : ''}>
        <p class="pf-shop-kicker">${esc(h.kicker)}</p>
        <h2 class="pf-shop-name">${esc(x.name)}</h2>
        <p class="pf-shop-tag">${esc(x.tagline)}</p>
        <p class="pf-shop-price"><b>${esc(V.fromPrice(hp))}</b> pro ${esc(hp.unit)}<span>Design kostenlos</span></p>
        <div class="pf-hero-cta">
          <a class="pf-btn pf-btn-primary" href="${esc(hp.url)}">Jetzt konfigurieren</a>
          <a class="pf-link" href="#produkte">Alle Produkte</a>
        </div>
      </div>`;
  };
  const stage = (x, i) => `      <div class="pf-shop-pick" data-panel="${i}"${i ? ' hidden' : ''}>
${designPick(designsOf(bySlug[x.slug]), 'web', '(max-width: 860px) 76vw, 480px')}
      </div>`;
  const hero = `<section class="pf-hero pf-shop-hero" aria-label="Bestseller">
  <div class="pf-wrap pf-shop-in">
    <div class="pf-shop-copy">
      <h1 class="pf-shop-claim">Verpackungen mit Logo für die Gastronomie<span>Deine Marke. Auf jeder Verpackung.</span></h1>
      <div class="pf-shop-tabs" role="tablist" aria-label="Bestseller wählen">
${h.produkte.map(tab).join('\n')}
      </div>
${h.produkte.map(copy).join('\n')}
    </div>
    <div class="pf-shop-stage">
${h.produkte.map(stage).join('\n')}
    </div>
  </div>
</section>`;
  return {
    hero,
    logos: logo(false) + '\n      <span class="pf-logo-loop" aria-hidden="true">\n' + logo(true) + '\n      </span>',
    bestseller: site.bestseller.map(s => '      ' + productCard(bySlug[s], { badge: true })).join('\n'),
    branchen: site.branchen.map(branche).join('\n'),
    filter: `      <button type="button" class="pf-chip active" data-cat="alle" aria-pressed="true">Alle</button>\n` +
      site.categories.map(c => `      <button type="button" class="pf-chip" data-cat="${esc(c.id)}" aria-pressed="false">${esc(c.label)}</button>`).join('\n'),
    catalog: '      <!-- catalog:start -->\n' + products.map(p => '      ' + productCard(p, { cls: 'pf-card pf-pcard', badge: true, filter: true })).join('\n') + '\n      <!-- catalog:end -->',
    produktoptionen: products.map(p => `        <option>${esc(p.catalog.title)}</option>`).join('\n'),
    ratgeber: ratgeber.slice(0, 3).map(a => `      <a class="pf-tile" href="${esc(a.url)}"><b>${a.h1}</b><span>${a.lead}</span></a>`).join('\n'),
  };
}

function readPage(name) {
  const raw = fs.readFileSync(path.join(ROOT, 'content/seiten', name + '.html'), 'utf8');
  const parts = {};
  raw.split(/<!-- part:(\w+) -->\n/).slice(1).reduce((key, val, i) => {
    if (i % 2 === 0) return val;
    parts[key] = val.replace(/\n$/, '');
    return null;
  }, null);
  return parts;
}

function sitePage(name) {
  const c = readPage(name);
  const b = blocks();
  let main = c.main.replace(/\{\{WA\}\}/g, WA_ICON).replace(/<!--pf:(\w+)-->/g, (m, k) => {
    if (!(k in b)) throw new Error('Unbekannter Platzhalter ' + m + ' in ' + name);
    return b[k];
  });
  return top({ title: c.title, description: c.description, path: c.path, jsonld: c.jsonld, source: 'content/seiten/' + name + '.html' }) +
    `<main class="pf-site-main">\n${main}\n</main>\n\n${footer()}\n\n${scripts(c.scripts ? c.scripts.split(/\s+/) : [])}`;
}

function readContent(slug) {
  const raw = fs.readFileSync(path.join(ROOT, 'content/produkte', slug + '.html'), 'utf8');
  const parts = {};
  raw.split(/<!-- part:(\w+) -->\n/).slice(1).reduce((key, val, i) => {
    if (i % 2 === 0) return val;
    parts[key] = val.replace(/\n$/, '');
    return null;
  }, null);
  return parts;
}

// Gruppen, die den Preis beeinflussen (ohne Mengen-Gruppe), in Seitenreihenfolge
function priceGroups(p) {
  const keys = new Set([].concat(p.pricing.by, ...(p.pricing.modifiers || []).map(m => [].concat(m.by)), p.pricing.qty.by ? [].concat(p.pricing.qty.by) : []));
  return p.options.filter(g => keys.has(g.key) && g.key !== p.qtyKey);
}

function priceTable(p) {
  const rowsGroups = priceGroups(p);
  const qtyGroup = p.qtyKey ? V.group(p, p.qtyKey) : null;
  const cols = qtyGroup ? qtyGroup.choices : [null];
  let rows = [{}];
  rowsGroups.forEach(g => {
    rows = rows.flatMap(r => g.choices.filter(c => !c.onRequest).map(c => Object.assign({}, r, { [g.key]: c.id })));
  });
  const base = PF.defaults(p);
  const qtyDependsOnRow = p.pricing.qty.table != null;
  const head = rowsGroups.map(g => `<th scope="col">${esc(g.label)}</th>`).join('') +
    cols.map(c => `<th scope="col">${c ? esc(qtyDependsOnRow ? c.label : V.qtyText(PF.quote(p, Object.assign({}, base, { [p.qtyKey]: c.id })).qty, p.unit)) : 'Preis'}</th>`).join('');
  const body = rows.map(r => {
    const label = rowsGroups.map(g => {
      const c = V.choice(p, g.key, r[g.key]);
      return `<th scope="row">${esc(c.label)}${c.detail ? `<small>${esc(c.detail)}</small>` : ''}</th>`;
    }).join('');
    const cells = cols.map(c => {
      const sel = Object.assign({}, base, r, c ? { [p.qtyKey]: c.id } : {});
      const q = PF.quote(p, sel);
      const qty = qtyDependsOnRow ? `<small>${esc(V.qtyText(q.qty, p.unit))}</small>` : '';
      return `<td>${qty}<b>${esc(V.unitShort(q))}</b><small>${esc(V.euros(q.totalCents))}</small></td>`;
    }).join('');
    return `<tr>${label}${cells}</tr>`;
  }).join('\n');
  return `<div class="pf-table-wrap"><table class="pf-table pf-price-table"><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table></div>
<p class="pf-small">Stückpreis${p.unit === 'kg' ? ' pro kg' : ''} und Gesamtpreis, netto zzgl. MwSt., inkl. individuellem Druck &amp; Design.</p>`;
}

// Mengenrechner: wie lange reicht welche Menge? Ergebnis rechnet assets/pf-product.js (Daten: products.json → rechner)
function calculator(p) {
  const r = p.rechner;
  return `
      <details class="pf-calc" id="pf-calc" hidden>
        <summary><span class="pf-calc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2h5M12 2v3"/></svg></span><span><b>Wie lange reicht das?</b><small>Mengenrechner</small></span></summary>
        <div class="pf-calc-body">
          <label class="pf-calc-q" for="pf-perday">${esc(r.frage)}</label>
          <div class="pf-calc-in">
            <input type="range" id="pf-perday" min="10" max="1000" step="10" value="${r.start}" aria-describedby="pf-calc-note">
            <input type="number" id="pf-perday-n" min="1" max="20000" inputmode="numeric" value="${r.start}" aria-label="Anzahl pro Tag">
          </div>
          <div class="pf-calc-days" role="group" aria-label="Verkaufstage pro Woche">
            <button type="button" class="pf-calc-day" data-days="6" aria-pressed="false">6 Tage pro Woche</button>
            <button type="button" class="pf-calc-day active" data-days="7" aria-pressed="true">7 Tage pro Woche</button>
          </div>
          <ul class="pf-calc-res" id="pf-calc-res" aria-live="polite"></ul>
          <p class="pf-calc-note" id="pf-calc-note">Ein Stück pro Verkauf. Tippe auf eine Menge, um sie auszuwählen.</p>
        </div>
      </details>`;
}

function optionGroups(p, sel, custom) {
  const hints = V.hints(p, sel, custom);
  return p.options.map(g => {
    const isQty = g.key === p.qtyKey;
    const buttons = g.choices.map(c => {
      const on = sel[g.key] === c.id;
      const attrs = `type="button" class="pf-opt${isQty ? ' pf-tier' : ''}${on ? ' active' : ''}" aria-pressed="${on}" data-key="${esc(g.key)}" data-id="${esc(c.id)}"`;
      if (isQty) {
        const t = V.tier(p, sel, c);
        return `<button ${attrs}>${c.tip ? '<i class="pf-tip">Unser Tipp</i>' : ''}<b data-qty>${esc(t.qty)}</b><span><span data-unit>${esc(t.line)}</span><em data-pct${t.pct ? '' : ' hidden'}>−${t.pct} %</em></span></button>`;
      }
      return `<button ${attrs}><b>${esc(c.label)}</b>${c.detail ? `<span>${esc(c.detail)}</span>` : ''}</button>`;
    }).join('\n        ');
    const customFields = g.choices.some(c => c.custom) ? `
      <div class="pf-custom" data-custom${V.isCustom(p, sel) ? '' : ' hidden'}>
        <label>Breite (mm)<input type="number" inputmode="numeric" min="50" max="1000" id="pf-width" placeholder="z. B. 500"></label>
        <label>Höhe (mm)<input type="number" inputmode="numeric" min="50" max="1000" id="pf-height" placeholder="z. B. 400"></label>
      </div>` : '';
    const groupHints = hints.filter(h => h.after === g.key).map(h => `<p class="pf-hint">${esc(h.text)}</p>`).join('');
    const label = isQty ? `${esc(g.label)}<span class="pf-aside">Je mehr, desto günstiger</span>` : esc(g.label);
    return `
    <div class="pf-group" data-group="${esc(g.key)}">
      <div class="pf-label" id="pf-l-${esc(g.key)}">${label}</div>
      <div class="opt-btns ${isQty ? 'pf-tiers' : 'pf-chips'}" role="group" aria-labelledby="pf-l-${esc(g.key)}">
        ${buttons}
      </div>${customFields}
      <div class="pf-hints" data-hints="${esc(g.key)}" aria-live="polite">${groupHints}</div>${g.note ? `
      <p class="pf-note">${esc(g.note)}</p>` : ''}${isQty && p.rechner ? calculator(p) : ''}
    </div>`;
  }).join('');
}

// "Passend für": Links zu den Branchenseiten des Produkts (data/products.json → branchen)
function branchLinks(p) {
  const bs = branchen.filter(b => p.branchen.includes(b.id));
  if (!bs.length) return '';
  return `<nav class="pf-branch-links" aria-label="Passende Branchen"><span>Passend für</span>${bs.map(b => `<a class="pf-chip" href="${esc(b.url)}">${esc(b.label)}</a>`).join('')}</nav>`;
}

// Brotkrumen: Kategorie mit eigener Seite (data/site.json → categories[].seite), sonst "Produkte"
function crumbCat(p) {
  const c = site.categories.find(c => c.seite && p.catalog.tags.includes(c.id));
  return c ? `<a href="${esc(c.seite)}">${esc(c.label)}</a>` : '<a href="/#produkte">Produkte</a>';
}

function page(p) {
  const c = readContent(p.slug);
  const sel = PF.defaults(p);
  const s = V.summary(p, sel);
  const msg = V.message(p, sel, null);
  const waHref = 'https://wa.me/491776990017?text=' + encodeURIComponent(msg);
  const mailHref = 'mailto:info@pack-factory.de?subject=' + encodeURIComponent('Anfrage ' + p.catalog.title) + '&body=' + encodeURIComponent(V.emailBody(p, sel, null));
  const related = p.related.map(r => productCard(bySlug[r])).join('\n      ');
  const mini = products.map(o => ({ slug: o.slug, url: o.url, title: o.catalog.title, img: small(o.image), from: V.fromPrice(o) }));
  const data = JSON.stringify({ product: p, catalog: mini }).replace(/</g, '\\u003c');
  const details = [
    `<details class="pf-acc"><summary>Preise im Überblick</summary><div class="pf-acc-body">${priceTable(p)}</div></details>`,
    c.tech || c.technotes ? `<details class="pf-acc"><summary>Technische Daten</summary><div class="pf-acc-body">${c.tech}${c.technotes ? `<div class="pf-small">${c.technotes}</div>` : ''}</div></details>` : '',
    c.faq ? `<details class="pf-acc"><summary>Häufige Fragen</summary><div class="pf-acc-body">${c.faq}</div></details>` : '',
    c.guide ? `<details class="pf-acc"><summary>Auswahlhilfe</summary><div class="pf-acc-body pf-prose">${c.guide}</div></details>` : '',
  ].filter(Boolean).join('\n      ');

  const title = c.title.replace('{{ab}}', esc(shortPrice(p)));
  return `${top({ title, description: c.description, path: p.url, jsonld: c.jsonld, extraLd: [productLd(p, c), faqLd(c.faq)], image: ogImage(p.image), source: 'data/products.json und content/produkte/' + p.slug + '.html' })}
<main>
<section class="pf-buy" aria-label="Produkt konfigurieren">
  <div class="pf-gallery">
    <div class="pf-shot">
${designsOf(p) ? designPick(designsOf(p), 'web', '(max-width: 980px) 90vw, 560px') : `      <img id="product-img" src="${esc(p.image)}" srcset="${esc(small(p.image))} 480w, ${esc(p.image)} 960w" sizes="(max-width: 980px) 90vw, 560px" alt="${esc(p.name)} mit Logo bedruckt" width="960" height="960" fetchpriority="high">`}
    </div>
  </div>

  <div class="pf-panel config-panel">
    <nav class="pf-crumbs" aria-label="Brotkrumen"><a href="/">PackFactory</a><span aria-hidden="true">›</span>${crumbCat(p)}<span aria-hidden="true">›</span><span>${esc(p.catalog.title)}</span></nav>
    <h1 class="pf-title">${/logo/i.test(c.name) ? c.name : c.name + ' mit Logo'}</h1>
    ${c.subtitle ? `<p class="pf-sub">${c.subtitle}</p>` : ''}
    <p class="pf-from">${esc(V.fromPrice(p))}${p.unit === 'kg' ? '' : ' pro Stück'} · mit deinem Logo</p>
${(p.notes || []).map(n => `    <p class="pf-note pf-note-top">${esc(n)}</p>`).join('\n')}${optionGroups(p, sel, null)}

    <div class="pf-sum" aria-live="polite">
      <span class="pf-total" id="price-display">${esc(s.total)}</span>
      <span class="pf-per" id="price-per">${esc(s.per)}</span>
      <span class="pf-saved" id="pf-saved">${esc(s.saved)}</span>
      <span class="pf-vat">Netto zzgl. MwSt. · inkl. individuellem Druck &amp; Design</span>
    </div>

    <div class="pf-ctas" id="pf-ctas">
      <button type="button" class="pf-btn pf-btn-primary" id="pf-add" onclick="addCurrentToCart()">${CART_ICON}In den Warenkorb</button>
      <a id="wa-link" class="pf-btn pf-btn-wa" href="${esc(waHref)}" target="_blank" rel="noopener">${WA_ICON}Direkt per WhatsApp anfragen</a>
    </div>
    <p class="pf-contact-line"><a href="tel:+491776990017">Anrufen: 0177 6990017</a><span aria-hidden="true">·</span><a id="email-link" href="${esc(mailHref)}">E-Mail schreiben</a></p>

    <ul class="pf-assure">
${c.assure.split('\n').map(l => '      ' + l.replace('<li>', `<li>${CHECK_ICON}<span>`).replace('</li>', '</span></li>')).join('\n')}
    </ul>
  </div>
</section>

<section class="pf-section pf-related" aria-labelledby="pf-related-h">
  <div class="pf-wrap">
    <h2 class="pf-h2" id="pf-related-h">Passt zu ${esc(p.catalog.title)}. <span>Alles im selben Look bestellen.</span></h2>
    <div class="pf-rail">
      ${related}
    </div>
    ${branchLinks(p)}
  </div>
</section>
${c.service ? `
<section class="pf-section pf-service">
  <div class="pf-wrap">
    <h2 class="pf-h2">Wir kümmern uns um alles. <span>Von der Idee bis zur Lieferung.</span></h2>
    <div class="pf-bento">
      ${c.service}
    </div>
  </div>
</section>` : ''}${c.finish ? `
<section class="pf-section pf-finish">
  <div class="pf-wrap pf-prose">
    ${c.finish}
  </div>
</section>` : ''}

<section class="pf-section pf-details" aria-label="Details">
  <div class="pf-wrap pf-narrow">
      ${details}
  </div>
</section>

<section class="pf-section pf-story">
  <div class="pf-wrap pf-narrow pf-prose">
    ${c.seo}
  </div>
</section>

<section class="pf-section pf-recent" id="pf-recent" hidden aria-labelledby="pf-recent-h">
  <div class="pf-wrap">
    <h2 class="pf-h2" id="pf-recent-h">Zuletzt angesehen.</h2>
    <div class="pf-rail" id="pf-recent-list"></div>
  </div>
</section>

<section class="pf-cta-band">
  <div class="pf-wrap">
    <h2>Bereit für deine eigene Verpackung?</h2>
    <p>Frag jetzt an. Wir antworten innerhalb von 24 Stunden und gestalten deinen Entwurf kostenlos.</p>
    <div class="pf-cta-row">
      <a class="pf-btn pf-btn-wa" href="https://wa.me/491776990017?text=${encodeURIComponent('Hallo, ich möchte ' + p.catalog.title + ' anfragen.')}" target="_blank" rel="noopener">${WA_ICON}WhatsApp</a>
      <a class="pf-btn pf-btn-ghost" href="tel:+491776990017">Anrufen</a>
      <a class="pf-btn pf-btn-ghost" href="mailto:info@pack-factory.de">E-Mail</a>
    </div>
  </div>
</section>
</main>

${footer()}

<div class="pf-sticky" id="pf-sticky" aria-hidden="true">
  <div class="pf-sticky-in">
    <div class="pf-sticky-txt"><b id="pf-sticky-total">${esc(s.total)}</b><span id="pf-sticky-line">${esc(p.catalog.title)} · ${esc(V.parts(p, sel, null).slice(-1)[0] || '')}</span></div>
    <a class="pf-btn pf-btn-wa pf-btn-icon" id="pf-sticky-wa" href="${esc(waHref)}" target="_blank" rel="noopener" aria-label="Per WhatsApp anfragen" tabindex="-1">${WA_ICON}</a>
    <button type="button" class="pf-btn pf-btn-primary pf-btn-sm" onclick="addCurrentToCart()" tabindex="-1">In den Warenkorb</button>
  </div>
</div>

<script type="application/json" id="pf-data">${data}</script>
${scripts(['/assets/pf-pricing.js', '/assets/pf-view.js', '/assets/pf-product.js'])}`;
}

// Kleiner Katalog für den Warenkorb (Bilder, Vorschläge, Sets): erzeugt, nicht von Hand ändern.
// std = Standardauswahl eines Produkts, genau wie "In den Warenkorb" ohne Änderung auf der Produktseite.
function katalog() {
  const strip = m => m.replace(/^Hallo, ich interessiere mich für\s*/, '').replace(/\s*und möchte ein Angebot anfragen\.$/, '');
  const produkte = {};
  for (const p of products) {
    const sel = PF.defaults(p), s = V.summary(p, sel);
    produkte[p.slug] = { title: p.catalog.title, url: p.url, img: small(p.image), ab: V.fromPrice(p), related: p.related,
      std: { desc: strip(V.message(p, sel)), priceTotal: s.onRequest ? '' : s.total } };
  }
  const sets = branchen.map(b => ({ id: b.id, label: b.label, url: b.url, items: b.set }));
  return '/* Erzeugt von tools/build_site.js aus data/products.json und data/site.json. Nicht von Hand ändern. */\n' +
    'window.PF_KATALOG = ' + JSON.stringify({ produkte, sets }) + ';\n';
}

// Branchenseiten /branchen/<slug>/: Set und Produkte aus data/site.json und data/products.json,
// Texte aus content/branchen/<id>.html. Mindestmengen, Preise und Lieferzeiten kommen aus den Daten.
const readParts = file => {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const parts = {};
  raw.split(/<!-- part:(\w+) -->\n/).slice(1).reduce((key, val, i) => {
    if (i % 2 === 0) return val;
    parts[key] = val.replace(/\n$/, '');
    return null;
  }, null);
  return parts;
};
const branchen = site.branchen.map(b => Object.assign({}, b, readParts('content/branchen/' + b.id + '.html')));
branchen.forEach(b => { b.url = '/branchen/' + b.slug + '/'; });
const brancheUrl = id => branchen.find(b => b.id === id).url;

function minQty(p) {
  const g = p.qtyKey && p.options.find(o => o.key === p.qtyKey);
  if (g) return g.choices[0].label;
  const m = (p.notes || []).join(' ').match(/([\d.]+ Stück)/);
  return m ? m[1] : null;
}
function lieferzeit(p) {
  const m = readContent(p.slug).assure.match(/<b>Lieferzeit<\/b>\s*([^<]+)/);
  return m ? m[1].trim() : null;
}
const list = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1] : a[0];

// Häufige Fragen aus den Daten: Mindestmengen, "ab"-Preise, Design, Lieferzeit
function autoFaq(ps, lzText) {
  return [
    ['Ab welcher Menge kann ich bestellen?', list(ps.filter(minQty).map(p => p.catalog.title + ' ab ' + minQty(p))) + '.'],
    ['Was kostet das?', list(ps.map(p => p.catalog.title + ' ' + V.fromPrice(p) + (p.unit === 'kg' ? '' : ' pro Stück'))) + '. Je mehr du bestellst, desto günstiger. Alle Preise netto zzgl. MwSt.'],
    ['Bekomme ich alles im selben Design?', 'Ja. Unser Designservice gestaltet alle Produkte kostenlos passend zu deinem Logo. Produziert wird erst nach deiner Freigabe.'],
    ['Wie lange dauert die Lieferung?', lzText.charAt(0).toUpperCase() + lzText.slice(1) + '.'],
  ];
}
function lieferText(ps) {
  const lzGroups = [];
  ps.forEach(p => { const k = lieferzeit(p) || 'auf Anfrage'; const g = lzGroups.find(x => x.k === k); if (g) g.n.push(p.catalog.title); else lzGroups.push({ k, n: [p.catalog.title] }); });
  return lzGroups.length === 1 ? lzGroups[0].k : lzGroups.map(g => list(g.n) + ': ' + g.k.charAt(0).toLowerCase() + g.k.slice(1)).join('. ');
}

// Themen- und Kategorieseiten /<url>/ aus content/themen/<url>.html (eyebrow, title, description, h1, sub, produkte, faq, seo):
// Produkte, Vergleichstabelle und häufige Fragen kommen aus den Daten.
const themen = fs.readdirSync(path.join(ROOT, 'content/themen')).filter(f => f.endsWith('.html')).sort()
  .map(f => Object.assign({ id: f.replace(/\.html$/, '') }, readParts('content/themen/' + f)))
  .map(t => Object.assign(t, { url: '/' + t.id + '/', produkte: t.produkte.split(/\s+/).filter(Boolean) }));
function optText(p, keys) {
  const g = p.options.find(o => keys.includes(o.key));
  if (!g) return '–';
  const l = g.choices.map(c => c.label);
  if (l.length > 5) return l[0] + ' bis ' + l[l.length - 1] + ' (' + l.length + ' Größen)';
  // kurze Maßangaben mitnehmen: "S (470 ml · 16 oz)"
  return g.choices.map(c => c.detail && /\d/.test(c.detail) && c.detail.length <= 24 ? c.label + ' (' + c.detail + ')' : c.label).join(', ');
}
function themaPage(t) {
  const ps = t.produkte.map(s => { if (!bySlug[s]) throw new Error('Unbekanntes Produkt ' + s + ' in content/themen/' + t.id + '.html'); return bySlug[s]; });
  const faq = t.faq + '\n' + autoFaq(ps, lieferText(ps)).map(([q, a]) => `<details class="pf-faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n');
  const table = ps.length > 1 ? `<div class="pf-table-wrap"><table class="pf-table">
<thead><tr><th scope="col">Produkt</th><th scope="col">Größen</th><th scope="col">Material</th><th scope="col">Ab</th><th scope="col">Preis</th></tr></thead>
<tbody>
${ps.map(p => `<tr><td><a href="${esc(p.url)}">${esc(p.catalog.title)}</a></td><td>${esc(optText(p, ['size', 'groesse']))}</td><td>${esc(optText(p, ['material', 'mat']))}</td><td>${esc(minQty(p) || 'auf Anfrage')}</td><td>${esc(V.fromPrice(p))}</td></tr>`).join('\n')}
</tbody></table></div>` : '';
  const crumbs = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'PackFactory', item: ORIGIN + '/' },
    { '@type': 'ListItem', position: 2, name: plain(t.eyebrow), item: ORIGIN + t.url }] }, null, 2);
  const items = JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', name: plain(t.h1),
    itemListElement: ps.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: ORIGIN + p.url, name: p.catalog.title })) }, null, 2);
  return top({ title: t.title, description: t.description, path: t.url, jsonld: crumbs, extraLd: [items, faqLd(faq)], image: ogImage(ps[0].image), source: 'content/themen/' + t.id + '.html' }) +
`<main class="pf-site-main">
<section class="pf-page-hero">
  <div class="pf-wrap">
    <p class="pf-eyebrow">${esc(t.eyebrow)}</p>
    <h1 class="pf-hero-title">${t.h1}</h1>
    <p class="pf-hero-sub">${t.sub}</p>
    <div class="pf-hero-cta">
      <a class="pf-btn pf-btn-primary" href="${esc(ps[0].url)}">${esc(ps[0].catalog.title)} konfigurieren</a>
      <a class="pf-link" href="https://wa.me/491776990017" target="_blank" rel="noopener">Beratung per WhatsApp</a>
    </div>
  </div>
</section>

<section class="pf-section" aria-labelledby="pf-th-h">
  <div class="pf-wrap">
    <h2 class="pf-h2" id="pf-th-h">${ps.length > 1 ? 'Alle Produkte.' : 'Das Produkt.'} <span>Mit deinem Logo, Design kostenlos.</span></h2>
    <div class="pf-grid">
      ${ps.map(p => productCard(p, { badge: true })).join('\n      ')}
    </div>
  </div>
</section>

<section class="pf-section pf-details" aria-label="Details">
  <div class="pf-wrap pf-narrow">
      ${table ? `<details class="pf-acc"><summary>Produkte im Vergleich</summary><div class="pf-acc-body">${table}<p class="pf-small">Alle Preise netto zzgl. MwSt. „Ab“-Preis bei der größten Menge.</p></div></details>` : ''}
      <details class="pf-acc"><summary>Häufige Fragen</summary><div class="pf-acc-body">${faq}</div></details>
  </div>
</section>

<section class="pf-section pf-story">
  <div class="pf-wrap pf-narrow pf-prose">
    ${t.seo}
  </div>
</section>

<section class="pf-cta-band">
  <div class="pf-wrap">
    <h2>Bereit für deinen eigenen Look?</h2>
    <p>Schick uns dein Logo — wir gestalten deine Verpackung kostenlos.</p>
    <div class="pf-cta-row">
      <a class="pf-btn pf-btn-primary" href="/#kontakt">Jetzt anfragen</a>
      <a class="pf-btn pf-btn-wa" href="https://wa.me/491776990017" target="_blank" rel="noopener">${WA_ICON}WhatsApp</a>
    </div>
  </div>
</section>
</main>

${footer()}

${scripts([])}`;
}

function branchePage(b) {
  const setP = b.set.map(s => bySlug[s]);
  const more = products.filter(p => p.branchen.includes(b.id) && !b.set.includes(p.slug));
  const names = setP.map(p => p.catalog.title);
  // Lieferzeit je Produkt aus content/produkte (assure), gruppiert: "Papiertüten: ca. 5–7 Wochen … Auf Anfrage: Pizzakartons."
  const lzText = lieferText(setP);
  const auto = [['Welche Verpackungen brauche ich für ' + b.label + '?', 'Unser Set für ' + b.label + ': ' + list(names) + '. Alles mit deinem Logo und im selben Look.']]
    .concat(autoFaq(setP, lzText)).map(([q, a]) => `<details class="pf-faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n');
  const faq = b.faq + '\n' + auto;
  const cats = branchen.map(o => `      <a class="pf-cat${o.id === b.id ? ' active' : ''}" href="${esc(o.url)}"${o.id === b.id ? ' aria-current="page"' : ''}><span class="pf-cat-img"><img src="${esc(small(bySlug[o.bild].image))}" alt="" width="480" height="480" loading="lazy" decoding="async"></span><b>${esc(o.label)}</b><span>${products.filter(p => p.branchen.includes(o.id)).length} Produkte</span></a>`).join('\n');
  const crumbs = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'PackFactory', item: ORIGIN + '/' },
    { '@type': 'ListItem', position: 2, name: plain(b.label), item: ORIGIN + b.url }] }, null, 2);
  const wa = 'https://wa.me/491776990017?text=' + encodeURIComponent('Hallo, ich habe ' + (b.id === 'suess' ? 'eine Konditorei' : 'einen Betrieb (' + b.label + ')') + ' und interessiere mich für Verpackungen mit Logo.');
  return top({ title: b.title, description: b.description, path: b.url, jsonld: crumbs, extraLd: [faqLd(faq)], image: ogImage(bySlug[b.bild].image), source: 'data/site.json und content/branchen/' + b.id + '.html' }) +
`<main class="pf-site-main">
<section class="pf-page-hero">
  <div class="pf-wrap">
    <p class="pf-eyebrow">${esc(b.label)}</p>
    <h1 class="pf-hero-title">${b.h1}</h1>
    <p class="pf-hero-sub">${b.sub}</p>
    <div class="pf-hero-cta">
      <button type="button" class="pf-btn pf-btn-primary" onclick="pfAddSet('${esc(b.id)}')">Set in den Warenkorb</button>
      <a class="pf-link" href="${esc(wa)}" target="_blank" rel="noopener">Beratung per WhatsApp</a>
    </div>
  </div>
</section>

<section class="pf-cats" aria-label="Branchen">
  <div class="pf-wrap">
    <div class="pf-cat-row">
${cats}
    </div>
  </div>
</section>

<section class="pf-section" aria-labelledby="pf-set-h">
  <div class="pf-wrap">
    <h2 class="pf-h2" id="pf-set-h">Dein Set für ${esc(b.label)}. <span>Alles im selben Look.</span></h2>
    <div class="pf-grid">
      ${setP.map(p => productCard(p, { badge: true })).join('\n      ')}
    </div>
  </div>
</section>
${more.length ? `
<section class="pf-section pf-related" aria-labelledby="pf-more-h">
  <div class="pf-wrap">
    <h2 class="pf-h2" id="pf-more-h">Passt auch dazu.</h2>
    <div class="pf-grid">
      ${more.map(p => productCard(p, { badge: true })).join('\n      ')}
    </div>
  </div>
</section>
` : ''}
<section class="pf-section pf-details" aria-label="Details">
  <div class="pf-wrap pf-narrow">
      <details class="pf-acc"><summary>Häufige Fragen</summary><div class="pf-acc-body">${faq}</div></details>
  </div>
</section>

<section class="pf-section pf-story">
  <div class="pf-wrap pf-narrow pf-prose">
    ${b.seo}
  </div>
</section>

<section class="pf-cta-band">
  <div class="pf-wrap">
    <h2>Bereit für deinen eigenen Look?</h2>
    <p>Schick uns dein Logo — wir gestalten deine Verpackungen kostenlos.</p>
    <div class="pf-cta-row">
      <a class="pf-btn pf-btn-primary" href="/#kontakt">Jetzt anfragen</a>
      <a class="pf-btn pf-btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">${WA_ICON}WhatsApp</a>
    </div>
  </div>
</section>
</main>

${footer()}

${scripts([])}`;
}

// Ratgeber /ratgeber/<datei>/ aus content/ratgeber/<datei>.html (title, description, h1, lead, datum, produkte, body),
// Übersicht /ratgeber/. Neueste Artikel zuerst.
const ratgeber = fs.readdirSync(path.join(ROOT, 'content/ratgeber')).filter(f => f.endsWith('.html')).sort()
  .map(f => Object.assign({ id: f.replace(/\.html$/, '') }, readParts('content/ratgeber/' + f)))
  .map(a => Object.assign(a, { url: '/ratgeber/' + a.id + '/', produkte: a.produkte.split(/\s+/).filter(Boolean) }))
  .sort((a, b) => b.datum.localeCompare(a.datum) || a.id.localeCompare(b.id));
const datumText = d => { const [y, m, t] = d.split('-'); return `${+t}. ${['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][m - 1]} ${y}`; };

function artikelPage(a) {
  const prods = a.produkte.map(s => { if (!bySlug[s]) throw new Error('Unbekanntes Produkt ' + s + ' in content/ratgeber/' + a.id + '.html'); return bySlug[s]; });
  const img = ogImage(prods[0].image);
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: plain(a.h1), description: plain(a.description),
    image: [img], datePublished: a.datum, dateModified: a.datum, inLanguage: 'de-DE', mainEntityOfPage: ORIGIN + a.url,
    author: { '@type': 'Organization', name: 'PackFactory', url: ORIGIN + '/' }, publisher: { '@id': ORIGIN + '/#organization' } }, null, 2);
  const crumbs = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'PackFactory', item: ORIGIN + '/' },
    { '@type': 'ListItem', position: 2, name: 'Ratgeber', item: ORIGIN + '/ratgeber/' },
    { '@type': 'ListItem', position: 3, name: plain(a.h1), item: ORIGIN + a.url }] }, null, 2);
  const others = ratgeber.filter(o => o.id !== a.id).slice(0, 3);
  return top({ title: a.title, description: a.description, path: a.url, jsonld: ld, extraLd: [crumbs], image: img, source: 'content/ratgeber/' + a.id + '.html' }) +
`<main class="pf-site-main">
<section class="pf-page-hero">
  <div class="pf-wrap">
    <p class="pf-eyebrow"><a href="/ratgeber/">Ratgeber</a> · <time datetime="${esc(a.datum)}">${datumText(a.datum)}</time></p>
    <h1 class="pf-hero-title">${a.h1}</h1>
    <p class="pf-hero-sub">${a.lead}</p>
  </div>
</section>

<article class="pf-section pf-story">
  <div class="pf-wrap pf-narrow pf-prose">
    ${a.body}
  </div>
</article>

<section class="pf-section pf-related" aria-labelledby="pf-rel-h">
  <div class="pf-wrap">
    <h2 class="pf-h2" id="pf-rel-h">Passende Produkte. <span>Mit deinem Logo, Design kostenlos.</span></h2>
    <div class="pf-grid">
      ${prods.map(p => productCard(p, { badge: true })).join('\n      ')}
    </div>
  </div>
</section>
${others.length ? `
<section class="pf-section" aria-labelledby="pf-more-h">
  <div class="pf-wrap">
    <h2 class="pf-h2" id="pf-more-h">Mehr aus dem Ratgeber.</h2>
    <div class="pf-features pf-guides">
      ${others.map(o => `<a class="pf-tile" href="${esc(o.url)}"><b>${o.h1}</b><span>${o.lead}</span></a>`).join('\n      ')}
    </div>
  </div>
</section>
` : ''}
<section class="pf-cta-band">
  <div class="pf-wrap">
    <h2>Fragen zu deiner Verpackung?</h2>
    <p>Schreib uns — wir beraten dich kostenlos und gestalten dein Design.</p>
    <div class="pf-cta-row">
      <a class="pf-btn pf-btn-primary" href="/#kontakt">Jetzt anfragen</a>
      <a class="pf-btn pf-btn-wa" href="https://wa.me/491776990017" target="_blank" rel="noopener">${WA_ICON}WhatsApp</a>
    </div>
  </div>
</section>
</main>

${footer()}

${scripts([])}`;
}

function ratgeberIndex() {
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Ratgeber', url: ORIGIN + '/ratgeber/', inLanguage: 'de-DE',
    hasPart: ratgeber.map(a => ({ '@type': 'Article', headline: plain(a.h1), url: ORIGIN + a.url, datePublished: a.datum })) }, null, 2);
  return top({ title: 'Ratgeber: Verpackungen mit Logo für die Gastronomie | PackFactory', description: 'Praktische Antworten rund um bedruckte Verpackungen: Papier, Größen, Druckverfahren und Mindestmengen für Gastronomie, Bäckerei und Imbiss.', path: '/ratgeber/', jsonld: ld, source: 'content/ratgeber/' }) +
`<main class="pf-site-main">
<section class="pf-page-hero">
  <div class="pf-wrap">
    <p class="pf-eyebrow">Ratgeber</p>
    <h1 class="pf-hero-title">Wissen rund um deine Verpackung.</h1>
    <p class="pf-hero-sub">Papier, Größen, Druck und Mindestmengen — kurz und verständlich erklärt.</p>
  </div>
</section>

<section class="pf-section">
  <div class="pf-wrap">
    <div class="pf-features pf-guides">
      ${ratgeber.map(a => `<a class="pf-tile" href="${esc(a.url)}"><b>${a.h1}</b><span>${a.lead}</span></a>`).join('\n      ')}
    </div>
  </div>
</section>
</main>

${footer()}

${scripts([])}`;
}

// Türkische Seiten /tr/… aus content/tr/<name>.html (url, de = deutsche Gegenstück-Seite, title, description, h1, sub,
// produkte, faq, seo). Gegenseitige hreflang-Verweise (de ↔ tr) setzt altLinks().
const trSeiten = fs.readdirSync(path.join(ROOT, 'content/tr')).filter(f => f.endsWith('.html')).sort()
  .map(f => Object.assign({ id: f.replace(/\.html$/, '') }, readParts('content/tr/' + f)))
  .map(t => Object.assign(t, { produkte: t.produkte.split(/\s+/).filter(Boolean) }));
function altLinks(p) {
  const t = trSeiten.find(x => x.url === p || x.de === p);
  if (!t) return '';
  return `\n  <link rel="alternate" hreflang="de" href="${ORIGIN}${t.de}">\n  <link rel="alternate" hreflang="tr" href="${ORIGIN}${t.url}">\n  <link rel="alternate" hreflang="x-default" href="${ORIGIN}${t.de}">`;
}
function trPage(t) {
  const ps = t.produkte.map(s => { if (!bySlug[s]) throw new Error('Unbekanntes Produkt ' + s + ' in content/tr/' + t.id + '.html'); return bySlug[s]; });
  const crumbs = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'PackFactory', item: ORIGIN + '/tr/' }].concat(t.url === '/tr/' ? [] : [
    { '@type': 'ListItem', position: 2, name: plain(t.h1), item: ORIGIN + t.url }]) }, null, 2);
  const others = trSeiten.filter(o => o.url !== t.url);
  const wa = 'https://wa.me/491776990017?text=' + encodeURIComponent('Merhaba, logolu ambalaj hakkında bilgi almak istiyorum.');
  return top({ lang: 'tr', title: t.title, description: t.description, path: t.url, jsonld: crumbs, extraLd: [faqLd(t.faq)], image: ogImage(ps[0].image), source: 'content/tr/' + t.id + '.html' }) +
`<main class="pf-site-main" lang="tr">
<section class="pf-page-hero">
  <div class="pf-wrap">
    <p class="pf-eyebrow">Türkçe · <a href="${esc(t.de)}" hreflang="de" lang="de">Deutsch</a></p>
    <h1 class="pf-hero-title">${t.h1}</h1>
    <p class="pf-hero-sub">${t.sub}</p>
    <div class="pf-hero-cta">
      <a class="pf-btn pf-btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">${WA_ICON}WhatsApp ile yazın</a>
      <a class="pf-link" href="/muster/">Ücretsiz numune</a>
    </div>
  </div>
</section>

<section class="pf-section" aria-labelledby="pf-tr-h">
  <div class="pf-wrap">
    <h2 class="pf-h2" id="pf-tr-h">Ürünler. <span>Logonuzla, tasarım ücretsiz.</span></h2>
    <div class="pf-grid">
      ${ps.map(p => productCard(p, { badge: false })).join('\n      ')}
    </div>
    <p class="pf-small">Fiyatlar net, KDV hariç. Ürün sayfaları Almancadır.</p>
  </div>
</section>

<section class="pf-section pf-details" aria-label="Sık sorulan sorular">
  <div class="pf-wrap pf-narrow">
      <details class="pf-acc"><summary>Sık sorulan sorular</summary><div class="pf-acc-body">${t.faq}</div></details>
  </div>
</section>

<section class="pf-section pf-story">
  <div class="pf-wrap pf-narrow pf-prose">
    ${t.seo}
    ${others.length ? `<h3>Diğer sayfalar</h3>\n    <p>${others.map(o => `<a href="${esc(o.url)}">${plain(o.h1)}</a>`).join(' · ')}</p>` : ''}
  </div>
</section>

<section class="pf-cta-band">
  <div class="pf-wrap">
    <h2>Logonuzu gönderin.</h2>
    <p>Tasarımı ücretsiz hazırlıyoruz. Üretim onayınızdan sonra başlar.</p>
    <div class="pf-cta-row">
      <a class="pf-btn pf-btn-wa" href="${esc(wa)}" target="_blank" rel="noopener">${WA_ICON}WhatsApp</a>
      <a class="pf-btn pf-btn-primary" href="/#kontakt">İletişim formu</a>
    </div>
  </div>
</section>
</main>

${footer()}

${scripts([])}`;
}

// Häufige Fragen als Daten für Suchmaschinen: dieselben Fragen und Antworten wie sichtbar auf der Seite
function faqLd(faq) {
  const items = [...(faq || '').matchAll(/<details class="pf-faq"><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/g)];
  if (!items.length) return null;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(m => ({ '@type': 'Question', name: plain(m[1]), acceptedAnswer: { '@type': 'Answer', text: plain(m[2]) } })),
  }, null, 2);
}

// llms.txt: kurze Übersicht für KI-Assistenten (ChatGPT, Gemini, Perplexity …), nur Fakten aus den Daten
function llms() {
  const zeile = p => `- [${p.catalog.title}](${ORIGIN}${p.url}): Mindestmenge ${minQty(p) || 'auf Anfrage'}, Preis ${V.fromPrice(p)}${p.unit === 'kg' ? '' : ' pro Stück'} bei der größten Menge`;
  return `# PackFactory

> PackFactory (Hannover) liefert Verpackungen mit eigenem Logo für Gastronomie und Foodservice: Papiertüten, Boxen, Becher, Schalen, Einschlagpapier, Servietten und Feuchttücher. Der Designservice ist kostenlos, produziert wird erst nach Freigabe des Kunden. Preise stehen netto zzgl. MwSt. auf jeder Produktseite.

Kontakt: WhatsApp und Telefon +49 177 6990017, E-Mail info@pack-factory.de, Industrieweg 1, 30419 Hannover.

## Produkte
${products.map(zeile).join('\n')}

## Kategorien
${themen.map(t => `- [${plain(t.h1)}](${ORIGIN}${t.url})`).join('\n')}

## Branchen
${branchen.map(b => `- [${b.label}](${ORIGIN}${b.url})`).join('\n')}

## Ratgeber
${ratgeber.map(a => `- [${plain(a.h1)}](${ORIGIN}${a.url})`).join('\n')}

## Türkçe
${trSeiten.map(t => `- [${plain(t.h1)}](${ORIGIN}${t.url})`).join('\n')}

## Mehr
- [Designservice](${ORIGIN}/designservice/)
- [Kostenlose Muster anfordern](${ORIGIN}/muster/)
- [Über uns](${ORIGIN}/ueber-uns/)
- [Impressum](${ORIGIN}/impressum/)
`;
}

// Sitemap: alle Seiten, neue Produkte kommen automatisch dazu. Ohne lastmod, weil ein
// von Hand gepflegtes Datum schnell veraltet und Google es dann ignoriert.
function sitemap() {
  const paths = ['/', '/ueber-uns/', '/designservice/', '/muster/'].concat(products.map(p => p.url), branchen.map(b => b.url), themen.map(t => t.url), ['/ratgeber/'], ratgeber.map(a => a.url), trSeiten.map(t => t.url), ['/impressum/', '/datenschutz/']);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map(u => `  <url><loc>${ORIGIN}${u}</loc></url>`).join('\n') + '\n</urlset>\n';
}

const pages = [['assets/pf-katalog.js', katalog], ['sitemap.xml', sitemap], ['llms.txt', llms]].concat(products.map(p => [path.join('produkte', p.slug, 'index.html'), () => page(p)]))
  .concat(branchen.map(b => [path.join('branchen', b.slug, 'index.html'), () => branchePage(b)]))
  .concat(themen.map(t => [path.join(t.id, 'index.html'), () => themaPage(t)]))
  .concat(trSeiten.map(t => [path.join(t.url.replace(/^\/|\/$/g, ''), 'index.html'), () => trPage(t)]))
  .concat([['ratgeber/index.html', ratgeberIndex]], ratgeber.map(a => [path.join('ratgeber', a.id, 'index.html'), () => artikelPage(a)]))
  .concat([['index.html', 'start'], ['ueber-uns/index.html', 'ueber-uns'], ['designservice/index.html', 'designservice'], ['muster/index.html', 'muster'],
    ['impressum/index.html', 'impressum'], ['datenschutz/index.html', 'datenschutz']].map(([f, n]) => [f, () => sitePage(n)]));

const stale = [];
for (const [rel, render] of pages) {
  const file = path.join(ROOT, rel);
  const html = render();
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (old === html) continue;
  if (CHECK) stale.push(rel);
  else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, html); console.log('geschrieben', rel); }
}
if (CHECK && stale.length) {
  console.error('Nicht aktuell, bitte `node tools/build_site.js` ausführen:\n  ' + stale.join('\n  '));
  process.exit(1);
}
if (CHECK) console.log(`OK: ${pages.length - 3} Seiten, Sitemap, llms.txt und Warenkorb-Katalog aktuell.`);
