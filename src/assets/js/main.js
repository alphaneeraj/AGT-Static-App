(function () {
  'use strict';

  // Mobile menu
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
  }

  // Lead forms → Supabase `leads` table (see supabase/schema.sql).
  // If Supabase isn't configured the form carries static.app's `static-form`
  // attribute instead and this handler stays out of the way.
  var cfg = window.AGT_CONFIG || {};
  var today = new Date().toISOString().slice(0, 10);
  var startedAt = Date.now();

  document.querySelectorAll('form[data-lead-form]').forEach(function (form) {
    form.querySelectorAll('input[type=date]').forEach(function (i) { i.min = today; });
    var depart = form.elements.depart_date, ret = form.elements.return_date;
    if (depart && ret) depart.addEventListener('change', function () { ret.min = depart.value || today; });
    form.querySelectorAll('input[name=trip_type]').forEach(function (r) {
      r.addEventListener('change', function () {
        if (ret) ret.closest('label').style.display = form.elements.trip_type.value === 'One way' ? 'none' : '';
      });
    });

    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = form.querySelector('.form-status');
      var submit = form.querySelector('button[type=submit]');
      var ok = true;
      form.querySelectorAll('[required]').forEach(function (el) {
        var bad = !el.value.trim() || (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value));
        el.classList.toggle('invalid', bad);
        if (bad) ok = false;
      });
      if (!ok) { setStatus(status, 'Please fill in the highlighted fields.', 'err'); return; }
      // Honeypot and too-fast submissions are silently treated as success.
      if (form.elements.website.value || Date.now() - startedAt < 2500) { done(); return; }

      var f = form.elements;
      var lead = {
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        phone: f.phone.value.trim(),
        trip_type: f.trip_type.value,
        origin: f.origin.value.trim(),
        destination: f.destination.value.trim(),
        depart_date: f.depart_date.value || null,
        return_date: (f.trip_type.value !== 'One way' && f.return_date.value) || null,
        passengers: parseInt(f.passengers.value, 10) || null,
        cabin: f.cabin.value,
        message: f.message.value.trim() || null,
        page_url: location.pathname,
        referrer: document.referrer ? document.referrer.slice(0, 300) : null,
        utm: new URLSearchParams(location.search).toString().slice(0, 300) || null
      };

      submit.disabled = true;
      setStatus(status, 'Sending…');
      fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.supabaseAnonKey,
          Authorization: 'Bearer ' + cfg.supabaseAnonKey,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(lead)
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        if (window.gtag) window.gtag('event', 'generate_lead', { value: lead.passengers });
        done();
      }).catch(function () {
        submit.disabled = false;
        setStatus(status, 'Sorry, we could not send your request. Please call ' + (cfg.phone || '') + ' – we are available 24/7.', 'err');
      });
    });
  });

  function setStatus(el, msg, cls) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status' + (cls ? ' ' + cls : '');
  }
  function done() { location.href = '/thank-you/'; }
})();
