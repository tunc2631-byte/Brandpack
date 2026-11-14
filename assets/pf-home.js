/* PackFactory Startseite: Produktfilter nach Kategorie und Branche, Kontaktformular. */
(function () {
  'use strict';
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var state = { cat: 'alle', branche: null };
  var labels = {};
  $$('[data-branche]').forEach(function (b) { labels[b.dataset.branche] = b.querySelector('b').textContent; });

  // Ohne Filter zeigt der Katalog zuerst nur zwei Reihen (am Handy drei); "Alle … anzeigen" klappt den Rest auf.
  // Alle Karten bleiben im HTML, Suchmaschinen sehen also weiterhin jedes Produkt.
  var expanded = false;
  var grid = document.getElementById('pf-grid');
  var moreBtn = document.createElement('button');
  moreBtn.type = 'button'; moreBtn.className = 'pf-btn pf-grid-more'; moreBtn.hidden = true;
  moreBtn.addEventListener('click', function () { expanded = true; apply(); });
  grid.parentNode.insertBefore(moreBtn, grid.nextSibling);
  function limit() {
    var cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    return cols * (cols <= 3 ? 3 : 2);
  }

  function apply() {
    var shown = 0, matched = 0;
    var collapse = !expanded && state.cat === 'alle' && !state.branche;
    var lim = collapse ? limit() : Infinity;
    $$('.pf-pcard').forEach(function (card) {
      var okCat = state.cat === 'alle' || card.dataset.cat.split(' ').indexOf(state.cat) > -1;
      var okBranche = !state.branche || card.dataset.branchen.split(' ').indexOf(state.branche) > -1;
      var ok = okCat && okBranche;
      if (ok) matched++;
      card.hidden = !ok || matched > lim;
      if (!card.hidden) shown++;
    });
    moreBtn.hidden = !(collapse && matched > lim);
    moreBtn.textContent = 'Alle ' + matched + ' Produkte anzeigen';
    $$('.pf-chip').forEach(function (c) {
      var on = c.dataset.cat === state.cat;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', String(on));
    });
    $$('[data-branche]').forEach(function (b) {
      var on = b.dataset.branche === state.branche;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    var info = document.getElementById('pf-filter-state');
    if (state.branche) {
      info.textContent = 'Passend für ' + labels[state.branche] + ' · ' + shown + ' Produkte ';
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'pf-link-btn'; x.textContent = 'Alle Branchen zeigen';
      x.addEventListener('click', function () { state.branche = null; apply(); });
      info.appendChild(x);
      // Passendes Set mit einem Klick in den Warenkorb (Inhalt: data/site.json → branchen[].set)
      var b = state.branche;
      if (window.pfAddSet && window.PF_KATALOG && window.PF_KATALOG.sets.some(function (s) { return s.id === b; })) {
        var set = document.createElement('button');
        set.type = 'button'; set.className = 'pf-btn pf-btn-primary pf-btn-sm pf-set-btn';
        set.textContent = 'Set für ' + labels[b] + ' in den Warenkorb';
        set.addEventListener('click', function () { window.pfAddSet(b); });
        info.appendChild(set);
        var info2 = window.PF_KATALOG.sets.filter(function (s) { return s.id === b; })[0];
        if (info2 && info2.url) {
          var more = document.createElement('a');
          more.className = 'pf-link-btn'; more.href = info2.url;
          more.textContent = 'Mehr zur Branche';
          info.insertBefore(more, set);
        }
      }
      info.hidden = false;
    } else {
      info.hidden = true;
    }
    document.getElementById('pf-empty').hidden = shown > 0;
  }

  $$('.pf-chip').forEach(function (c) {
    c.addEventListener('click', function () { state.cat = c.dataset.cat; apply(); });
  });
  apply();
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (!expanded) apply(); }, 150); });
  $$('[data-branche]').forEach(function (b) {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      state.branche = state.branche === b.dataset.branche ? null : b.dataset.branche;
      state.cat = 'alle';
      apply();
      if (state.branche) document.getElementById('produkte').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Einstieg: Kundendesigns der Tüte blättern von selbst weiter, bis jemand wischt oder einen Farbpunkt wählt
  // (Wischen, Ziehen und Farbpunkte: assets/pf-site.js)
  var heroEl = document.querySelector('.pf-hero');
  // Reiter: Papiertüten / Burgerboxen / Salatschalen (data/site.json → hero.produkte)
  var tabs = $$('.pf-shop-tab');
  function showTab(k, focus) {
    tabs.forEach(function (t, i) {
      var on = i === k;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    $$('.pf-shop-panel, .pf-shop-pick').forEach(function (el) { el.hidden = +el.dataset.panel !== k; });
    window.dispatchEvent(new Event('resize')); // Bildleiste des sichtbaren Produkts neu ausrichten
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { showTab(i); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      showTab((i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length, true);
    });
  });
  if (heroEl && !calm) {
    setInterval(function () {
      if (document.hidden || heroEl.classList.contains('is-offscreen')) return;
      var pick = heroEl.querySelector('.pf-shop-pick:not([hidden]) [data-designs]');
      if (pick && pick.pfNext && !pick.dataset.user) pick.pfNext();
    }, 3400);
  }

  // Dauerbewegungen (Designwechsel, Logo-Laufband) nur abspielen, solange sie im Bild sind
  if ('IntersectionObserver' in window) {
    var pause = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-offscreen', !en.isIntersecting); });
    });
    ['.pf-hero', '.pf-logos'].forEach(function (sel) { var el = document.querySelector(sel); if (el) pause.observe(el); });
  }

  // WhatsApp-Knopf ausblenden, solange Startbereich, Kontaktbereich oder Footer sichtbar sind
  var fab = document.querySelector('.pf-wa-float');
  if (fab && 'IntersectionObserver' in window) {
    var seen = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) seen.add(en.target); else seen.delete(en.target); });
      fab.classList.toggle('is-hidden', seen.size > 0);
    });
    ['kontakt'].map(function (id) { return document.getElementById(id); }).concat([document.querySelector('.pf-hero'), document.querySelector('.pf-footer')])
      .forEach(function (el) { if (el) io.observe(el); });
  }

  // Kontaktformular über Formspree
  var FORMSPREE_ID = 'mdabqjpq';
  var form = document.getElementById('kontakt-form');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = document.getElementById('submit-btn');
    var status = document.getElementById('form-status');
    var idle = 'Keine Verpflichtung · Kostenlose Erstberatung · Antwort in 24 h';
    if (!form.checkValidity()) {
      status.textContent = 'Bitte Name und eine gültige E-Mail-Adresse angeben.';
      status.className = 'pf-form-status is-error';
      form.reportValidity();
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Wird gesendet …';
    fetch('https://formspree.io/f/' + FORMSPREE_ID, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) })
      .then(function (res) {
        if (!res.ok) throw new Error('Fehler');
        btn.textContent = 'Nachricht gesendet';
        status.textContent = 'Danke! Wir melden uns innerhalb von 24 Stunden bei dir.';
        status.className = 'pf-form-status is-ok';
        form.reset();
        setTimeout(function () { btn.textContent = 'Kostenlos anfragen'; status.textContent = idle; status.className = 'pf-form-status'; }, 6000);
      })
      .catch(function () {
        btn.textContent = 'Kostenlos anfragen';
        status.textContent = 'Senden hat nicht geklappt. Bitte erneut versuchen oder direkt an info@pack-factory.de schreiben.';
        status.className = 'pf-form-status is-error';
      })
      .then(function () { btn.disabled = false; });
  });
})();
