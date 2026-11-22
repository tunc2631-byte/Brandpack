/* PackFactory: Navigation und mobiles Menü auf allen Seiten. */
(function () {
  'use strict';
  var nav = document.getElementById('navWrapper');
  var menu = document.getElementById('mobileMenu');
  var burger = document.querySelector('.hamburger');
  if (nav) window.addEventListener('scroll', function () { nav.classList.toggle('scrolled', window.scrollY > 24); }, { passive: true });

  function setOpen(open) {
    menu.classList.toggle('open', open);
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  window.toggleMenu = function () { setOpen(!menu.classList.contains('open')); };
  window.closeMenu = function () { setOpen(false); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) setOpen(false); });

  // WhatsApp-Knopf unten rechts: Nachricht nennt die Seite, von der aus geschrieben wird
  var wa = document.querySelector('[data-wa-float]');
  var h1 = document.querySelector('h1');
  if (wa && h1 && location.pathname !== '/') {
    var topic = h1.textContent.replace(/\s+/g, ' ').trim();
    if (topic) wa.href = 'https://wa.me/491776990017?text=' + encodeURIComponent('Hallo PackFactory, ich habe eine Frage zu: ' + topic);
  }

  // Kundendesigns (Startseite und Tüten-Seite): zur Seite wischen, mit der Maus ziehen,
  // Pfeiltasten oder Farbpunkt. Startseite blättert zusätzlich selbst weiter (pf-home.js).
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  Array.prototype.forEach.call(document.querySelectorAll('[data-designs]'), function (box) {
    var track = box.querySelector('.pf-designs');
    var imgs = track.querySelectorAll('.pf-design');
    var sws = box.querySelectorAll('.pf-swatch');
    var nameEl = box.querySelector('[data-design-name]');
    var cur = 0, target = null, raf = 0;
    function mark(i) {
      cur = i;
      Array.prototype.forEach.call(imgs, function (im, k) { im.classList.toggle('is-on', k === i); });
      Array.prototype.forEach.call(sws, function (sw, k) { sw.classList.toggle('is-on', k === i); sw.setAttribute('aria-pressed', String(k === i)); });
      if (nameEl && sws[i]) nameEl.textContent = sws[i].dataset.name;
    }
    function go(i, instant) {
      i = Math.max(0, Math.min(imgs.length - 1, i));
      target = instant ? null : i;
      track.scrollTo({ left: i * track.clientWidth, behavior: instant || calm ? 'auto' : 'smooth' });
      mark(i);
    }
    function stopAuto() { box.dataset.user = '1'; target = null; }
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (target !== null) { if (i === target) target = null; return; }
        if (i !== cur) mark(i);
      });
    }, { passive: true });
    Array.prototype.forEach.call(sws, function (sw, k) {
      sw.addEventListener('click', function () { stopAuto(); go(k); });
    });
    track.addEventListener('touchstart', stopAuto, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); stopAuto(); go(cur + (e.key === 'ArrowRight' ? 1 : -1)); }
    });
    // Trackpad: Pro Geste entscheidet die erste Bewegung. Hoch/runter scrollt die Seite
    // (mit dem Schwung des Trackpads); eine seitliche Wischbewegung zieht das Bild mit den
    // Fingern mit und rastet dann auf dem nächsten oder demselben Bild ein.
    var wg = null;
    function wheelEnd() {
      if (!wg) return;
      var g = wg; wg = null; clearTimeout(g.timer);
      if (g.axis !== 'x') return;
      var w = Math.max(1, track.clientWidth), off = track.scrollLeft - g.start * w;
      track.classList.remove('is-wheel');
      go(Math.abs(off) > w * 0.15 ? g.start + (off > 0 ? 1 : -1) : g.start);
    }
    track.addEventListener('wheel', function (e) {
      var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      var dx = e.deltaX * k, dy = e.deltaY * k, now = Date.now();
      if (!wg || now - wg.last > 180) {
        if (wg) wheelEnd();
        wg = { axis: Math.abs(dx) > Math.abs(dy) ? 'x' : 'y', start: cur, last: now, timer: 0 };
      }
      wg.last = now;
      if (wg.axis === 'y') {
        // Chrome gibt schräge Trackpad-Bewegungen über dem Bild nicht an die Seite weiter:
        // dann selbst scrollen, aber sofort (nicht „smooth“, sonst ruckelt es)
        if (dx) { e.preventDefault(); window.scrollBy({ top: dy, left: 0, behavior: 'instant' }); }
        return;
      }
      e.preventDefault();
      clearTimeout(wg.timer);
      wg.timer = setTimeout(wheelEnd, 180);
      if (wg.axis === 'done') return; // Restschwung der Geste nach dem Einrasten schlucken
      stopAuto();
      track.classList.add('is-wheel');
      var w = Math.max(1, track.clientWidth);
      var lo = Math.max(0, (wg.start - 1) * w), hi = Math.min((imgs.length - 1) * w, (wg.start + 1) * w);
      track.scrollLeft = Math.max(lo, Math.min(hi, track.scrollLeft + dx));
      var off = track.scrollLeft - wg.start * w;
      if (Math.abs(off) > w * 0.4) {
        track.classList.remove('is-wheel');
        go(wg.start + (off > 0 ? 1 : -1));
        wg.axis = 'done';
      }
    }, { passive: false });
    // Maus: ziehen wie mit dem Finger
    var drag = null;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      stopAuto();
      drag = { x: e.clientX, left: track.scrollLeft };
      track.classList.add('is-drag');
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', function (e) {
      if (drag) track.scrollLeft = drag.left - (e.clientX - drag.x);
    });
    function endDrag(e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      drag = null;
      track.classList.remove('is-drag');
      go(Math.abs(dx) > 40 ? cur + (dx < 0 ? 1 : -1) : cur);
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    window.addEventListener('resize', function () { go(cur, true); });
    // Weiterblättern von außen; vom letzten zum ersten Bild sanft überblenden statt zurückzurollen
    box.pfNext = function () {
      if (cur < imgs.length - 1 || calm) { go((cur + 1) % imgs.length); return; }
      track.classList.add('is-fade');
      setTimeout(function () { go(0, true); track.classList.remove('is-fade'); }, 260);
    };
  });
})();
