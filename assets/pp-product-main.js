/* ============================================================
   pp-product-main.js
   Custom PDP logic for Pur-Plant
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     Helpers
  ---------------------------------------------------------- */

  /**
   * Format price in cents to display string.
   * Uses Shopify.formatMoney when available, otherwise manual format.
   * Output example: "12,50 \u20ac"  /  "\u20ac12,50"  -- we use \u20acXX,XX as specified.
   */
  function formatMoney(cents) {
    if (cents == null) return '';
    if (window.Shopify && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(cents);
    }
    var amount = (cents / 100).toFixed(2).replace('.', ',');
    return '\u20ac' + amount;
  }

  /** Shorthand querySelector / querySelectorAll scoped to a root. */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  /** Debounce utility. */
  function debounce(fn, ms) {
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  /**
   * Calculate shipping delivery date range.
   * Rules:
   * - Before 18:00 Spanish time: ships today (24-48h delivery = 1-2 business days)
   * - After 18:00: ships next business day
   * - Friday after 18:00 or weekend: ships Monday (arrives Lunes-Martes)
   * - Friday before 18:00: ships Friday (arrives Lunes-Martes)
   * Weekends (Sat/Sun) are never delivery days.
   */
  function getShippingDate() {
    var now = new Date();
    // Convert to Spanish time (CET/CEST)
    var spanish = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    var hour = spanish.getHours();
    var dow = spanish.getDay(); // 0=Sun, 1=Mon...5=Fri, 6=Sat

    var shipDate = new Date(spanish);

    // Determine ship date (when the order leaves warehouse)
    if (dow === 5) {
      // Friday (any time) → ships Friday, delivery Lunes-Martes
      // shipDate stays as Friday
    } else if (dow === 0) {
      // Sunday → ships Monday
      shipDate.setDate(shipDate.getDate() + 1);
    } else if (dow === 6) {
      // Saturday → ships Monday
      shipDate.setDate(shipDate.getDate() + 2);
    } else if (hour >= 18) {
      // After 18:00 Mon-Thu → ships next business day
      shipDate.setDate(shipDate.getDate() + 1);
    }
    // else: before 18:00 Mon-Thu → ships today

    // Delivery = 1-2 business days after ship date
    // Calculate min (1 biz day) and max (2 biz days)
    function addBusinessDays(from, n) {
      var d = new Date(from);
      var added = 0;
      while (added < n) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) added++;
      }
      return d;
    }

    var minDate = addBusinessDays(shipDate, 1);
    var maxDate = addBusinessDays(shipDate, 2);

    var days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    var months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    // If same day, show just one date; if different, show range
    if (minDate.getDate() === maxDate.getDate() && minDate.getMonth() === maxDate.getMonth()) {
      return days[minDate.getDay()] + ' ' + minDate.getDate() + ' ' + months[minDate.getMonth()];
    }
    // Same month: "Martes 24 - Miércoles 25 Marzo"
    if (minDate.getMonth() === maxDate.getMonth()) {
      return days[minDate.getDay()] + ' ' + minDate.getDate() + ' - ' + days[maxDate.getDay()] + ' ' + maxDate.getDate() + ' ' + months[maxDate.getMonth()];
    }
    // Different months: "Lunes 31 Mar - Martes 1 Abr"
    return days[minDate.getDay()] + ' ' + minDate.getDate() + ' ' + months[minDate.getMonth()] + ' - ' + days[maxDate.getDay()] + ' ' + maxDate.getDate() + ' ' + months[maxDate.getMonth()];
  }

  // Unified shipping line: countdown + delivery date
  (function initShippingFull() {
    var el = qs('[data-pp-shipping-full]');
    if (!el) return;

    var deliveryDate = getShippingDate();

    function update() {
      var now = new Date();
      var spanish = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
      var dow = spanish.getDay();
      var hour = spanish.getHours();

      // Mon-Thu before 18:00 → show countdown
      if (dow >= 1 && dow <= 4 && hour < 18) {
        var target = new Date(spanish);
        target.setHours(18, 0, 0, 0);
        var diff = target - spanish;

        if (diff > 0) {
          var h = Math.floor(diff / 3600000);
          var m = Math.floor((diff % 3600000) / 60000);
          var s = Math.floor((diff % 60000) / 1000);
          var pad = function(n) { return n < 10 ? '0' + n : '' + n; };

          var parts = [];
          if (h > 0) parts.push(h + (h === 1 ? ' hora' : ' horas'));
          if (m > 0) parts.push(m + (m === 1 ? ' minuto' : ' minutos'));
          parts.push(s + (s === 1 ? ' segundo' : ' segundos'));
          el.innerHTML = 'Compra antes de <strong>' + parts.join(' ') + '</strong> y recíbelo el <strong>' + deliveryDate + '</strong>';
          return;
        }
      }

      // No countdown → just show delivery date
      el.innerHTML = 'Compra ahora y recíbelo el <strong>' + deliveryDate + '</strong>';
    }

    update();
    // Use requestAnimationFrame throttled to ~1s for performance
    var lastTick = 0;
    function tick(ts) {
      if (ts - lastTick >= 1000) {
        lastTick = ts;
        update();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  /* ----------------------------------------------------------
     References (resolved once DOM is ready)
  ---------------------------------------------------------- */

  var pdp;                // .pp-pdp  (section root)
  var mainImages;         // .pp-pdp__main-images
  var thumbs;             // NodeList of .pp-pdp__thumb
  var dots;               // NodeList of .pp-pdp__dot  (mobile)
  var priceEl;            // .pp-pdp__price
  var comparePriceEl;     // .pp-pdp__compare-price
  var addToCartBtn;       // .pp-pdp__add-to-cart-btn
  var addToCartText;      // text span inside add-to-cart
  var qtyInput;           // .pp-pdp__qty-input

  function cacheDOM() {
    pdp            = qs('.pp-pdp');
    if (!pdp) return false;
    mainImages     = qs('.pp-pdp__main-images', pdp);
    thumbs         = qsa('.pp-pdp__thumb', pdp);
    dots           = qsa('.pp-pdp__dot', pdp);
    priceEl        = qs('.pp-pdp__price', pdp);
    comparePriceEl = qs('.pp-pdp__compare-price', pdp);
    addToCartBtn   = qs('.pp-pdp__add-to-cart-btn', pdp);
    addToCartText  = addToCartBtn ? qs('span', addToCartBtn) || addToCartBtn : null;
    qtyInput       = qs('.pp-pdp__qty-input', pdp);
    return true;
  }

  /* ----------------------------------------------------------
     1. Variant Selection
  ---------------------------------------------------------- */

  function getVariants() {
    return window.ppProductVariants || [];
  }

  function findVariantBySelectedOptions() {
    var selected = {};
    qsa('.pp-pdp__variant-group', pdp).forEach(function (group) {
      var activeBtn = qs('.pp-pdp__variant-btn.is-active', group);
      if (activeBtn) {
        var optionIndex = group.dataset.optionIndex || group.dataset.optionPosition;
        selected[optionIndex] = activeBtn.dataset.value || activeBtn.textContent.trim();
      }
    });

    var variants = getVariants();
    return variants.find(function (v) {
      return Object.keys(selected).every(function (idx) {
        // options is a 0-based array; optionIndex may be 1-based from Liquid
        var i = parseInt(idx, 10);
        var optVal = v.options[i] || v.options[i - 1];
        return optVal === selected[idx];
      });
    }) || null;
  }

  function updatePrice(variant) {
    if (!priceEl) return;
    if (!variant) {
      priceEl.textContent = '';
      if (comparePriceEl) comparePriceEl.textContent = '';
      return;
    }
    priceEl.textContent = formatMoney(variant.price);
    if (comparePriceEl) {
      if (variant.compare_at_price && variant.compare_at_price > variant.price) {
        comparePriceEl.textContent = formatMoney(variant.compare_at_price);
        comparePriceEl.hidden = false;
      } else {
        comparePriceEl.textContent = '';
        comparePriceEl.hidden = true;
      }
    }
  }

  function updateAddToCartButton(variant) {
    if (!addToCartBtn) return;
    if (!variant) {
      addToCartBtn.disabled = true;
      if (addToCartText) addToCartText.textContent = 'No disponible';
      return;
    }
    if (!variant.available) {
      addToCartBtn.disabled = true;
      if (addToCartText) addToCartText.textContent = 'Agotado';
    } else {
      addToCartBtn.disabled = false;
      if (addToCartText) addToCartText.textContent = 'Agregar al carrito';
    }
  }

  function updateURL(variant) {
    if (!variant) return;
    var url = new URL(window.location.href);
    url.searchParams.set('variant', variant.id);
    window.history.replaceState({}, '', url.toString());
  }

  function scrollGalleryToVariantImage(variant) {
    if (!variant || !variant.featured_image || !variant.featured_image.src || !mainImages) return;
    var src = variant.featured_image.src.replace(/https?:/, '');
    var images = qsa('img', mainImages);
    for (var i = 0; i < images.length; i++) {
      var imgSrc = (images[i].src || images[i].dataset.src || '').replace(/https?:/, '');
      if (imgSrc && src.indexOf(imgSrc.split('?')[0].split('&')[0]) > -1 ||
          imgSrc && imgSrc.indexOf(src.split('?')[0].split('&')[0]) > -1) {
        var target = images[i].closest('.pp-pdp__main-image') || images[i];
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        setActiveThumb(i);
        break;
      }
    }
  }

  function initVariantSelection() {
    if (!pdp) return;

    pdp.addEventListener('click', function (e) {
      var btn = e.target.closest('.pp-pdp__variant-btn');
      if (!btn) return;

      var group = btn.closest('.pp-pdp__variant-group');
      if (group) {
        qsa('.pp-pdp__variant-btn', group).forEach(function (b) {
          b.classList.remove('is-active');
        });
      }
      btn.classList.add('is-active');

      var variant = findVariantBySelectedOptions();
      updatePrice(variant);
      updateAddToCartButton(variant);
      updateURL(variant);
      scrollGalleryToVariantImage(variant);
    });
  }

  /* ----------------------------------------------------------
     2. Gallery Thumbnails
  ---------------------------------------------------------- */

  function setActiveThumb(index) {
    thumbs.forEach(function (t, i) {
      t.classList.toggle('is-active', i === index);
    });
    // Also update dots for mobile
    dots.forEach(function (d, i) {
      d.classList.toggle('is-active', i === index);
    });
  }

  function scrollMainImageTo(index) {
    if (!mainImages) return;
    var targets = qsa('.pp-pdp__main-image', mainImages);
    if (targets[index]) {
      targets[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  }

  function initThumbnails() {
    if (!pdp || !thumbs.length) return;

    pdp.addEventListener('click', function (e) {
      var thumb = e.target.closest('.pp-pdp__thumb');
      if (!thumb) return;
      var index = thumbs.indexOf(thumb);
      if (index === -1) return;
      scrollMainImageTo(index);
      setActiveThumb(index);
    });
  }

  function initThumbnailObserver() {
    if (!mainImages) return;
    var images = qsa('.pp-pdp__main-image', mainImages);
    if (!images.length) return;

    // Desktop: use viewport as root (page scroll reveals images)
    // Mobile: use mainImages as root (horizontal swipe)
    var isMobile = window.innerWidth < 750;
    var observerRoot = isMobile ? mainImages : null;
    var observerThreshold = isMobile ? 0.5 : 0.3;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var idx = images.indexOf(entry.target);
          if (idx !== -1) {
            setActiveThumb(idx);
          }
        }
      });
    }, {
      root: observerRoot,
      threshold: observerThreshold,
      rootMargin: isMobile ? '0px' : '-20% 0px -20% 0px'
    });

    images.forEach(function (img) { observer.observe(img); });
  }

  /* ----------------------------------------------------------
     3. Gallery Mobile Swipe / Dots
  ---------------------------------------------------------- */

  function initMobileDots() {
    if (!mainImages) return;

    // Clicking a dot scrolls to the corresponding image
    if (pdp) {
      pdp.addEventListener('click', function (e) {
        var dot = e.target.closest('.pp-pdp__dot');
        if (!dot) return;
        var index = dots.indexOf(dot);
        if (index === -1) return;
        scrollMainImageTo(index);
        setActiveThumb(index);
      });
    }

    // On scroll, update active dot (handled by the IntersectionObserver above)
    // Additional scroll listener for mobile snap detection
    var onScroll = debounce(function () {
      if (window.innerWidth >= 750) return;
      var images = qsa('.pp-pdp__main-image', mainImages);
      if (!images.length) return;

      var containerRect = mainImages.getBoundingClientRect();
      var centerX = containerRect.left + containerRect.width / 2;
      var closest = 0;
      var closestDist = Infinity;

      images.forEach(function (img, i) {
        var rect = img.getBoundingClientRect();
        var dist = Math.abs(rect.left + rect.width / 2 - centerX);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      });

      setActiveThumb(closest);
    }, 80);

    mainImages.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ----------------------------------------------------------
     4. Accordions (smooth height animation)
  ---------------------------------------------------------- */

  function initAccordions() {
    if (!pdp) return;

    var detailsEls = qsa('details.pp-pdp__accordion', pdp);
    if (!detailsEls.length) {
      detailsEls = qsa('details', pdp);
    }

    var singleOpen = pdp.dataset.accordionSingle !== undefined;

    detailsEls.forEach(function (details) {
      var summary = qs('summary', details);
      var content = summary ? summary.nextElementSibling : null;
      if (!summary || !content) return;

      var animation = null;
      var isClosing = false;
      var isExpanding = false;

      summary.addEventListener('click', function (e) {
        // Close siblings if single-open mode
        if (!details.open && singleOpen) {
          detailsEls.forEach(function (other) {
            if (other !== details && other.open) {
              other.open = false;
            }
          });
        }
      });

      function closeDetails(el) {
        var sum = qs('summary', el);
        if (!sum) { el.open = false; return; }
        var startH = el.offsetHeight + 'px';
        var endH = sum.offsetHeight + 'px';
        el.style.overflow = 'hidden';
        var anim = el.animate(
          { height: [startH, endH] },
          { duration: 250, easing: 'ease-out' }
        );
        anim.onfinish = function () {
          el.open = false;
          el.style.height = '';
          el.style.overflow = '';
        };
      }
    });
  }

  /* ----------------------------------------------------------
     5. AJAX Add to Cart
  ---------------------------------------------------------- */

  function getSelectedVariantId() {
    var variant = findVariantBySelectedOptions();
    if (variant) return variant.id;
    // Fallback: read from button data attribute or URL
    if (addToCartBtn && addToCartBtn.dataset.variantId) {
      return parseInt(addToCartBtn.dataset.variantId, 10);
    }
    var params = new URLSearchParams(window.location.search);
    return params.get('variant') ? parseInt(params.get('variant'), 10) : null;
  }

  function getQuantity() {
    if (qtyInput) {
      var val = parseInt(qtyInput.value, 10);
      return isNaN(val) || val < 1 ? 1 : val;
    }
    return 1;
  }

  function setButtonLoading(loading) {
    if (!addToCartBtn) return;
    if (loading) {
      addToCartBtn.classList.add('is-loading');
      addToCartBtn.disabled = true;
    } else {
      addToCartBtn.classList.remove('is-loading');
      addToCartBtn.disabled = false;
    }
  }

  function showButtonSuccess() {
    if (!addToCartBtn) return;
    addToCartBtn.classList.add('is-success');
    if (addToCartText) addToCartText.textContent = '\u2713';
    setTimeout(function () {
      addToCartBtn.classList.remove('is-success');
      var variant = findVariantBySelectedOptions();
      updateAddToCartButton(variant);
    }, 1500);
  }

  function showButtonError(message) {
    if (!addToCartBtn) return;
    addToCartBtn.classList.add('is-error');
    if (addToCartText) addToCartText.textContent = message || 'Error';
    setTimeout(function () {
      addToCartBtn.classList.remove('is-error');
      var variant = findVariantBySelectedOptions();
      updateAddToCartButton(variant);
    }, 2000);
  }

  function refreshCartDrawer() {
    return fetch('/?sections=cart-drawer,header', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
    .then(function (res) { return res.json(); })
    .then(function (sections) {
      // Update cart drawer contents
      if (sections['cart-drawer']) {
        var drawerEl = qs('cart-drawer-component') ||
                       qs('[data-section-id="cart-drawer"]') ||
                       qs('.cart-drawer');
        if (drawerEl) {
          var tmp = document.createElement('div');
          tmp.innerHTML = sections['cart-drawer'];
          var newDrawerContent = qs('cart-drawer-component', tmp) ||
                                qs('[data-section-id="cart-drawer"]', tmp) ||
                                qs('.cart-drawer', tmp);
          if (newDrawerContent) {
            drawerEl.innerHTML = newDrawerContent.innerHTML;
          }
        }
      }

      // Update header (cart count badges)
      if (sections['header']) {
        var tmp2 = document.createElement('div');
        tmp2.innerHTML = sections['header'];

        // Update all cart count badges
        var newBadges = qsa('.cart-count-badge, [data-cart-count]', tmp2);
        var oldBadges = qsa('.cart-count-badge, [data-cart-count]');
        if (newBadges.length && oldBadges.length) {
          oldBadges.forEach(function (badge, i) {
            if (newBadges[i]) {
              badge.textContent = newBadges[i].textContent;
              badge.hidden = newBadges[i].hidden;
            }
          });
        }
      }
    })
    .catch(function (err) {
      console.warn('[pp-product-main] Failed to refresh cart drawer:', err);
    });
  }

  function openCartDrawer() {
    // Try common cart drawer open patterns
    var drawer = qs('cart-drawer-component') || qs('.cart-drawer');
    if (drawer) {
      // Custom element with open method
      if (typeof drawer.open === 'function') {
        drawer.open();
        return;
      }
      // Try show method
      if (typeof drawer.show === 'function') {
        drawer.show();
        return;
      }
    }

    // Try toggling via details/summary pattern
    var details = qs('details#cart-drawer, details.cart-drawer');
    if (details) {
      details.open = true;
      return;
    }

    // Try dispatching a custom event that the theme might listen for
    document.dispatchEvent(new CustomEvent('cart:open'));

    // Try clicking the cart icon to trigger native drawer
    var cartIcon = qs('[data-cart-toggle], .header__icon--cart, .cart-icon-bubble');
    if (cartIcon) {
      cartIcon.click();
    }
  }

  function addToCart(variantId, quantity) {
    setButtonLoading(true);

    var body = JSON.stringify({
      id: variantId,
      quantity: quantity
    });

    return fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: body
    })
    .then(function (res) {
      if (!res.ok) {
        return res.json().then(function (data) {
          throw new Error(data.description || data.message || 'Error adding to cart');
        });
      }
      return res.json();
    })
    .then(function () {
      setButtonLoading(false);
      showButtonSuccess();
      return refreshCartDrawer();
    })
    .then(function () {
      openCartDrawer();
    })
    .catch(function (err) {
      setButtonLoading(false);
      showButtonError(err.message || 'Error');
      console.error('[pp-product-main] Add to cart failed:', err);
    });
  }

  function initAddToCart() {
    if (!pdp) return;

    pdp.addEventListener('click', function (e) {
      var btn = e.target.closest('.pp-pdp__add-to-cart-btn');
      if (!btn) return;
      e.preventDefault();

      if (btn.disabled || btn.classList.contains('is-loading')) return;

      var variantId = getSelectedVariantId();
      if (!variantId) {
        showButtonError('Selecciona una variante');
        return;
      }

      var quantity = getQuantity();
      addToCart(variantId, quantity);
    });
  }

  /* ----------------------------------------------------------
     6. Quantity Selector
  ---------------------------------------------------------- */

  function updateQuantity(delta) {
    if (!qtyInput) return;
    var current = parseInt(qtyInput.value, 10);
    if (isNaN(current)) current = 1;
    var next = Math.min(99, Math.max(1, current + delta));
    qtyInput.value = next;

    // Dispatch input event in case anything listens
    qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function initQuantitySelector() {
    if (!pdp) return;

    pdp.addEventListener('click', function (e) {
      if (e.target.closest('.pp-pdp__qty-minus')) {
        e.preventDefault();
        updateQuantity(-1);
        return;
      }
      if (e.target.closest('.pp-pdp__qty-plus')) {
        e.preventDefault();
        updateQuantity(1);
        return;
      }
    });

    // Sanitise manual input
    if (qtyInput) {
      qtyInput.addEventListener('change', function () {
        var val = parseInt(qtyInput.value, 10);
        if (isNaN(val) || val < 1) qtyInput.value = 1;
        else if (val > 99) qtyInput.value = 99;
      });
    }
  }

  /* ----------------------------------------------------------
     Init
  ---------------------------------------------------------- */

  function init() {
    if (!cacheDOM()) return;

    initVariantSelection();
    initThumbnails();
    initThumbnailObserver();
    initMobileDots();
    initAccordions();
    initAddToCart();
    initQuantitySelector();

    // Set initial active thumb
    if (thumbs.length) setActiveThumb(0);
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
