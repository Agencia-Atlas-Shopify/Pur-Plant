/**
 * PP Shipping Countdown
 *
 * Renders a delivery date estimate into #pp-shipping-countdown.
 * Mon–Fri before 18:00 CET: "Compra antes de Xh Ym Zs y recíbelo el ..."
 * Otherwise: "Recíbelo el ..."
 *
 * Runs a single setInterval — if the element disappears (morph) and
 * reappears, the next tick picks it up automatically.
 */
(function () {
  if (window.__ppShippingInit) return;
  window.__ppShippingInit = true;

  var DAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var SHIP_DAYS = 1;

  function addBizDays(date, n) {
    var d = new Date(date);
    while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; }
    return d;
  }

  function spainNow() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  }

  function fmtRange(base) {
    var min = addBizDays(base, SHIP_DAYS);
    var max = addBizDays(base, SHIP_DAYS + 1);
    return DAYS[min.getDay()] + ' ' + min.getDate() + ' - ' + DAYS[max.getDay()] + ' ' + max.getDate() + ' ' + MONTHS[max.getMonth()];
  }

  // Compute both ranges once
  var sp = spainNow();
  var baseToday = new Date(sp);
  var baseNext = new Date(sp);
  do { baseNext.setDate(baseNext.getDate() + 1); } while (baseNext.getDay() === 0 || baseNext.getDay() === 6);

  var rangeToday = fmtRange(baseToday);
  var rangeNext = fmtRange(baseNext);
  var switched = false;

  function update() {
    var el = document.getElementById('pp-shipping-countdown');
    if (!el) return; // element not in DOM yet (or removed by morph) — skip this tick

    var now = spainNow();
    var dow = now.getDay();
    var hour = now.getHours();
    var biz = (dow >= 1 && dow <= 5 && hour < 18);

    if (biz && !switched) {
      var cutoff = new Date(now);
      cutoff.setHours(18, 0, 0, 0);
      var diff = cutoff - now;
      if (diff > 0) {
        var h = Math.floor(diff / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        var s = Math.floor((diff % 60000) / 1000);
        var p = [];
        if (h > 0) p.push(h + (h === 1 ? ' hora' : ' horas'));
        if (m > 0) p.push(m + (m === 1 ? ' minuto' : ' minutos'));
        p.push(s + (s === 1 ? ' segundo' : ' segundos'));
        el.innerHTML = 'Compra antes de <strong>' + p.join(' ') + '</strong> y recíbelo el <strong>' + rangeToday + '</strong>';
        return;
      }
      switched = true;
    }

    el.innerHTML = 'Recíbelo el <strong>' + rangeNext + '</strong>';
  }

  update();
  setInterval(update, 1000);
})();
