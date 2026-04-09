/**
 * <pp-free-shipping-bar> — custom element that renders a progress bar toward
 * a free shipping threshold. Values are passed as data-* attributes and are
 * refreshed whenever the theme dispatches `cart:update`.
 */

class PpFreeShippingBar extends HTMLElement {
  constructor() {
    super();
    this._onCartUpdate = this._onCartUpdate.bind(this);
  }

  connectedCallback() {
    this._render();
    document.addEventListener('cart:update', this._onCartUpdate);
  }

  disconnectedCallback() {
    document.removeEventListener('cart:update', this._onCartUpdate);
  }

  async _onCartUpdate(e) {
    const cart = e.detail?.data;
    if (cart && typeof cart.total_price === 'number') {
      this.dataset.totalPrice = String(cart.total_price);
      this._render();
      return;
    }
    // Fallback: fetch fresh cart state
    try {
      const res = await fetch('/cart.js', { credentials: 'same-origin' });
      const json = await res.json();
      this.dataset.totalPrice = String(json.total_price);
      this._render();
    } catch (_) {
      /* noop */
    }
  }

  _render() {
    const threshold = parseInt(this.dataset.threshold || '0', 10);
    const total = parseInt(this.dataset.totalPrice || '0', 10);
    const unreachedTpl = this.dataset.unreached || '';
    const reachedTpl = this.dataset.reached || '';

    const msgEl = this.querySelector('[data-fsbar-message]');
    const fillEl = this.querySelector('[data-fsbar-fill]');
    const iconEl = this.querySelector('[data-fsbar-icon]');
    if (!msgEl || !fillEl || !iconEl) return;

    if (threshold <= 0) {
      // No threshold configured — hide the bar
      this.style.display = 'none';
      return;
    }
    this.style.display = '';

    const reached = total >= threshold;
    const remaining = Math.max(threshold - total, 0);
    const pctRaw = Math.min((total / threshold) * 100, 100);
    const pct = Math.max(pctRaw, 0);

    const remainingFormatted = this._formatMoney(remaining);
    if (reached) {
      msgEl.textContent = reachedTpl;
    } else {
      msgEl.textContent = unreachedTpl.replace('{{ remaining_amount }}', remainingFormatted);
    }

    fillEl.style.width = `calc(${pct}% - 5px)`;
    iconEl.style.left = `${pct}%`;
    this.classList.toggle('pp-fsbar--reached', reached);
  }

  _formatMoney(cents) {
    if (window.Shopify && typeof window.Shopify.formatMoney === 'function') {
      const format = window.theme?.moneyFormat || window.moneyFormat || '€{{amount}}';
      return window.Shopify.formatMoney(cents, format);
    }
    // Simple EUR fallback
    return (
      (cents / 100)
        .toFixed(2)
        .replace('.', ',') + '\u00a0€'
    );
  }
}

if (!customElements.get('pp-free-shipping-bar')) {
  customElements.define('pp-free-shipping-bar', PpFreeShippingBar);
}
