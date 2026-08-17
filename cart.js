/* PackFactory – shared Warenkorb (localStorage-based, kein Zahl-Checkout).
   Fügt ein Warenkorb-Icon in die Nav ein, sammelt Produkte über window.PF_ITEM
   (von jeder Produktseite gesetzt) und fasst sie zu einer WhatsApp- bzw.
   E-Mail-Anfrage zusammen. */
(function () {
  var STORAGE_KEY = 'pf_cart_v1';
  var WA_NUMBER = '4917673216419';
  var EMAIL = 'info@pack-factory.de';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }
  function setCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    updateBadge();
    renderDrawerItems();
  }

  function cleanDesc(msg) {
    if (!msg) return '';
    var s = msg.replace(/^Hallo, ich interessiere mich (für|fuer)\s*/i, '');
    s = s.replace(/\s*und (möchte|moechte) ein Angebot anfragen\.?\s*$/i, '');
    return s.trim();
  }

  window.addCurrentToCart = function () {
    var it = window.PF_ITEM;
    if (!it) return;
    var items = getCart();
    items.push({
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      title: it.title,
      desc: cleanDesc(it.desc),
      priceTotal: it.priceTotal || '',
      url: it.url || location.pathname
    });
    setCart(items);
    openDrawer();
    flashAdded();
  };

  function removeItem(id) { setCart(getCart().filter(function (i) { return i.id !== id; })); }
  function clearCart() { setCart([]); }

  var fab, badge, drawer, overlay;

  function injectStyles() {
    var css = ''
      + '.pf-cart-fab{position:relative;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border:none;background:transparent;cursor:pointer;padding:0;margin-right:2px;border-radius:10px;transition:background .15s,transform .15s;}'
      + '.pf-cart-fab:hover{background:rgba(0,0,0,.05);}'
      + '.pf-cart-fab svg{width:21px;height:21px;color:#1a1a1a;}'
      + '.pf-cart-fab.pf-cart-pulse{animation:pfCartPulse .4s ease;}'
      + '@keyframes pfCartPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.18);}}'
      + '.pf-cart-badge{position:absolute;top:2px;right:2px;min-width:16px;height:16px;padding:0 3px;border-radius:100px;background:#F07A8C;color:#fff;font-size:10px;font-weight:800;display:none;align-items:center;justify-content:center;line-height:1;font-family:inherit;}'
      + '.pf-cart-overlay{position:fixed;inset:0;background:rgba(20,18,15,.4);opacity:0;pointer-events:none;transition:opacity .25s ease;z-index:998;}'
      + '.pf-cart-overlay.open{opacity:1;pointer-events:all;}'
      + '.pf-cart-drawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,92vw);background:#fff;z-index:999;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .3s cubic-bezier(.22,1,.36,1);box-shadow:-8px 0 32px rgba(0,0,0,.12);font-family:inherit;}'
      + '.pf-cart-drawer.open{transform:translateX(0);}'
      + '.pf-cart-head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid #EFEBE4;}'
      + '.pf-cart-head h3{font-size:18px;font-weight:900;color:#1a1a1a;margin:0;letter-spacing:-.02em;}'
      + '.pf-cart-close{background:none;border:none;font-size:26px;line-height:1;cursor:pointer;color:#8e8e93;padding:4px 8px;}'
      + '.pf-cart-close:hover{color:#1a1a1a;}'
      + '.pf-cart-list{flex:1;overflow-y:auto;padding:10px 22px;}'
      + '.pf-cart-empty{color:#8e8e93;font-size:14px;line-height:1.7;padding:24px 0;}'
      + '.pf-cart-item{display:flex;gap:10px;align-items:flex-start;padding:14px 0;border-bottom:1px solid #F2EFE9;}'
      + '.pf-cart-item-info{flex:1;min-width:0;}'
      + '.pf-cart-item-title{display:block;font-size:14px;font-weight:800;color:#1a1a1a;text-decoration:none;margin-bottom:2px;}'
      + '.pf-cart-item-title:hover{color:#F07A8C;}'
      + '.pf-cart-item-desc{font-size:12.5px;color:#6e6e73;line-height:1.5;}'
      + '.pf-cart-item-price{font-size:13px;font-weight:800;color:#1a1a1a;margin-top:4px;}'
      + '.pf-cart-item-remove{flex-shrink:0;width:26px;height:26px;border-radius:100px;border:none;background:#F5F2EC;color:#8e8e93;font-size:16px;line-height:1;cursor:pointer;}'
      + '.pf-cart-item-remove:hover{background:#F07A8C;color:#fff;}'
      + '.pf-cart-foot{padding:16px 22px 22px;border-top:1px solid #EFEBE4;display:flex;flex-direction:column;gap:8px;}'
      + '.pf-cart-wa{display:flex;align-items:center;justify-content:center;gap:9px;background:#25D366;color:#fff;border-radius:12px;padding:14px 18px;font-size:14.5px;font-weight:800;text-decoration:none;transition:opacity .15s;}'
      + '.pf-cart-wa:hover{opacity:.88;}'
      + '.pf-cart-email{display:flex;align-items:center;justify-content:center;gap:9px;border:2px solid var(--pink,#F07A8C);color:var(--pink,#F07A8C);border-radius:12px;padding:12px 18px;font-size:13.5px;font-weight:700;text-decoration:none;transition:background .15s,color .15s;}'
      + '.pf-cart-email:hover{background:var(--pink,#F07A8C);color:#fff;}'
      + '.pf-cart-clear{background:none;border:none;color:#aeaeb2;font-size:12px;font-weight:600;text-decoration:underline;cursor:pointer;padding:4px;align-self:center;}'
      + '.pf-cart-clear:hover{color:#8e8e93;}'
      + '.pf-disabled{opacity:.45;pointer-events:none;}'
      + '.pf-cart-add{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:#fff;border:2px solid #1a1a1a;color:#1a1a1a;border-radius:12px;padding:13px 18px;font-family:inherit;font-size:14.5px;font-weight:800;cursor:pointer;transition:background .15s,color .15s,transform .15s;margin-bottom:8px;}'
      + '.pf-cart-add:hover{background:#1a1a1a;color:#fff;}'
      + '.pf-cart-add.pf-added{background:#25D366;border-color:#25D366;color:#fff;}';
    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  function cartIconSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
  }

  function injectFab() {
    var anchor = document.querySelector('.hamburger');
    fab = document.createElement('button');
    fab.className = 'pf-cart-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Warenkorb öffnen');
    fab.innerHTML = cartIconSvg() + '<span class="pf-cart-badge" id="pfCartBadge">0</span>';
    fab.addEventListener('click', openDrawer);
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(fab, anchor);
    } else {
      var navRight = document.querySelector('.nav-right') || document.querySelector('.nav-inner');
      if (navRight) navRight.appendChild(fab);
    }
    badge = fab.querySelector('.pf-cart-badge');
  }

  function updateBadge() {
    if (!badge) return;
    var n = getCart().length;
    badge.textContent = n;
    badge.style.display = n > 0 ? 'flex' : 'none';
  }

  function injectDrawer() {
    overlay = document.createElement('div');
    overlay.className = 'pf-cart-overlay';
    overlay.addEventListener('click', closeDrawer);

    drawer = document.createElement('div');
    drawer.className = 'pf-cart-drawer';
    drawer.innerHTML =
      '<div class="pf-cart-head"><h3>Warenkorb</h3><button type="button" class="pf-cart-close" aria-label="Schließen">&times;</button></div>'
      + '<div class="pf-cart-list" id="pfCartList"></div>'
      + '<div class="pf-cart-foot">'
      + '<a class="pf-cart-wa" id="pfCartWa" target="_blank" rel="noopener" href="#">Warenkorb per WhatsApp anfragen</a>'
      + '<a class="pf-cart-email" id="pfCartEmail" href="#">Per E-Mail anfragen</a>'
      + '<button type="button" class="pf-cart-clear" id="pfCartClear">Warenkorb leeren</button>'
      + '</div>';
    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    drawer.querySelector('.pf-cart-close').addEventListener('click', closeDrawer);
    drawer.querySelector('#pfCartClear').addEventListener('click', function () {
      if (getCart().length && confirm('Warenkorb wirklich leeren?')) clearCart();
    });
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : s;
    return d.innerHTML;
  }

  function renderDrawerItems() {
    if (!drawer) return;
    var list = drawer.querySelector('#pfCartList');
    var items = getCart();
    if (items.length === 0) {
      list.innerHTML = '<p class="pf-cart-empty">Dein Warenkorb ist leer. Stelle dir auf den Produktseiten deine Verpackung zusammen und füge sie hinzu.</p>';
    } else {
      list.innerHTML = items.map(function (i) {
        return '<div class="pf-cart-item">'
          + '<div class="pf-cart-item-info">'
          + '<a href="' + esc(i.url) + '" class="pf-cart-item-title">' + esc(i.title) + '</a>'
          + '<div class="pf-cart-item-desc">' + esc(i.desc) + '</div>'
          + (i.priceTotal ? '<div class="pf-cart-item-price">' + esc(i.priceTotal) + '</div>' : '')
          + '</div>'
          + '<button type="button" class="pf-cart-item-remove" data-id="' + esc(i.id) + '" aria-label="Entfernen">&times;</button>'
          + '</div>';
      }).join('');
      Array.prototype.forEach.call(list.querySelectorAll('.pf-cart-item-remove'), function (btn) {
        btn.addEventListener('click', function () { removeItem(btn.getAttribute('data-id')); });
      });
    }
    var waLink = drawer.querySelector('#pfCartWa');
    var emailLink = drawer.querySelector('#pfCartEmail');
    var disabled = items.length === 0;
    waLink.classList.toggle('pf-disabled', disabled);
    emailLink.classList.toggle('pf-disabled', disabled);
    waLink.href = disabled ? '#' : 'https://wa.me/' + WA_NUMBER + '?text=' + buildWaText(items);
    emailLink.href = disabled ? '#' : 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Anfrage mehrere Produkte') + '&body=' + buildEmailBody(items);
  }

  function itemLine(i, idx) {
    return (idx + 1) + '. ' + i.title + (i.desc ? ' – ' + i.desc : '') + (i.priceTotal ? ' (' + i.priceTotal + ')' : '');
  }
  function buildWaText(items) {
    var lines = ['Hallo, ich interessiere mich für folgende Produkte und möchte ein Gesamtangebot:', ''];
    items.forEach(function (i, idx) { lines.push(itemLine(i, idx)); });
    lines.push('', 'Danke!');
    return encodeURIComponent(lines.join('\n'));
  }
  function buildEmailBody(items) {
    var lines = ['Hallo,', '', 'ich interessiere mich für folgende Produkte und möchte ein Gesamtangebot:', ''];
    items.forEach(function (i, idx) { lines.push(itemLine(i, idx)); });
    lines.push('', 'Danke!');
    return encodeURIComponent(lines.join('\n'));
  }

  function openDrawer() {
    if (!drawer) return;
    renderDrawerItems();
    overlay.classList.add('open');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!drawer) return;
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }
  window.pfOpenCart = openDrawer;

  function flashAdded() {
    if (!fab) return;
    fab.classList.add('pf-cart-pulse');
    setTimeout(function () { fab.classList.remove('pf-cart-pulse'); }, 400);
  }

  function init() {
    injectStyles();
    injectFab();
    injectDrawer();
    updateBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
