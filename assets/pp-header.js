/**
 * PP Header - JavaScript functionality
 * Handles header height observer, mobile menu, and search overlay
 */

/* ==========================================================================
   Height Observer - Tracks header height for sticky calculations
   ========================================================================== */

class PPHeaderHeightObserver extends HTMLElement {
  constructor() {
    super();
    this.resizeObserver = null;
  }

  connectedCallback() {
    this.variable = this.getAttribute('variable') || 'header';
    this.setupObserver();
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  setupObserver() {
    const target = this.firstElementChild;
    if (!target) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize || entry.target.offsetHeight;
        // For fixed headers, offsetHeight still works; use scrollHeight as fallback
        const finalHeight = height || target.scrollHeight;
        document.documentElement.style.setProperty(`--pp-${this.variable}-height`, `${finalHeight}px`);

        // Reserve space unless: PDP, or first section has hero/image/video
        const isFixed = target.classList.contains('pp-header--sticky') && !target.classList.contains('pp-header--transparent');
        if (isFixed) {
          const isPDP = document.body.classList.contains('template-product');
          const main = document.querySelector('main#MainContent, main.content-for-layout');
          const firstSection = main?.querySelector(':scope > .shopify-section:first-child');
          const hasHero = firstSection?.querySelector('.pp-hero-slider, .pp-no-header-offset, [data-transparent-header], .pp-about__hero, video, [data-hero], .pp-lookbook__hero');
          if (isPDP || hasHero) {
            this.style.minHeight = '';
          } else {
            const marginTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pp-header-margin-top')) || 20;
            this.style.minHeight = `${finalHeight + marginTop * 2}px`;
          }
        }
      }
    });

    this.resizeObserver.observe(target);
  }
}

if (!customElements.get('pp-header-height-observer')) {
  customElements.define('pp-header-height-observer', PPHeaderHeightObserver);
}

/* ==========================================================================
   Mobile Menu
   ========================================================================== */

class PPMobileMenu extends HTMLElement {
  constructor() {
    super();
    this.toggle = null;
    this.backdrop = null;
    this.panel = null;
    this.isOpen = false;
  }

  connectedCallback() {
    this.backdrop = this.querySelector('.pp-mobile-menu__backdrop');
    this.panel = this.querySelector('.pp-mobile-menu__panel');

    // Find the toggle button in the header
    this.toggle = document.querySelector('[aria-controls="pp-mobile-menu"]');

    if (this.toggle) {
      this.toggle.addEventListener('click', this.handleToggle.bind(this));
    }

    if (this.backdrop) {
      this.backdrop.addEventListener('click', this.close.bind(this));
    }

    // Close button inside panel
    const closeBtn = this.querySelector('[data-mobile-menu-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', this.close.bind(this));
    }

    // Handle escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Submenu panel navigation (legacy)
    this.setupSubmenuNavigation();

