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
