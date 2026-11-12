/* PackFactory – Warenkorb (localStorage, kein Bezahl-Checkout).
   Fügt das Warenkorb-Symbol in die Navigation ein, sammelt Produkte über
   window.PF_ITEM (von jeder Produktseite gesetzt) und fasst sie zu einer
   WhatsApp- bzw. E-Mail-Anfrage zusammen.
   Bilder, Vorschläge ("Passt dazu") und Sets je Branche kommen aus
   window.PF_KATALOG (assets/pf-katalog.js, erzeugt von tools/build_site.js).
   Aussehen: assets/pf.css (Abschnitt "Warenkorb"). */
(function () {
  'use strict';
  var STORAGE_KEY = 'pf_cart_v1';
  var WA_NUMBER = '491776990017';
  var EMAIL = 'info@pack-factory.de';
  var KAT = window.PF_KATALOG || { produkte: {}, sets: [] };
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function getCart() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }
  function setCart(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) {}
    updateBadge();
    render();
  }

  function cleanDesc(msg) {
    if (!msg) return '';
    var s = msg.replace(/^Hallo, ich interessiere mich (für|fuer)\s*/i, '');
    s = s.replace(/\s*und (möchte|moechte) ein Angebot anfragen\.?\s*$/i, '');
    return s.trim();
  }

  // Produkt-Kennung aus der Adresse, damit auch ältere Einträge Bild und Vorschläge bekommen
  function slugOf(item) {
    if (item.slug) return item.slug;
    var m = /\/produkte\/([^/]+)\//.exec(item.url || '');
    return m ? m[1] : '';
  }
  function newId() { return Date.now() + '-' + Math.random().toString(36).slice(2, 7); }

  function entryFor(slug) {
    var p = KAT.produkte[slug];
    if (!p) return null;
    return { id: newId(), slug: slug, title: p.title, desc: p.std.desc, priceTotal: p.std.priceTotal, url: p.url, img: p.img, std: true };
  }

  window.addCurrentToCart = function () {
    var it = window.PF_ITEM;
    if (!it) return;
    var items = getCart();
    var slug = slugOf({ url: it.url || location.pathname });
    items.push({ id: newId(), slug: slug, title: it.title, desc: cleanDesc(it.desc), priceTotal: it.priceTotal || '', url: it.url || location.pathname, img: it.img || '' });
    var shot = document.getElementById('product-img');
    flyToCart(shot, function () { setCart(items); openDrawer(); });
  };

  // Ein Produkt in Standardauswahl hinzufügen (Vorschlag)
  function addSlug(slug) {
    var e = entryFor(slug);
    if (!e) return;
    var items = getCart(); items.push(e); setCart(items); pulse();
  }
  // Ganzes Set einer Branche hinzufügen; was schon im Korb liegt, wird nicht doppelt hinzugefügt
  window.pfAddSet = function (id) {
    var set = KAT.sets.filter(function (s) { return s.id === id; })[0];
    if (!set) return;
    var items = getCart();
    var have = items.map(slugOf);
    set.items.forEach(function (slug) { if (have.indexOf(slug) < 0) { var e = entryFor(slug); if (e) items.push(e); } });
    setCart(items); pulse(); openDrawer();
  };

  function removeItem(id) { setCart(getCart().filter(function (i) { return i.id !== id; })); }

  var fab, badge, drawer, overlay, lastFocus;

  function cartIconSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
  }
  var WA_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41Z"/></svg>';

  function injectFab() {
    var anchor = document.querySelector('.hamburger');
    fab = document.createElement('button');
    fab.className = 'pf-cart-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Warenkorb öffnen');
    fab.innerHTML = cartIconSvg() + '<span class="pf-cart-badge" aria-hidden="true">0</span>';
    fab.addEventListener('click', openDrawer);
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(fab, anchor);
    else { var navRight = document.querySelector('.nav-right') || document.querySelector('.nav-inner'); if (navRight) navRight.appendChild(fab); }
    badge = fab.querySelector('.pf-cart-badge');
  }

  function updateBadge() {
    if (!badge) return;
    var n = getCart().length;
    badge.textContent = n;
    badge.classList.toggle('is-on', n > 0);
    fab.setAttribute('aria-label', n ? 'Warenkorb öffnen, ' + n + (n === 1 ? ' Produkt' : ' Produkte') : 'Warenkorb öffnen');
  }

  function injectDrawer() {
    overlay = document.createElement('div');
    overlay.className = 'pf-cart-overlay';
    overlay.addEventListener('click', closeDrawer);
    drawer = document.createElement('aside');
    drawer.className = 'pf-cart-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'pf-cart-title');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML =
      '<div class="pf-cart-head"><h2 id="pf-cart-title">Warenkorb</h2><button type="button" class="pf-cart-close" aria-label="Warenkorb schließen">&times;</button></div>'
      + '<div class="pf-cart-body"></div>'
      + '<div class="pf-cart-foot"></div>';
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    drawer.querySelector('.pf-cart-close').addEventListener('click', closeDrawer);
    drawer.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (!t) return;
      var act = t.getAttribute('data-act'), v = t.getAttribute('data-v');
      if (act === 'remove') removeItem(v);
      else if (act === 'add') addSlug(v);
      else if (act === 'set') window.pfAddSet(v);
      else if (act === 'clear') { if (getCart().length && confirm('Warenkorb wirklich leeren?')) setCart([]); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer(); });
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  // "1.500,00 €" oder älter "EUR 1.500,00" -> Cent
  function cents(text) {
    var m = /([\d.]+),(\d\d)/.exec(text || '');
    return m ? Number(m[1].replace(/\./g, '')) * 100 + Number(m[2]) : null;
  }
  function euro(c) { return (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

  // Kurzfassung der Auswahl für die Anzeige: ohne Produktname, Feldnamen und Gesamtpreis
  // ("S (95 × 95 × 73 mm) · Bristol (Weiß) · 10.000 Stück · 15,00 ct pro Stück"). Die Nachricht bleibt unverändert.
  function shortDesc(i) {
    var d = i.desc || '', t = i.title || '';
    if (t && d.indexOf(t + ' (') === 0 && d.slice(-1) === ')') d = d.slice(t.length + 2, -1);
    var parts = [], depth = 0, cur = '';
    for (var k = 0; k < d.length; k++) {
      var ch = d[k];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0 && d[k + 1] === ' ') { parts.push(cur); cur = ''; k++; continue; }
      cur += ch;
    }
    parts.push(cur);
    return parts.filter(function (x) { return x && !/^gesamt /.test(x); })
      .map(function (x) { return x.replace(/^[^:()]{1,30}:\s*/, '').replace(/ netto$/, ''); }).join(' · ');
  }

  function itemHtml(i) {
    var p = KAT.produkte[slugOf(i)];
    var img = i.img || (p && p.img) || '';
    return '<li class="pf-cart-item">'
      + '<a class="pf-cart-thumb" href="' + esc(i.url) + '" tabindex="-1" aria-hidden="true">' + (img ? '<img src="' + esc(img) + '" alt="" width="96" height="96" loading="lazy" decoding="async">' : '') + '</a>'
      + '<div class="pf-cart-info">'
      + '<a class="pf-cart-name" href="' + esc(i.url) + '">' + esc(i.title) + '</a>'
      + '<p class="pf-cart-desc">' + esc(shortDesc(i)) + '</p>'
      + (i.std ? '<a class="pf-cart-edit" href="' + esc(i.url) + '">Standardauswahl · anpassen ›</a>' : '')
      + (i.priceTotal ? '<b class="pf-cart-price">' + esc(i.priceTotal) + '</b>' : '<b class="pf-cart-price">Preis auf Anfrage</b>')
      + '</div>'
      + '<button type="button" class="pf-cart-remove" data-act="remove" data-v="' + esc(i.id) + '" aria-label="' + esc(i.title) + ' entfernen">&times;</button>'
      + '</li>';
  }

  function suggestions(items) {
    var have = items.map(slugOf), out = [];
    items.forEach(function (i) {
      var p = KAT.produkte[slugOf(i)];
      (p ? p.related : []).forEach(function (s) { if (have.indexOf(s) < 0 && out.indexOf(s) < 0 && KAT.produkte[s]) out.push(s); });
    });
    return out.slice(0, 4);
  }

  function suggestHtml(slugs) {
    if (!slugs.length) return '';
    return '<section class="pf-cart-more" aria-labelledby="pf-cart-more-h"><h3 id="pf-cart-more-h">Passt dazu</h3><ul>'
      + slugs.map(function (s) {
        var p = KAT.produkte[s];
        return '<li><a class="pf-cart-mini" href="' + esc(p.url) + '"><img src="' + esc(p.img) + '" alt="" width="64" height="64" loading="lazy" decoding="async"><span><b>' + esc(p.title) + '</b><small>' + esc(p.ab) + '</small></span></a>'
          + '<button type="button" class="pf-cart-plus" data-act="add" data-v="' + esc(s) + '" aria-label="' + esc(p.title) + ' hinzufügen">+</button></li>';
      }).join('') + '</ul></section>';
  }

  function setsHtml() {
    if (!KAT.sets.length) return '';
    return '<section class="pf-cart-sets" aria-labelledby="pf-cart-sets-h"><h3 id="pf-cart-sets-h">Oder starte mit einem Set für deinen Betrieb</h3><p class="pf-cart-sets-note">In Standardauswahl, jederzeit auf der Produktseite anpassbar.</p><ul>'
      + KAT.sets.map(function (s) {
        var pics = s.items.slice(0, 3).map(function (slug) { var p = KAT.produkte[slug]; return p ? '<img src="' + esc(p.img) + '" alt="" width="40" height="40" loading="lazy" decoding="async">' : ''; }).join('');
        return '<li><button type="button" class="pf-cart-set" data-act="set" data-v="' + esc(s.id) + '"><span class="pf-cart-set-pics">' + pics + '</span><span><b>' + esc(s.label) + '</b><small>' + s.items.length + ' Produkte</small></span><i aria-hidden="true">+</i></button></li>';
      }).join('') + '</ul></section>';
  }

  function render() {
    if (!drawer) return;
    var items = getCart();
    var body = drawer.querySelector('.pf-cart-body'), foot = drawer.querySelector('.pf-cart-foot');
    drawer.querySelector('#pf-cart-title').textContent = items.length ? 'Warenkorb (' + items.length + ')' : 'Warenkorb';
    if (!items.length) {
      body.innerHTML = '<p class="pf-cart-empty">Dein Warenkorb ist noch leer. Stell dir auf einer Produktseite deine Verpackung zusammen und leg sie hier ab.</p>' + setsHtml();
      foot.innerHTML = '';
      foot.hidden = true;
      return;
    }
    body.innerHTML = '<ul class="pf-cart-list">' + items.map(itemHtml).join('') + '</ul>' + suggestHtml(suggestions(items))
      + '<section class="pf-cart-next" aria-labelledby="pf-cart-next-h"><h3 id="pf-cart-next-h">So geht es weiter</h3>'
      + '<ol class="pf-cart-steps"><li>Du schickst die Anfrage per WhatsApp oder E-Mail.</li><li>Wir melden uns mit Angebot und kostenlosem Entwurf.</li><li>Produziert wird erst nach deiner Freigabe.</li></ol></section>'
      + '<button type="button" class="pf-cart-clear" data-act="clear">Warenkorb leeren</button>';
    var sum = 0, open = 0;
    items.forEach(function (i) { var c = cents(i.priceTotal); if (c == null) open++; else sum += c; });
    foot.hidden = false;
    foot.innerHTML =
      '<div class="pf-cart-sum"><span>Summe' + (open ? ' ohne ' + open + ' Position' + (open > 1 ? 'en' : '') + ' auf Anfrage' : '') + '</span><b>' + euro(sum) + '</b></div>'
      + '<p class="pf-cart-note">Netto zzgl. MwSt. Unverbindliche Anfrage, keine Bestellung.</p>'
      + '<a class="pf-btn pf-btn-wa pf-cart-wa" target="_blank" rel="noopener" href="https://wa.me/' + WA_NUMBER + '?text=' + buildText(items, false) + '">' + WA_SVG + 'Per WhatsApp anfragen</a>'
      + '<a class="pf-btn pf-btn-ghost pf-cart-mail" href="mailto:' + EMAIL + '?subject=' + encodeURIComponent('Anfrage mehrere Produkte') + '&body=' + buildText(items, true) + '">Per E-Mail anfragen</a>';
  }

  // Nachricht wie bisher: nummerierte Liste mit Titel, Auswahl und Preis
  function itemLine(i, idx) {
    return (idx + 1) + '. ' + i.title + (i.desc ? ' – ' + i.desc : '') + (i.priceTotal ? ' (' + i.priceTotal + ')' : '');
  }
  function buildText(items, mail) {
    var lines = (mail ? ['Hallo,', ''] : []).concat([(mail ? 'ich' : 'Hallo, ich') + ' interessiere mich für folgende Produkte und möchte ein Gesamtangebot:', '']);
    items.forEach(function (i, idx) { lines.push(itemLine(i, idx)); });
    lines.push('', 'Danke!');
    return encodeURIComponent(lines.join('\n'));
  }

  function openDrawer() {
    if (!drawer) return;
    render();
    lastFocus = document.activeElement;
    overlay.classList.add('open');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    drawer.querySelector('.pf-cart-close').focus({ preventScroll: true });
  }
  function closeDrawer() {
    if (!drawer) return;
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  window.pfOpenCart = openDrawer;

  function pulse() {
    if (!fab || calm) return;
    fab.classList.remove('pf-cart-pulse'); void fab.offsetWidth; fab.classList.add('pf-cart-pulse');
  }

  // Produktbild fliegt zum Warenkorb-Symbol (nur transform und opacity)
  function flyToCart(img, done) {
    if (calm || !img || !fab || !img.animate) { done(); pulse(); return; }
    var a = img.getBoundingClientRect(), b = fab.getBoundingClientRect();
    if (!a.width || a.bottom < 0 || a.top > innerHeight) { done(); pulse(); return; }
    var size = Math.min(a.width, a.height, 260);
    var ghost = img.cloneNode(false);
    ghost.removeAttribute('id'); ghost.removeAttribute('srcset'); ghost.alt = '';
    ghost.className = 'pf-cart-ghost';
    ghost.style.width = size + 'px'; ghost.style.height = size + 'px';
    ghost.style.left = (a.left + a.width / 2 - size / 2) + 'px'; ghost.style.top = (a.top + a.height / 2 - size / 2) + 'px';
    document.body.appendChild(ghost);
    var dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    var anim = ghost.animate([
      { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
      { transform: 'translate3d(' + dx * 0.55 + 'px,' + (dy * 0.55 - 60) + 'px,0) scale(.45)', opacity: .95, offset: .55 },
      { transform: 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(.08)', opacity: .2 }
    ], { duration: 620, easing: 'cubic-bezier(.5,0,.3,1)' });
    anim.onfinish = function () { ghost.remove(); pulse(); done(); };
  }

  function init() {
    injectFab();
    injectDrawer();
    updateBadge();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
