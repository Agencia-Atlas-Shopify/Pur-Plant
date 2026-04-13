/**
 * PP Defer Third-Party — postpone Klaviyo, Swym, Judge.me, etc. until
 * the user interacts with the page (scroll, click, mouse move, key press)
 * OR after 4s, whichever comes first.
 *
 * Strategy: walk the DOM after DOMContentLoaded, find <script src>
 * tags pointing to known third-party hosts that haven't loaded yet,
 * remove them and re-attach on first interaction.
 *
 * Skip-list: any script with data-pp-keep="true" is left untouched.
 */
(function () {
  if (window.__ppDefer3pInit) return;
  window.__ppDefer3pInit = true;

  // Hosts whose scripts we want to delay
  var DEFER_HOSTS = [
    'static.klaviyo.com',
    'static-tracking.klaviyo.com',
    'fast.klaviyo.com',
    'swymrelay.com',
    'freecdn.swymrelay.com',
    'swym-storage.s3',
    'judge.me',
    'cdn.judge.me',
    'cdn1.judge.me',
    'cache1.judge.me',
    'planet-platform.s3',
    'd3k81ch9hvuctc.cloudfront.net',
  ];

  function shouldDefer(src) {
    if (!src) return false;
    return DEFER_HOSTS.some(function (h) { return src.indexOf(h) !== -1; });
  }

  var deferred = []; // array of {src, attrs} pairs

  function collectAndRemove() {
    var scripts = document.querySelectorAll('script[src]');
    scripts.forEach(function (s) {
      if (s.dataset.ppKeep === 'true') return;
      if (s.dataset.ppDeferred === '1') return;
      if (!shouldDefer(s.src)) return;
      // Capture attributes
      var attrs = {};
      for (var i = 0; i < s.attributes.length; i++) {
        var a = s.attributes[i];
        attrs[a.name] = a.value;
      }
      deferred.push(attrs);
      s.dataset.ppDeferred = '1';
      s.parentNode && s.parentNode.removeChild(s);
    });
  }

  function loadDeferred() {
    if (!deferred.length) return;
    var batch = deferred.slice();
    deferred.length = 0;
    batch.forEach(function (attrs) {
      var s = document.createElement('script');
      Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
      s.async = true;
      document.head.appendChild(s);
    });
  }

  function arm() {
    var fired = false;
    function fire() {
      if (fired) return;
      fired = true;
      ['scroll', 'mousemove', 'touchstart', 'click', 'keydown'].forEach(function (ev) {
        window.removeEventListener(ev, fire, { passive: true });
      });
      loadDeferred();
    }
    ['scroll', 'mousemove', 'touchstart', 'click', 'keydown'].forEach(function (ev) {
      window.addEventListener(ev, fire, { passive: true });
    });
    // Safety net: load anyway after 4s
    setTimeout(fire, 4000);
  }

  // Run as early as possible — before scripts execute
  collectAndRemove();
  // Re-run after DOMContentLoaded in case more scripts were added
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      collectAndRemove();
      arm();
    });
  } else {
    arm();
  }
})();
