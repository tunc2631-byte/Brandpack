#!/usr/bin/env node
/*
 * Erzeugt alle Produktseiten produkte/<slug>/index.html aus
 *   data/products.json         Auswahl, Preise, Hinweise, passende Produkte
 *   content/produkte/<slug>.html  Texte (Titel, Beschreibung, Abschnitte, FAQ)
 *
 *   node tools/build_site.js           Seiten schreiben
 *   node tools/build_site.js --check   nur prüfen, ob die Seiten aktuell sind
 */
const fs = require('fs');
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
      <p class="pf-note">${esc(g.note)}</p>` : ''}
    </div>`;
  }).join('');
}

function card(p, cls) {
  return `<a class="${cls}" href="${esc(p.url)}"><span class="pf-card-img"><img src="${esc(small(p.image))}" alt="" loading="lazy" decoding="async" width="480" height="480"></span><b>${esc(p.catalog.title)}</b><span>${esc(V.fromPrice(p))}</span></a>`;
}

function page(p) {
  const c = readContent(p.slug);
  const sel = PF.defaults(p);
  const s = V.summary(p, sel);
  const msg = V.message(p, sel, null);
  const waHref = 'https://wa.me/491776990017?text=' + encodeURIComponent(msg);
  const mailHref = 'mailto:info@pack-factory.de?subject=' + encodeURIComponent('Anfrage ' + p.catalog.title) + '&body=' + encodeURIComponent(V.emailBody(p, sel, null));
  const related = p.related.map(r => card(bySlug[r], 'pf-card')).join('\n      ');
  const mini = products.map(o => ({ slug: o.slug, url: o.url, title: o.catalog.title, img: small(o.image), from: V.fromPrice(o) }));
  const data = JSON.stringify({ product: p, catalog: mini }).replace(/</g, '\\u003c');
  const details = [
    `<details class="pf-acc" open><summary>Preise im Überblick</summary><div class="pf-acc-body">${priceTable(p)}</div></details>`,
    c.tech || c.technotes ? `<details class="pf-acc"><summary>Technische Daten</summary><div class="pf-acc-body">${c.tech}${c.technotes ? `<div class="pf-small">${c.technotes}</div>` : ''}</div></details>` : '',
    c.faq ? `<details class="pf-acc"><summary>Häufige Fragen</summary><div class="pf-acc-body">${c.faq}</div></details>` : '',
    c.guide ? `<details class="pf-acc"><summary>Auswahlhilfe</summary><div class="pf-acc-body pf-prose">${c.guide}</div></details>` : '',
  ].filter(Boolean).join('\n      ');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${c.title}</title>
  <link rel="canonical" href="https://pack-factory.de${p.url}">
  <meta name="description" content="${c.description}">
  <link rel="icon" type="image/png" href="/Bilder/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/pf.css">
  <script>document.documentElement.classList.add('pf-js');</script>
  <script type="application/ld+json">
${c.jsonld}
  </script>
</head>
<body class="pf-page">
<!-- Erzeugt von tools/build_site.js aus data/products.json und content/produkte/${p.slug}.html. Nicht von Hand ändern. -->

<div class="nav-wrapper" id="navWrapper">
  <nav aria-label="Hauptnavigation">
    <div class="nav-inner">
      <a href="/" class="nav-home"><img src="/Bilder/packfactory-logo.webp" alt="PackFactory" class="nav-logo" width="900" height="637"></a>
      <div class="nav-links">
        <a href="/">Home</a>
        <a href="/#produkte">Produkte</a>
        <a href="/designservice/">Designservice</a>
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
  <a href="/ueber-uns/" onclick="closeMenu()">&Uuml;ber uns</a>
  <a href="/#kontakt" onclick="closeMenu()">Kontakt</a>
</div>

<main>
<section class="pf-buy" aria-label="Produkt konfigurieren">
  <div class="pf-gallery">
    <div class="pf-shot">
      <img id="product-img" src="${esc(p.image)}" srcset="${esc(small(p.image))} 480w, ${esc(p.image)} 960w" sizes="(max-width: 980px) 90vw, 560px" alt="${esc(p.name)} mit Logo bedruckt" width="960" height="960" fetchpriority="high">
    </div>
  </div>

  <div class="pf-panel config-panel">
    <nav class="pf-crumbs" aria-label="Brotkrumen"><a href="/">PackFactory</a><span aria-hidden="true">›</span><a href="/#produkte">Produkte</a><span aria-hidden="true">›</span><span>${esc(p.catalog.title)}</span></nav>
    <h1 class="pf-title">${c.name}</h1>
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

<footer class="pf-footer">
  <img src="/Bilder/packfactory-logo.webp" alt="PackFactory" width="900" height="637" loading="lazy">
  <div class="foot-links">
    <a href="/impressum/">Impressum</a>
    <a href="/datenschutz/">Datenschutz</a>
    <a href="/#kontakt">Kontakt</a>
  </div>
  <p>2025 PackFactory. Alle Rechte vorbehalten.</p>
</footer>

<div class="pf-sticky" id="pf-sticky" aria-hidden="true">
  <div class="pf-sticky-in">
    <div class="pf-sticky-txt"><b id="pf-sticky-total">${esc(s.total)}</b><span id="pf-sticky-line">${esc(p.catalog.title)} · ${esc(V.parts(p, sel, null).slice(-1)[0] || '')}</span></div>
    <a class="pf-btn pf-btn-wa pf-btn-icon" id="pf-sticky-wa" href="${esc(waHref)}" target="_blank" rel="noopener" aria-label="Per WhatsApp anfragen" tabindex="-1">${WA_ICON}</a>
    <button type="button" class="pf-btn pf-btn-primary pf-btn-sm" onclick="addCurrentToCart()" tabindex="-1">In den Warenkorb</button>
  </div>
</div>

<script type="application/json" id="pf-data">${data}</script>
<script src="/assets/pf-pricing.js"></script>
<script src="/assets/pf-view.js"></script>
<script src="/assets/pf-product.js"></script>
<script src="/cart.js"></script>
</body>
</html>
`;
}

let stale = [];
for (const p of products) {
  const file = path.join(ROOT, 'produkte', p.slug, 'index.html');
  const html = page(p);
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (old === html) continue;
  if (CHECK) stale.push(path.relative(ROOT, file));
  else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, html); console.log('geschrieben', path.relative(ROOT, file)); }
}
if (CHECK && stale.length) {
  console.error('Nicht aktuell, bitte `node tools/build_site.js` ausführen:\n  ' + stale.join('\n  '));
  process.exit(1);
}
if (CHECK) console.log(`OK: ${products.length} Produktseiten aktuell.`);
