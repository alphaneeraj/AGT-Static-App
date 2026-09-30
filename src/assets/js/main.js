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
      if (window.gtag) window.gtag('event', 'generate_lead', { value: lead.passengers });
      postLead(lead, done);
    });
  });

  // static.app's CSP only allows fetch() to static.app, so the lead is sent as a
  // regular form POST (not restricted by connect-src) into a hidden iframe.
  // PostgREST accepts url-encoded inserts; the anon key goes in ?apikey=.
  function postLead(lead, cb) {
    var name = 'lead-sink-' + Date.now();
    var frame = document.createElement('iframe');
    frame.name = name;
    frame.hidden = true;
    frame.setAttribute('aria-hidden', 'true');
    document.body.appendChild(frame);
    var f = document.createElement('form');
    f.method = 'POST';
    f.target = name;
    f.enctype = 'application/x-www-form-urlencoded';
    f.action = cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/leads?apikey=' + encodeURIComponent(cfg.supabaseAnonKey);
    Object.keys(lead).forEach(function (k) {
      if (lead[k] == null || lead[k] === '') return; // empty dates/ints would fail to cast
      var i = document.createElement('input');
      i.type = 'hidden'; i.name = k; i.value = String(lead[k]);
      f.appendChild(i);
    });
    f.hidden = true;
    document.body.appendChild(f);
    var finished = false;
    var finish = function () { if (!finished) { finished = true; cb(); } };
    frame.addEventListener('load', finish);
    setTimeout(finish, 6000);
    f.submit();
  }

  function setStatus(el, msg, cls) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'form-status' + (cls ? ' ' + cls : '');
  }
  function done() { location.href = '/thank-you/'; }
})();
