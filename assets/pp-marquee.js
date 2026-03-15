/**
 * RC Marquee - Infinite scrolling text component
 * Creates a smooth, infinite scrolling marquee effect
 */

class PPMarqueeText extends HTMLElement {
  constructor() {
    super();
    this.speed = parseFloat(this.getAttribute('speed')) || 0.1;
    this.direction = this.getAttribute('direction') || 'left';
    this.position = 0;
    this.animationId = null;
    this.isPaused = false;
    this.scroller = null;
  }

  connectedCallback() {
    this.setupScroller();
    this.startAnimation();
    this.observeVisibility();
    this.observeHeight();
  }

  disconnectedCallback() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  setupScroller() {
    // Create shadow DOM for scroller part
    const shadow = this.attachShadow({ mode: 'open' });

    // Create scroller container
    this.scroller = document.createElement('div');
    this.scroller.setAttribute('part', 'scroller');
    this.scroller.style.cssText = `
      min-width: max-content;
      display: inline-flex;
      position: relative;
      will-change: transform;
    `;

    // Move children to shadow DOM scroller
    const slot = document.createElement('slot');
    this.scroller.appendChild(slot);

    shadow.appendChild(this.scroller);
  }

  observeVisibility() {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.resumeAnimation();
        } else {
          this.pauseAnimation();
        }
      });
    }, { threshold: 0 });

    this.intersectionObserver.observe(this);
  }

  observeHeight() {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize || entry.target.offsetHeight;
        this.closest('.pp-marquee')?.style.setProperty('--pp-marquee-height', `${height}px`);
      }
    });

    this.resizeObserver.observe(this);
  }

  startAnimation() {
    const animate = () => {
      if (!this.isPaused && !this.checkPaused()) {
        const item = this.querySelector('.pp-marquee__item');
        if (!item) {
          this.animationId = requestAnimationFrame(animate);
          return;
        }

        const itemWidth = item.offsetWidth;

        if (this.direction === 'left') {
          this.position -= this.speed;
          if (this.position <= -itemWidth) {
            this.position += itemWidth;
          }
        } else {
          this.position += this.speed;
          if (this.position >= 0) {
            this.position -= itemWidth;
          }
        }

        if (this.scroller) {
          this.scroller.style.transform = `translateX(${this.position}px)`;
        }
      }

      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  checkPaused() {
    const style = getComputedStyle(this);
    return style.getPropertyValue('--marquee-paused')?.trim() === '1';
  }

  pauseAnimation() {
    this.isPaused = true;
  }

  resumeAnimation() {
    this.isPaused = false;
  }
}

if (!customElements.get('pp-marquee-text')) {
  customElements.define('pp-marquee-text', PPMarqueeText);
}
