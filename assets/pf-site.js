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
    // Trackpad: schräges Runterscrollen über dem Bild scrollt die Seite (nicht das Bild);
    // eine klar seitliche Wischbewegung blättert genau ein Bild weiter
    var wheelAcc = 0, wheelLast = 0, wheelDone = false;
    track.addEventListener('wheel', function (e) {
      if (!e.deltaX) return; // normales Mausrad: Browser scrollt die Seite selbst
      e.preventDefault();
      var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) { window.scrollBy(0, e.deltaY * k); return; }
      var now = Date.now();
      if (now - wheelLast > 200) { wheelAcc = 0; wheelDone = false; }
      wheelLast = now;
      if (wheelDone) return;
      wheelAcc += e.deltaX * k;
      if (Math.abs(wheelAcc) > 50) { stopAuto(); go(cur + (wheelAcc > 0 ? 1 : -1)); wheelDone = true; }
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
