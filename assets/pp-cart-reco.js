/**
 * PP Cart Recommendations — loads and re-loads related products
 * inside [data-cart-reco] containers.
 *
 * Survives morph: uses a MutationObserver on <body> to detect when
 * [data-cart-reco] appears with an empty [data-cart-reco-list], then
 * re-fetches and re-renders the products.
 */
(function () {
  if (window.__ppCartRecoInit) return;
  window.__ppCartRecoInit = true;

  function loadReco(root) {
    if (!root || root.dataset.ppRecoLoaded) return;
    root.dataset.ppRecoLoaded = '1';

    var list = root.querySelector('[data-cart-reco-list]');
    if (!list) return;

    // If SSR'd (has children already), skip fetch
    if (list.children.length > 0) return;

    var hasCollection = !!root.dataset.collectionHandle;
    var productId = root.dataset.productId;
    var limit = parseInt(root.dataset.limit, 10) || 8;

    if (hasCollection || !productId) return;

    var url = '/recommendations/products.json?product_id=' + productId + '&limit=' + limit + '&intent=related';
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.products || !data.products.length) {
          root.style.display = 'none';
          return;
        }
        list.innerHTML = data.products
          .map(function (p) {
            var variant = p.variants[0];
            var price = window.Shopify && window.Shopify.formatMoney
              ? window.Shopify.formatMoney(variant.price)
              : (variant.price / 100).toFixed(2) + ' €';
            var img = p.featured_image
              ? p.featured_image.replace(/(\.[^.?]+)(\?.*)?$/, '_300x$1$2')
              : '';
            var singleVariantAvail = p.variants.length === 1 && variant.available;
            var addBtn = singleVariantAvail
              ? '<button type="button" class="pp-cart-reco__add" data-cart-reco-add data-variant-id="' + variant.id + '" aria-label="Añadir">+</button>'
              : '<a href="' + p.url + '" class="pp-cart-reco__add" aria-label="Ver">→</a>';
            return '<div class="pp-cart-reco__card">' +
              '<a href="' + p.url + '" class="pp-cart-reco__media">' +
              (img ? '<img src="' + img + '" alt="' + p.title + '" loading="lazy" class="pp-cart-reco__img">' : '') +
              '<span class="pp-cart-reco__price">' + price + '</span>' +
              '</a>' + addBtn + '</div>';
          })
          .join('');
      })
      .catch(function () {
        root.style.display = 'none';
      });
  }

  // Init all existing containers
  function initAll() {
    document.querySelectorAll('[data-cart-reco]').forEach(function (el) {
      loadReco(el);
    });
  }

  // Watch for morph re-injecting the container (empty)
  var observer = new MutationObserver(function () {
    document.querySelectorAll('[data-cart-reco]').forEach(function (el) {
      if (!el.dataset.ppRecoLoaded) loadReco(el);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Expose global function for inline onclick handlers on recommendation buttons.
  // This bypasses any event-delegation issues with other scripts stopping propagation.
  window.ppCartRecoAdd = function (btn, variantId) {
    console.log('[pp-cart-reco] add via inline onclick', variantId);
    if (!variantId || (btn && btn.disabled)) return;
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    }
    triggerAdd(btn, variantId);
  };

  function triggerAdd(btn, variantId) {

    var sectionIds = [];
    document.querySelectorAll('cart-items-component[data-section-id]').forEach(function (el) {
      var id = el.getAttribute('data-section-id');
      if (id) sectionIds.push(id);
    });

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        items: [{ id: parseInt(variantId, 10), quantity: 1 }],
        sections: sectionIds.join(','),
        sections_url: window.location.pathname,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        // Visual feedback — swap "+" to check briefly
        btn.classList.add('is-added');
        btn.textContent = '✓';
        setTimeout(function () {
          btn.classList.remove('is-added');
          btn.textContent = '+';
        }, 1200);

        // Refresh drawer content so quantities + line items update
        if (typeof window.ppRefreshCartDrawer === 'function') {
          try {
            var p = window.ppRefreshCartDrawer({ open: true });
            if (p && typeof p.catch === 'function') {
              p.catch(function (err) { console.warn('[pp-cart-reco] refresh failed:', err); });
            }
          } catch (e) { console.warn('[pp-cart-reco] refresh threw:', e); }
        }

        document.dispatchEvent(new CustomEvent('cart:update', {
          bubbles: true,
          detail: { data: data, source: 'pp-cart-reco', sections: data.sections },
        }));

        // Update free shipping bar + count
        fetch('/cart.js', { credentials: 'same-origin' })
          .then(function (r) { return r.json(); })
          .then(function (cart) {
            document.querySelectorAll('pp-free-shipping-bar').forEach(function (el) {
              el.dataset.totalPrice = String(cart.total_price);
              if (typeof el._render === 'function') el._render();
            });
            document.querySelectorAll('.pp-header__cart-count, [data-cart-count]').forEach(function (el) {
              el.textContent = cart.item_count;
            });
          })
          .catch(function () {});
      })
      .catch(function (err) { console.warn('[pp-cart-reco] add failed:', err); })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '';
        }
      });
  }

  // Bonus delegation fallback (for any button that was already rendered)
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-cart-reco-add]');
    if (!btn || btn.disabled) return;
    ev.preventDefault();
    var variantId = btn.dataset.variantId;
    if (!variantId) return;
    btn.disabled = true;
    btn.style.opacity = '0.5';
    triggerAdd(btn, variantId);
  }, true);

  initAll();
})();