    // Collapsible accordion navigation (EME Studios style)
    this.setupCollapsibles();
  }

  setupSubmenuNavigation() {
    // Open submenu buttons
    const openButtons = this.querySelectorAll('[data-mobile-submenu-open]');
    openButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const submenuId = btn.getAttribute('data-mobile-submenu-open');
        const submenuPanel = this.querySelector(`[data-mobile-submenu="${submenuId}"]`);
        if (submenuPanel) {
          submenuPanel.classList.add('is-active');
        }
      });
    });

    // Close/back buttons
    const closeButtons = this.querySelectorAll('[data-mobile-submenu-close]');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const submenuPanel = btn.closest('.pp-mobile-menu__submenu-panel');
        if (submenuPanel) {
          submenuPanel.classList.remove('is-active');
        }
      });
    });
  }

  handleToggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.removeAttribute('hidden');
    this.setAttribute('open', '');

    if (this.toggle) {
      this.toggle.setAttribute('aria-expanded', 'true');
    }

    // Add open class to header for styling
    const header = document.querySelector('.pp-header');
    if (header) {
      header.classList.add('pp-header--open');
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Focus first link
    requestAnimationFrame(() => {
      const firstLink = this.querySelector('a, button');
      if (firstLink) firstLink.focus();
    });
  }

  close() {
    this.isOpen = false;
    this.removeAttribute('open');

    if (this.toggle) {
      this.toggle.setAttribute('aria-expanded', 'false');
    }

    // Remove open class from header
    const header = document.querySelector('.pp-header');
    if (header) {
      header.classList.remove('pp-header--open');
    }

    // Restore body scroll
    document.body.style.overflow = '';

    // Return focus to toggle
    if (this.toggle) this.toggle.focus();

    // Close all submenus and collapsibles
    this.closeAllSubmenus();
    this.closeAllCollapsibles();

    // Hide after transition (match 0.5s panel slide)
    setTimeout(() => {
      if (!this.isOpen) {
        this.setAttribute('hidden', '');
      }
    }, 500);
  }

  closeAllSubmenus() {
    const activeSubmenus = this.querySelectorAll('.pp-mobile-menu__submenu-panel.is-active');
    activeSubmenus.forEach(submenu => {
      submenu.classList.remove('is-active');
    });
  }

  setupCollapsibles() {
    // Use event delegation for collapsible toggles
    this.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-collapsible-toggle]');
      if (!toggleBtn) return;

      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';

      // Toggle the clicked accordion
      toggleBtn.setAttribute('aria-expanded', !isExpanded);
    });
  }

  closeAllCollapsibles() {
    const collapsibleBtns = this.querySelectorAll('[data-collapsible-toggle]');
    collapsibleBtns.forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
    });
  }
}

if (!customElements.get('pp-mobile-menu')) {
  customElements.define('pp-mobile-menu', PPMobileMenu);
}

/* ==========================================================================
   Header Search
   ========================================================================== */

class PPHeaderSearch extends HTMLElement {
  constructor() {
    super();
    this.toggle = null;
    this.closeBtn = null;
    this.input = null;
    this.resultsContainer = null;
    this.isOpen = false;
    this.debounceTimer = null;
  }

  connectedCallback() {
    this.closeBtn = this.querySelector('.pp-header-search__close');
    this.input = this.querySelector('.pp-header-search__input');
    this.resultsContainer = this.querySelector('.pp-header-search__results');

    // Find the search link in the header
    const searchLink = document.querySelector('.pp-header__search-link a');
    if (searchLink) {
      searchLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', this.close.bind(this));
    }

    if (this.input) {
      this.input.addEventListener('input', this.handleInput.bind(this));
    }

    // Handle escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  open() {
    this.isOpen = true;
    this.removeAttribute('hidden');
    this.setAttribute('open', '');

    // Add open class to header
    const header = document.querySelector('.pp-header');
    if (header) {
      header.classList.add('pp-header--open');
    }

    // Focus input
    requestAnimationFrame(() => {
      if (this.input) this.input.focus();
    });
  }

  close() {
    this.isOpen = false;
    this.removeAttribute('open');

    // Remove open class from header
    const header = document.querySelector('.pp-header');
    if (header) {
      header.classList.remove('pp-header--open');
    }

    // Clear input and results
    if (this.input) this.input.value = '';
    if (this.resultsContainer) this.resultsContainer.innerHTML = '';

    setTimeout(() => {
      if (!this.isOpen) {
        this.setAttribute('hidden', '');
      }
    }, 300);
  }

