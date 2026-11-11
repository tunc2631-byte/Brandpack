/*
 * PackFactory Produktseite: Konfigurator, Kaufleiste, zuletzt angesehen.
 * Die Seite ist ohne JavaScript vollständig (Standardauswahl ist vorberechnet);
 * dieses Skript macht die Auswahl interaktiv.
 */
(function () {
  'use strict';
  var PF = window.PFPricing, V = window.PFView;
  var data = JSON.parse(document.getElementById('pf-data').textContent);
  var p = data.product;
  var sel = PF.defaults(p);
  var custom = { width: 0, height: 0 };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }

  function bump(el) {
    if (!el || reduce) return;
    el.classList.remove('pf-bump'); void el.offsetWidth; el.classList.add('pf-bump');
  }

  function update(animate) {
    // Knöpfe
    $$('.pf-opt').forEach(function (b) {
      var on = sel[b.dataset.key] === b.dataset.id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    // Mengen-Karten
    if (p.qtyKey) {
      $$('.pf-tier').forEach(function (b) {
        var t = V.tier(p, sel, V.choice(p, p.qtyKey, b.dataset.id));
        setText($('[data-qty]', b), t.qty);
        setText($('[data-unit]', b), t.line);
        var pct = $('[data-pct]', b);
        pct.hidden = !t.pct;
        setText(pct, '−' + t.pct + ' %');
      });
    }
    // Sondergröße
    var cf = $('[data-custom]');
    if (cf) cf.hidden = !V.isCustom(p, sel);
    // Hinweise
    var hints = V.hints(p, sel, custom);
    $$('[data-hints]').forEach(function (box) {
      var html = hints.filter(function (h) { return h.after === box.dataset.hints; })
        .map(function (h) { var e = document.createElement('p'); e.className = 'pf-hint'; e.textContent = h.text; return e.outerHTML; }).join('');
      if (box.innerHTML !== html) box.innerHTML = html;
    });
    // Preis
    var s = V.summary(p, sel);
    var total = $('#price-display');
    var changed = total.textContent !== s.total;
    setText(total, s.total);
    setText($('#price-per'), s.per);
    setText($('#pf-saved'), s.saved);
    if (animate && changed) bump(total);
    // Anfrage
    var msg = V.message(p, sel, custom);
    $('#wa-link').href = 'https://wa.me/491776990017?text=' + encodeURIComponent(msg);
    $('#pf-sticky-wa').href = $('#wa-link').href;
    $('#email-link').href = 'mailto:info@pack-factory.de?subject=' + encodeURIComponent('Anfrage ' + p.catalog.title) + '&body=' + encodeURIComponent(V.emailBody(p, sel, custom));
    setText($('#pf-sticky-total'), s.total);
    setText($('#pf-sticky-line'), p.catalog.title + ' · ' + (V.parts(p, sel, custom).slice(-1)[0] || ''));
    window.PF_ITEM = { title: p.catalog.title, desc: msg, priceTotal: s.total, url: location.pathname, img: p.image.replace('-960.webp', '-480.webp') };
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.pf-opt');
    if (!b) return;
    sel[b.dataset.key] = b.dataset.id;
    update(true);
  });
  ['pf-width', 'pf-height'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function () {
      custom.width = parseInt(document.getElementById('pf-width').value, 10) || 0;
      custom.height = parseInt(document.getElementById('pf-height').value, 10) || 0;
      update(false);
    });
  });
  update(false);

  // Mitlaufende Kaufleiste: sichtbar, solange die Kaufknöpfe nicht im Bild sind
  var sticky = $('#pf-sticky'), ctas = $('#pf-ctas');
  if (sticky && ctas && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      var show = !e.isIntersecting;
      sticky.classList.toggle('is-on', show);
      sticky.setAttribute('aria-hidden', String(!show));
      $$('a, button', sticky).forEach(function (x) { x.tabIndex = show ? 0 : -1; });
      document.body.classList.toggle('pf-sticky-on', show);
    }).observe(ctas);
  }

  // Zuletzt angesehen (nur in diesem Browser gespeichert)
  try {
    var KEY = 'pf_recent_v1';
    var list = JSON.parse(localStorage.getItem(KEY) || '[]').filter(function (s) { return s !== p.slug; });
    var bySlug = {};
    data.catalog.forEach(function (c) { bySlug[c.slug] = c; });
    var show = list.filter(function (s) { return bySlug[s]; }).slice(0, 6);
    if (show.length) {
      $('#pf-recent-list').innerHTML = show.map(function (s) {
        var c = bySlug[s], a = document.createElement('a');
        a.className = 'pf-card'; a.href = c.url;
        a.innerHTML = '<span class="pf-card-img"><img alt="" loading="lazy" decoding="async" width="480" height="480"></span><b></b><span></span>';
        a.querySelector('img').src = c.img;
        a.querySelector('b').textContent = c.title;
        a.querySelector('span:last-child').textContent = c.from;
        return a.outerHTML;
      }).join('');
      $('#pf-recent').hidden = false;
    }
    localStorage.setItem(KEY, JSON.stringify([p.slug].concat(list).slice(0, 12)));
  } catch (e) { /* ohne Speicher keine Liste */ }

  // Navigation
  var nav = document.getElementById('navWrapper');
  window.addEventListener('scroll', function () { nav.classList.toggle('scrolled', window.scrollY > 24); }, { passive: true });
  window.toggleMenu = function () {
    var m = document.getElementById('mobileMenu'), h = $('.hamburger');
    var open = !m.classList.contains('open');
    m.classList.toggle('open', open); h.classList.toggle('open', open);
    h.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  window.closeMenu = function () {
    document.getElementById('mobileMenu').classList.remove('open');
    $('.hamburger').classList.remove('open');
    $('.hamburger').setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };
})();
