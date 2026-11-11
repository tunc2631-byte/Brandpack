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
})();