  handleInput(e) {
    const query = e.target.value.trim();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (query.length < 2) {
      if (this.resultsContainer) this.resultsContainer.innerHTML = '';
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.fetchResults(query);
    }, 300);
  }

  async fetchResults(query) {
    try {
      const response = await fetch(
        `/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=8`
      );
      const data = await response.json();
      this.renderResults(data.resources.results.products);
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  renderResults(products) {
    if (!this.resultsContainer) return;

    if (!products || products.length === 0) {
      this.resultsContainer.innerHTML = '<p class="pp-header-search__no-results">No se encontraron productos</p>';
      return;
    }

    const html = `
      <div class="pp-header-search__product-grid">
        ${products.map(product => this.renderProductCard(product)).join('')}
      </div>
    `;

    this.resultsContainer.innerHTML = html;
  }

  renderProductCard(product) {
    const image = product.featured_image?.url || product.image;
    const price = this.formatMoney(product.price);
    const comparePrice = product.compare_at_price_max > product.price
      ? this.formatMoney(product.compare_at_price_max)
      : null;

    return `
      <a href="${product.url}" class="pp-header-search__product">
        <div class="pp-header-search__product-image">
          ${image ? `<img src="${image}" alt="${product.title}" loading="lazy">` : ''}
        </div>
        <div class="pp-header-search__product-info">
          <span class="pp-header-search__product-title">${product.title}</span>
          <span class="pp-header-search__product-price">
            ${comparePrice ? `<s>${comparePrice}</s>` : ''} ${price}
          </span>
        </div>
      </a>
    `;
  }

  formatMoney(price) {
    // Shopify search/suggest API returns price as a decimal number (e.g., 229.00 for 229€)
    // Use Shopify.formatMoney if available (expects cents), otherwise format manually
    if (typeof Shopify !== 'undefined' && Shopify.formatMoney) {
      // Shopify.formatMoney expects cents, so multiply by 100
      return Shopify.formatMoney(price * 100);
    }
    // Manual formatting as fallback
    const amount = parseFloat(price).toFixed(2);
    if (typeof Shopify !== 'undefined' && Shopify.currency && Shopify.currency.active) {
      const currency = Shopify.currency.active;
      if (currency === 'EUR') {
        return `${amount.replace('.', ',')} €`;
      } else if (currency === 'GBP') {
        return `£${amount}`;
      } else if (currency === 'USD') {
        return `$${amount}`;
      }
    }
    return `${amount} €`;
  }
}

if (!customElements.get('pp-header-search')) {
  customElements.define('pp-header-search', PPHeaderSearch);
}

/* ==========================================================================
   Cart Drawer Trigger
   ========================================================================== */

function initCartDrawerTrigger() {
  const cartTrigger = document.querySelector('[data-cart-drawer-trigger]');
  if (!cartTrigger) return;

  cartTrigger.addEventListener('click', () => {
    const cartDrawer = document.querySelector('cart-drawer-component');
    if (cartDrawer && typeof cartDrawer.open === 'function') {
      cartDrawer.open();
    }
  });
}

// Initialize immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCartDrawerTrigger);
} else {
  initCartDrawerTrigger();
}

/* ==========================================================================
   Cart Count Update
   ========================================================================== */

// Listen for cart updates (cart:update event from theme)
document.addEventListener('cart:update', (e) => {
  const itemCount = e.detail?.data?.itemCount;
  if (typeof itemCount === 'number') {
    updateCartCount(itemCount);
  } else {
    // Fetch current cart count
    fetch('/cart.js')
      .then(res => res.json())
      .then(cart => updateCartCount(cart.item_count))
      .catch(() => {});
  }
});

function updateCartCount(count) {
  const countElements = document.querySelectorAll('.pp-header__cart-count, [data-cart-count]');
  countElements.forEach(el => {
    el.textContent = count;
  });
}

/* ==========================================================================
   Megamenu Hover Trigger
   ========================================================================== */

function initMegamenuHover() {
  const megamenus = document.querySelectorAll('.pp-header__megamenu');
  let closeTimeout = null;

  megamenus.forEach(megamenu => {
    const summary = megamenu.querySelector('summary');
    const content = megamenu.querySelector('.pp-header__megamenu-content');
    const closeBtn = megamenu.querySelector('[data-megamenu-close]');

    if (!summary || !content) return;

    // Open on hover
    megamenu.addEventListener('mouseenter', () => {
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
      // Close other open megamenus
      megamenus.forEach(other => {
        if (other !== megamenu) other.removeAttribute('open');
      });
      megamenu.setAttribute('open', '');
    });

    // Close on mouse leave with delay
    megamenu.addEventListener('mouseleave', () => {
      closeTimeout = setTimeout(() => {
        megamenu.removeAttribute('open');
      }, 150);
    });

    // Close button click
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        megamenu.removeAttribute('open');
      });
    }

    // Prevent click from toggling (just navigate if link)
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      const link = summary.getAttribute('data-link');
      if (link) {
        window.location.href = link;
      }
    });
  });
}

