/* PackFactory Startseite: Produktfilter nach Kategorie und Branche, Kontaktformular. */
(function () {
  'use strict';
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var state = { cat: 'alle', branche: null };
  var labels = {};
  $$('.pf-branche').forEach(function (b) { labels[b.dataset.branche] = b.querySelector('b').textContent; });

  function apply() {
    var shown = 0;
    $$('.pf-pcard').forEach(function (card) {
      var okCat = state.cat === 'alle' || card.dataset.cat.split(' ').indexOf(state.cat) > -1;
      var okBranche = !state.branche || card.dataset.branchen.split(' ').indexOf(state.branche) > -1;
      card.hidden = !(okCat && okBranche);
      if (!card.hidden) shown++;
    });
    $$('.pf-chip').forEach(function (c) {
      var on = c.dataset.cat === state.cat;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', String(on));
    });
    $$('.pf-branche').forEach(function (b) {
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
      info.hidden = false;
    } else {
      info.hidden = true;
    }
    document.getElementById('pf-empty').hidden = shown > 0;
  }

  $$('.pf-chip').forEach(function (c) {
    c.addEventListener('click', function () { state.cat = c.dataset.cat; apply(); });
  });
  $$('.pf-branche').forEach(function (b) {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      state.branche = state.branche === b.dataset.branche ? null : b.dataset.branche;
      state.cat = 'alle';
      apply();
      if (state.branche) document.getElementById('produkte').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Kategorie-Leiste: springt zu "Alle Produkte" und filtert dort
  $$('[data-cat-jump]').forEach(function (a) {
    a.addEventListener('click', function () { state.cat = a.dataset.catJump; state.branche = null; apply(); });
  });

  // Einstieg: Kundendesigns der Tüte wechseln von selbst; ein Klick auf einen Farbpunkt wählt fest aus
  var heroEl = document.querySelector('.pf-hero');
  var designs = $$('.pf-design'), swatches = $$('.pf-swatch'), designName = document.getElementById('pf-design-name');
  if (designs.length > 1) {
    var current = 0, auto = null;
    var show = function (i) {
      current = i;
      designs.forEach(function (im, k) { im.classList.toggle('is-on', k === i); });
      swatches.forEach(function (sw, k) { sw.classList.toggle('is-on', k === i); sw.setAttribute('aria-pressed', String(k === i)); });
      designName.textContent = swatches[i].dataset.name;
    };
    swatches.forEach(function (sw, k) {
      sw.addEventListener('click', function () { clearInterval(auto); auto = null; show(k); });
    });
    if (!calm) auto = setInterval(function () {
      if (document.hidden || heroEl.classList.contains('is-offscreen')) return;
      show((current + 1) % designs.length);
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
