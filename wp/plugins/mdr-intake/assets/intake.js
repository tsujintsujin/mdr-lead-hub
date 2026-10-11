/* MDR Intake: multi-step form + live results page. No dependencies. */
(function () {
  'use strict';
  var cfg = window.MDR_INTAKE || {};
  var TRACK_KEY = 'mdr_first_touch';

  /* ---------- first-touch tracking (UTM, ad click ids, referrer) ---------- */
  function captureTracking() {
    var q = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
    var now = {};
    var any = false;
    keys.forEach(function (k) { if (q.get(k)) { now[k] = q.get(k); any = true; } });
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(TRACK_KEY) || 'null'); } catch (e) {}
    if (!saved || any) {
      now.referrer = document.referrer && document.referrer.indexOf(location.host) === -1 ? document.referrer : (saved && saved.referrer) || '';
      now.landing_page = location.pathname + location.search;
      try { sessionStorage.setItem(TRACK_KEY, JSON.stringify(now)); } catch (e) {}
      return now;
    }
    return saved;
  }

  /* ---------- form ---------- */
  function initForm(form) {
    var started = Date.now();
    var steps = [].slice.call(form.querySelectorAll('.mdr-step'));
    var bar = form.querySelector('.mdr-progress__bar');
    var current = 0;
    var tracking = captureTracking();

    function show(i, focus) {
      steps.forEach(function (s, n) { s.hidden = n !== i; });
      current = i;
      if (bar) bar.style.transform = 'scaleX(' + ((i + 1) / steps.length) + ')';
      if (focus) {
        var t = steps[i].querySelector('.mdr-step__title');
        if (t) t.focus({ preventScroll: true });
        var top = form.getBoundingClientRect().top + window.scrollY - 24;
        if (form.getBoundingClientRect().top < 0) window.scrollTo({ top: top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }

    function value(name) {
      var els = form.querySelectorAll('[name="' + name + '"]');
      if (!els.length) return '';
      var el = els[0];
      if (el.type === 'checkbox' && els.length > 1 || (el.type === 'checkbox' && el.closest('.mdr-field--checks'))) {
        return [].slice.call(els).filter(function (e) { return e.checked; }).map(function (e) { return e.value; });
      }
      if (el.type === 'radio') { var c = form.querySelector('[name="' + name + '"]:checked'); return c ? c.value : ''; }
      if (el.type === 'checkbox') return el.checked;
      return el.value.trim();
    }

    function setError(field, msg) {
      var p = field.querySelector('.mdr-error');
      field.classList.toggle('is-invalid', !!msg);
      field.querySelectorAll('input,select,textarea').forEach(function (e) { if (msg) e.setAttribute('aria-invalid', 'true'); else e.removeAttribute('aria-invalid'); });
      if (p) { p.textContent = msg || ''; p.hidden = !msg; }
    }

    function check(field) {
      var name = field.getAttribute('data-field');
      var v = value(name);
      var empty = v === '' || v === false || (Array.isArray(v) && !v.length);
      var msg = '';
      if (field.hasAttribute('data-required') && empty) {
        msg = name === 'consent' ? 'Tick the box so we can contact you.' : (Array.isArray(v) ? 'Pick at least one.' : 'This one is needed.');
      } else if (!empty) {
        if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'That email address looks incomplete.';
        if (name === 'zip' && !/^\d{5}$/.test(v)) msg = 'Use a 5-digit ZIP code.';
        if (name === 'ein' && v.replace(/\D/g, '').length !== 9) msg = 'An EIN has 9 digits, like 12-3456789.';
        if (name === 'website' && !/^(https?:\/\/)?[^\s.\/]+\.[^\s]{2,}/i.test(v)) msg = 'Enter the address of your website, like yourpractice.com.';
      }
      setError(field, msg);
      return !msg;
    }

    function checkStep(i) {
      var bad = null;
      steps[i].querySelectorAll('.mdr-field').forEach(function (f) { if (!check(f) && !bad) bad = f; });
      if (bad) { var el = bad.querySelector('input,select,textarea'); if (el) el.focus(); }
      return !bad;
    }

    form.addEventListener('click', function (e) {
      if (e.target.closest('[data-next]')) { if (checkStep(current)) show(current + 1, true); }
      if (e.target.closest('[data-back]')) show(current - 1, true);
    });
    // Clear an error as soon as the person fixes it.
    form.addEventListener('change', function (e) {
      var f = e.target.closest('.mdr-field');
      if (f && f.classList.contains('is-invalid')) check(f);
    });
    // Enter in a text box moves forward instead of submitting half a form.
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && current < steps.length - 1) {
        e.preventDefault();
        if (checkStep(current)) show(current + 1, true);
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!checkStep(current)) return;
      var btn = form.querySelector('[data-submit]');
      var errBox = form.querySelector('.mdr-send-error');
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…'; errBox.hidden = true;

      var fields = {};
      form.querySelectorAll('.mdr-field').forEach(function (f) { var n = f.getAttribute('data-field'); fields[n] = value(n); });

      fetch(cfg.rest + 'submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant: form.getAttribute('data-variant'),
          fields: fields,
          tracking: tracking,
          company_url: (form.querySelector('[name="company_url"]') || {}).value || '',
          elapsed_ms: Date.now() - started
        })
      }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (res) {
          if (res.status === 201 || (res.body && res.body.ok)) {
            location.href = cfg.resultsUrl + '?t=' + encodeURIComponent(res.body.token);
            return;
          }
          if (res.status === 422 && res.body.errors) {
            var first = null;
            Object.keys(res.body.errors).forEach(function (k) {
              var f = form.querySelector('[data-field="' + k + '"]');
              if (f) { setError(f, res.body.errors[k]); if (first === null) first = steps.indexOf(f.closest('.mdr-step')); }
            });
            if (first !== null && first > -1) show(first, true);
          } else {
            errBox.textContent = (res.body && res.body.error) || 'That didn’t go through. Check your connection and try once more.';
            errBox.hidden = false;
          }
          btn.disabled = false; btn.textContent = label;
        })
        .catch(function () { errBox.hidden = false; btn.disabled = false; btn.textContent = label; });
    });

    show(0, false);
  }

  /* ---------- results ---------- */
  var CHECK_LABELS = {
    title: 'Page title', meta_description: 'Meta description', h1: 'One clear main heading',
    https: 'Secure (https)', viewport: 'Works on phones', local_schema: 'Local business details for Google',
    irs: 'Found in IRS nonprofit records', site_https: 'Website loads on https',
    mission_content: 'Enough about your mission on the site', org_type: 'An organization type Google accepts'
  };
  var STAMPS = { likely: 'Likely eligible', almost: 'Almost there', not_yet: 'Not eligible yet' };

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function initResults(box) {
    var variant = box.getAttribute('data-variant');
    var token = new URLSearchParams(location.search).get('t') || '';
    var q = function (s) { return box.querySelector(s); };
    var waitSteps = [].slice.call(box.querySelectorAll('[data-wait]'));
    var t0 = Date.now();
    var shown = false;

    if (!/^[a-f0-9]{32}$/.test(token) || /^0+$/.test(token)) { q('[data-waiting]').hidden = true; q('[data-missing]').hidden = false; return; }

    function markWait(state) {
      // The first three steps are n8n's audit; they finish together when the audit lands.
      var elapsed = (Date.now() - t0) / 1000;
      waitSteps.forEach(function (li, i) {
        var key = li.getAttribute('data-wait');
        var done = key === 'route' ? state === 'routed' : (state === 'audit' || state === 'routed');
        var active = !done && (key === 'route' ? state === 'audit' : elapsed >= i * 2.5);
        li.classList.toggle('is-done', done);
        li.classList.toggle('is-active', active);
        if (done) li.setAttribute('aria-label', li.textContent + ', done');
      });
    }

    function renderPractice(r) {
      q('[data-title]').textContent = 'Your checkup: ' + (r.business || 'your practice');
      q('[data-site]').textContent = (r.website || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
      var s = r.speed || {};
      var score = typeof s.score === 'number' ? Math.round(s.score) : null;
      q('[data-speed]').textContent = score === null ? '–' : score;
      var barEl = q('[data-speed-bar]');
      barEl.style.transform = 'scaleX(' + (score === null ? 0 : score / 100) + ')';
      box.querySelector('.mdr-vital--speed').setAttribute('data-band', score === null ? 'none' : score >= 90 ? 'good' : score >= 50 ? 'ok' : 'poor');
      var meta = [];
      if (s.lcp_s) meta.push('Main content appears after ' + s.lcp_s.toFixed(1) + 's');
      if (s.source === 'estimate') meta.push('Estimated from server response time');
      q('[data-speed-meta]').textContent = meta.join('. ');
      renderChecks(r.checks || []);
      var okCount = (r.checks || []).filter(function (c) { return c.ok; }).length;
      q('[data-checks-score]').textContent = okCount + ' of ' + (r.checks || []).length;
      var un = q('[data-unreachable]');
      if (r.reachable === false) { un.textContent = 'We couldn’t open ' + (r.website || 'your website') + '. It may be down, or it may block automated visits. Your strategist will check it by hand.'; un.hidden = false; }
    }

    function renderGrant(r) {
      q('[data-title]').textContent = r.org_name || 'Your organization';
      var stamp = q('[data-stamp]');
      stamp.textContent = STAMPS[r.verdict] || STAMPS.almost;
      stamp.setAttribute('data-verdict', r.verdict || 'almost');
      renderChecks(r.checks || []);
      var irs = q('[data-irs]');
      if (r.irs && r.irs.found) {
        irs.textContent = 'IRS record: ' + r.irs.name + (r.irs.city ? ', ' + r.irs.city : '') + (r.irs.state ? ', ' + r.irs.state : '') + (r.irs.ein ? ' (EIN ' + r.irs.ein + ')' : '');
        irs.hidden = false;
      }
    }

    function renderChecks(list) {
      var ul = q('[data-checks]');
      ul.textContent = '';
      list.forEach(function (c) {
        var li = el('li', c.ok ? 'is-ok' : 'is-miss');
        li.appendChild(el('span', 'mdr-check__mark', c.ok ? '✓' : '✕')).setAttribute('aria-hidden', 'true');
        var t = el('span', 'mdr-check__text');
        t.appendChild(el('span', 'mdr-check__label', CHECK_LABELS[c.key] || c.label || c.key));
        if (c.detail) t.appendChild(el('span', 'mdr-check__detail', c.detail));
        li.appendChild(t);
        li.appendChild(el('span', 'mdr-sr', c.ok ? ' (passed)' : ' (missing)'));
        ul.appendChild(li);
      });
    }

    function renderRep(r, state) {
      var box2 = q('[data-rep]');
      box2.textContent = '';
      if (state === 'routed' && r.rep && r.rep.name) {
        box2.appendChild(el('p', 'mdr-rep__name', r.rep.name + (r.rep.role ? ', ' + r.rep.role : '')));
        box2.appendChild(el('p', 'mdr-rep__line', variant === 'grant'
          ? r.rep.first + ' will email you within one business day with what comes next.'
          : r.rep.first + ' will go through this with you. Look for an email from them within one business day.'));
      } else {
        box2.appendChild(el('p', 'mdr-rep__line is-pending', variant === 'grant' ? 'Finding your specialist…' : 'Finding the right strategist…'));
      }
      box2.hidden = false;
    }

    function poll() {
      fetch(cfg.rest + 'status/' + token, { cache: 'no-store' })
        .then(function (r) { if (r.status === 404) throw 'missing'; return r.json(); })
        .then(function (d) {
          markWait(d.state);
          if ((d.state === 'audit' || d.state === 'routed') && d.result) {
            if (!shown) {
              shown = true;
              q('[data-waiting]').hidden = true;
              q('[data-done]').hidden = false;
              (variant === 'grant' ? renderGrant : renderPractice)(d.result);
              var h = q('[data-done] .mdr-results__title'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
            }
            renderRep(d.result, d.state);
            if (d.state === 'routed') return; // finished
          }
          var secs = (Date.now() - t0) / 1000;
          if (secs > 120) q('[data-slow]').hidden = false;
          if (secs < 600) setTimeout(poll, secs > 120 ? 5000 : 1500);
        })
        .catch(function (e) {
          if (e === 'missing') { q('[data-waiting]').hidden = true; q('[data-missing]').hidden = false; return; }
          setTimeout(poll, 4000);
        });
    }
    markWait('received');
    var tick = setInterval(function () { if (shown || Date.now() - t0 > 20000) clearInterval(tick); else markWait('received'); }, 500);
    poll();
  }

  document.querySelectorAll('[data-mdr-form]').forEach(initForm);
  document.querySelectorAll('[data-mdr-results]').forEach(initResults);
})();