// Initialize on load and section render
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMegamenuHover);
} else {
  initMegamenuHover();
}
document.addEventListener('shopify:section:load', initMegamenuHover);

/* ==========================================================================
   Megamenu Promo Slider
   ========================================================================== */

function initMegamenuSliders() {
  const sliderContainers = document.querySelectorAll('.pp-header__megamenu-promos--slider');

  sliderContainers.forEach(container => {
    const slider = container.querySelector('.pp-header__megamenu-slider');
    const prevBtn = container.querySelector('.pp-header__megamenu-slider-arrow--left');
    const nextBtn = container.querySelector('.pp-header__megamenu-slider-arrow--right');

    if (!slider || !prevBtn || !nextBtn) return;

    const updateArrows = () => {
      const scrollLeft = slider.scrollLeft;
      const maxScroll = slider.scrollWidth - slider.clientWidth;

      prevBtn.disabled = scrollLeft <= 0;
      nextBtn.disabled = scrollLeft >= maxScroll - 1;
    };

    const scrollAmount = () => {
      const promoCard = slider.querySelector('.pp-header__megamenu-promo');
      return promoCard ? promoCard.offsetWidth + 12 : 150; // 12 is the gap
    };

    prevBtn.addEventListener('click', () => {
      slider.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
      slider.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
    });

    slider.addEventListener('scroll', updateArrows);

    // Initial state
    updateArrows();
  });
}

// Initialize on load and section render
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMegamenuSliders);
} else {
  initMegamenuSliders();
}
document.addEventListener('shopify:section:load', initMegamenuSliders);

/* ==========================================================================
   Transparent Header Offset
   Adds padding to main content when transparent header is active
   unless the first section is a hero slider
   ========================================================================== */

(function initTransparentHeaderOffset() {
  function updateOffset() {
    const header = document.querySelector('.pp-header--transparent');
    const main = document.querySelector('main#MainContent, main.content-for-layout');

    if (!header || !main) {
      document.body.classList.remove('pp-transparent-header-active', 'pp-transparent-header-needs-offset');
      return;
    }

    // Add class to indicate transparent header is active
    document.body.classList.add('pp-transparent-header-active');

    // Check if first section is a hero that should NOT have offset
    const firstSection = main.querySelector(':scope > .shopify-section:first-child');
    const hasHero = firstSection?.querySelector('.pp-hero-slider, .pp-no-header-offset');

    if (hasHero) {
      document.body.classList.remove('pp-transparent-header-needs-offset');
    } else {
      document.body.classList.add('pp-transparent-header-needs-offset');
    }
  }

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateOffset);
  } else {
    updateOffset();
  }

  // Also run after Shopify section renders (for theme editor)
  document.addEventListener('shopify:section:load', updateOffset);
})();

/* ==========================================================================
   Hero Slider Transparent Header Integration
   Automatically enables transparent header mode when hero slider requests it
   ========================================================================== */

(function initHeroTransparentHeader() {
  function checkHeroTransparentHeader() {
    const main = document.querySelector('main#MainContent, main.content-for-layout');
    if (!main) return;

    const firstSection = main.querySelector(':scope > .shopify-section:first-child');
    const heroWithTransparent = firstSection?.querySelector('[data-transparent-header="true"]');
    const header = document.querySelector('.pp-header');

    if (heroWithTransparent && header) {
      // Add transparent class to header if not already present
      header.classList.add('pp-header--transparent', 'pp-header--hero-transparent');
      document.body.classList.add('pp-hero-transparent-header');
    } else if (header) {
      // Remove hero-specific transparent class
      header.classList.remove('pp-header--hero-transparent');
      document.body.classList.remove('pp-hero-transparent-header');
    }
  }

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkHeroTransparentHeader);
  } else {
    checkHeroTransparentHeader();
  }

  // Also run after Shopify section renders (for theme editor)
  document.addEventListener('shopify:section:load', checkHeroTransparentHeader);
})();

