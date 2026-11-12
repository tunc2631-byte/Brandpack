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
    // Mengenrechner
    calc();
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

  // ── Mengenrechner: Verkäufe pro Tag → wie lange reicht jede Staffel ──
  var calcBox = document.getElementById('pf-calc');
  var calcDays = 7;
  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  function reach(qty, perDay) {
    var days = qty / (perDay * calcDays / 7);
    if (days < 14) return 'ca. ' + Math.max(1, Math.round(days)) + ' Tage';
    var weeks = days / 7;
    if (weeks < 9) return 'ca. ' + Math.round(weeks) + ' Wochen';
    var months = days / 30.44;
    if (months < 24) return 'ca. ' + Math.round(months) + ' Monate';
    return 'über 2 Jahre';
  }
  function calc() {
    if (!calcBox) return;
    var n = parseInt(document.getElementById('pf-perday-n').value, 10);
    var res = document.getElementById('pf-calc-res');
    if (!(n > 0)) { res.innerHTML = '<li class="pf-calc-empty">Bitte eine Zahl eingeben.</li>'; return; }
    res.innerHTML = V.group(p, p.qtyKey).choices.map(function (c) {
      var s = Object.assign({}, sel); s[p.qtyKey] = c.id;
      var q = PF.quote(p, s);
      if (q.onRequest) return '';
      var t = V.tier(p, sel, c);
      var on = sel[p.qtyKey] === c.id;
      return '<li><button type="button" class="pf-calc-row' + (on ? ' active' : '') + '" data-pick="' + c.id + '" aria-pressed="' + on + '">'
        + '<b>' + t.qty + '</b><span class="pf-calc-reach">reicht ' + reach(q.qty, n) + '</span>'
        + '<span class="pf-calc-unit">' + t.line + (t.pct ? ' <em>−' + t.pct + ' %</em>' : '') + '</span></button></li>';
    }).join('');
  }
  if (calcBox) {
    calcBox.hidden = false;
    var range = document.getElementById('pf-perday'), num = document.getElementById('pf-perday-n');
    range.addEventListener('input', function () { num.value = range.value; calc(); });
    num.addEventListener('input', function () { var v = parseInt(num.value, 10); if (v > 0) range.value = Math.min(1000, Math.max(10, v)); calc(); });
    calcBox.addEventListener('click', function (e) {
      var d = e.target.closest('[data-days]');
      if (d) {
        calcDays = +d.dataset.days;
        $$('.pf-calc-day').forEach(function (b) { var on = b === d; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
        calc();
        return;
      }
      var r = e.target.closest('[data-pick]');
      if (r) { sel[p.qtyKey] = r.dataset.pick; update(true); }
    });
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

})();
