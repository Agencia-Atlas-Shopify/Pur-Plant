/**
 * PP Recently Viewed — stores last-viewed product handles in localStorage
 * and renders them as a grid. Hidden if no products to show.
 */
(function () {
  var KEY = 'pp_recently_viewed';
  var MAX_STORED = 12;

  var root = document.querySelector('[data-pp-recent]');
  if (!root) return;

  var currentHandle = root.dataset.currentHandle || '';
  var limit = parseInt(root.dataset.limit, 10) || 6;
  var list = root.querySelector('[data-pp-recent-list]');
  if (!list) return;

  /* Read stored handles */
  function readHandles() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  /* Save handles with current one prepended */
  function registerCurrent() {
    if (!currentHandle) return;
    var handles = readHandles().filter(function (h) { return h !== currentHandle; });
    handles.unshift(currentHandle);
    handles = handles.slice(0, MAX_STORED);
    try { localStorage.setItem(KEY, JSON.stringify(handles)); } catch (_) {}
  }

  /* Format price (cents → "12,50 €") */
  function formatPrice(cents) {
    if (window.Shopify && window.Shopify.formatMoney) {
      return window.Shopify.formatMoney(cents);
    }
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  }

  /* Render products */
  async function render() {
    var handles = readHandles().filter(function (h) { return h !== currentHandle; });
    if (!handles.length) {
      root.hidden = true;
      return;
    }

    var toFetch = handles.slice(0, limit);
    var products = [];
    for (var i = 0; i < toFetch.length; i++) {
      try {
        var res = await fetch('/products/' + toFetch[i] + '.js');
        if (!res.ok) continue;
        var p = await res.json();
        products.push(p);
      } catch (_) { /* skip */ }
    }

    if (!products.length) {
      root.hidden = true;
      return;
    }

    list.innerHTML = products.map(function (p) {
      var img = p.featured_image
        ? p.featured_image.replace(/(\.[^.?]+)(\?.*)?$/, '_400x$1$2')
        : '';
      return '<a href="' + p.url + '" class="pp-recent__card">' +
        '<div class="pp-recent__media">' +
          (img ? '<img src="' + img + '" alt="' + escapeHtml(p.title) + '" loading="lazy" class="pp-recent__img">' : '') +
        '</div>' +
        '<h3 class="pp-recent__title">' + escapeHtml(p.title) + '</h3>' +
        '<span class="pp-recent__price">' + formatPrice(p.price) + '</span>' +
      '</a>';
    }).join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  registerCurrent();
  render();
})();