/* ==========================================================================
   Header Scroll - Show background on scroll
   ========================================================================== */

(function initHeaderScroll() {
  const scrollThreshold = 50; // px to scroll before showing background

  function handleScroll() {
    const header = document.querySelector('.pp-header');
    if (!header) return;

    if (window.scrollY > scrollThreshold) {
      header.classList.add('pp-header--scrolled');
    } else {
      header.classList.remove('pp-header--scrolled');
    }
  }

  // Throttle scroll events for performance
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      handleScroll(); // Check initial state
      window.addEventListener('scroll', onScroll, { passive: true });
    });
  } else {
    handleScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();

/* ==========================================================================
   PP Predictive Search
   ========================================================================== */
(function() {
  var panel = document.getElementById('pp-search-panel');
  var backdrop = document.querySelector('.pp-search__backdrop');
  var input = document.querySelector('[data-search-input]');
  var resultsEl = document.querySelector('[data-search-results]');
  var openBtns = document.querySelectorAll('[data-search-open]');
  var closeBtn = document.querySelector('[data-search-close]');
  if (!panel || !input) return;

  var debounceTimer = null;
  var controller = null;

  function openSearch() {
    panel.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function() { input.focus(); }, 100);
    /* Close megamenu if open */
    if (window.ppMegamenu) window.ppMegamenu.close();
  }

  function closeSearch() {
    panel.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
    input.value = '';
    resultsEl.innerHTML = '';
  }

  openBtns.forEach(function(btn) { btn.addEventListener('click', openSearch); });
  closeBtn && closeBtn.addEventListener('click', closeSearch);
  backdrop && backdrop.addEventListener('click', closeSearch);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && panel.getAttribute('aria-hidden') === 'false') closeSearch();
  });

  function formatMoney(cents) {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  }

  function doSearch(query) {
    if (controller) controller.abort();
    controller = new AbortController();

    if (!query || query.length < 2) {
      resultsEl.innerHTML = '';
      return;
    }

    fetch('/search/suggest.json?q=' + encodeURIComponent(query) + '&resources[type]=product&resources[limit]=8', {
      signal: controller.signal
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var products = data.resources && data.resources.results && data.resources.results.products || [];
      if (!products.length) {
        resultsEl.innerHTML = '<div class="pp-search__empty">No se encontraron resultados para "' + query + '"</div>';
        return;
      }

      var html = '';
      products.forEach(function(p) {
        var img = p.image ? p.image.replace(/(\.\w+)$/, '_400x$1') : '';
        var price = p.price ? formatMoney(parseFloat(p.price) * 100) : '';
        html += '<a href="' + p.url + '" class="pp-search__item">';
        if (img) html += '<div class="pp-search__item-image"><img src="' + img + '" alt="' + (p.title || '').replace(/"/g, '') + '" loading="lazy"></div>';
        html += '<span class="pp-search__item-title">' + p.title + '</span>';
        if (price) html += '<span class="pp-search__item-price">' + price + '</span>';
        html += '</a>';
      });

      html += '<div class="pp-search__view-all"><a href="/search?q=' + encodeURIComponent(query) + '&type=product">Ver todos los resultados</a></div>';
      resultsEl.innerHTML = html;
    })
    .catch(function(e) {
      if (e.name !== 'AbortError') console.error('Search error:', e);
    });
  }

  input.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      doSearch(input.value.trim());
    }, 300);
  });

  /* Submit form goes to full search page */
  var form = input.closest('form');
  if (form) {
    form.addEventListener('submit', function() {
      closeSearch();
    });
  }
})();
