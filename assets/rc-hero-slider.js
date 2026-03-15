/**
 * RC Hero Slider - Carousel with autoplay, video support, and touch/swipe
 */

class RCHeroSlider extends HTMLElement {
  constructor() {
    super();
    this.slides = [];
    this.dots = [];
    this.currentIndex = 0;
    this.autoplayInterval = null;
    this.autoplayDuration = 5000;
    this.isPlaying = true;
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.isDragging = false;
    this.dragStartX = 0;
  }

  connectedCallback() {
    this.slides = Array.from(this.querySelectorAll('[data-slide]'));
    this.dots = Array.from(this.querySelectorAll('[data-dot]'));
    this.prevBtn = this.querySelector('[data-prev]');
    this.nextBtn = this.querySelector('[data-next]');
    this.muteBtn = this.querySelector('[data-mute]');
    this.unmuteBtn = this.querySelector('[data-unmute]');

    if (this.slides.length <= 1) return;

    this.autoplayDuration = parseInt(this.dataset.autoplay) || 0;

    this.setupNavigation();
    this.setupDots();
    this.setupTouch();
    this.setupDrag();
    this.setupVolume();
    this.setupAutoplay();
    this.goToSlide(0);
  }

  disconnectedCallback() {
    this.stopAutoplay();
  }

  setupNavigation() {
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.prev());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.next());
    }
  }

  setupDots() {
    this.dots.forEach((dot, index) => {
      dot.addEventListener('click', () => this.goToSlide(index));
    });
  }

  setupTouch() {
    this.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    this.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe();
    }, { passive: true });
  }

  setupDrag() {
    this.addEventListener('mousedown', (e) => {
      // Ignore if clicking on buttons or links
      if (e.target.closest('button, a')) return;

      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.style.cursor = 'grabbing';
      this.style.userSelect = 'none';
    });

    this.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
    });

    this.addEventListener('mouseup', (e) => {
      if (!this.isDragging) return;

      const diff = this.dragStartX - e.clientX;
      this.handleDrag(diff);

      this.isDragging = false;
      this.style.cursor = '';
      this.style.userSelect = '';
    });

    this.addEventListener('mouseleave', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.style.cursor = '';
        this.style.userSelect = '';
      }
    });
  }

  handleDrag(diff) {
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        this.next();
      } else {
        this.prev();
      }
    }
  }

  handleSwipe() {
    const diff = this.touchStartX - this.touchEndX;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        this.next();
      } else {
        this.prev();
      }
    }
  }

  setupVolume() {
    if (!this.muteBtn || !this.unmuteBtn) return;

    this.muteBtn.addEventListener('click', () => this.toggleMute(true));
    this.unmuteBtn.addEventListener('click', () => this.toggleMute(false));
  }

  toggleMute(mute) {
    const videos = this.querySelectorAll('video');
    videos.forEach(video => {
      video.muted = mute;
    });

    if (this.muteBtn && this.unmuteBtn) {
      this.muteBtn.hidden = mute;
      this.unmuteBtn.hidden = !mute;
    }
  }

  setupAutoplay() {
    if (this.autoplayDuration <= 0) return;

    this.classList.add('rc-hero-slider--autoplay');
    this.style.setProperty('--rc-autoplay-duration', `${this.autoplayDuration / 1000}s`);

    this.startAutoplay();

    // Pause on hover/focus
    this.addEventListener('mouseenter', () => this.pauseAutoplay());
    this.addEventListener('mouseleave', () => this.resumeAutoplay());
    this.addEventListener('focusin', () => this.pauseAutoplay());
    this.addEventListener('focusout', () => this.resumeAutoplay());

    // Pause when tab is not visible
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAutoplay();
      } else {
        this.resumeAutoplay();
      }
    });
  }

  startAutoplay() {
    if (this.autoplayDuration <= 0) return;
    this.stopAutoplay();
    this.isPlaying = true;
    this.classList.remove('rc-hero-slider--paused');
    this.autoplayInterval = setInterval(() => this.next(), this.autoplayDuration);
  }

  stopAutoplay() {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
      this.autoplayInterval = null;
    }
  }

  pauseAutoplay() {
    this.isPlaying = false;
    this.classList.add('rc-hero-slider--paused');
    this.stopAutoplay();
  }

  resumeAutoplay() {
    if (this.autoplayDuration > 0) {
      this.startAutoplay();
    }
  }

  prev() {
    const newIndex = this.currentIndex === 0 ? this.slides.length - 1 : this.currentIndex - 1;
    this.goToSlide(newIndex);
  }

  next() {
    const newIndex = this.currentIndex === this.slides.length - 1 ? 0 : this.currentIndex + 1;
    this.goToSlide(newIndex);
  }

  goToSlide(index) {
    // Update slides
    this.slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);

      // Handle videos
      const videos = slide.querySelectorAll('video');
      videos.forEach(video => {
        if (i === index) {
          video.play().catch(() => {});
        } else {
          video.pause();
          video.currentTime = 0;
        }
      });
    });

    // Update dots
    this.dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
    });

    this.currentIndex = index;

    // Restart autoplay timer
    if (this.isPlaying && this.autoplayDuration > 0) {
      this.startAutoplay();
    }
  }
}

if (!customElements.get('rc-hero-slider')) {
  customElements.define('rc-hero-slider', RCHeroSlider);
}
