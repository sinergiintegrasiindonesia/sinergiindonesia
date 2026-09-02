/* Sinergi Integrasi Indonesia — site behaviour.
   Mobile nav, footer year, and the contact form submission. */

(function () {
  'use strict';

  /* ---- Mobile navigation ---- */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');

  function closeNav() {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && nav.classList.contains('is-open')) closeNav();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        closeNav();
        toggle.focus();
      }
    });
  }

  /* ---- Footer year ---- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---- Contact form ---- */
  var form = document.getElementById('contact-form');
  if (!form) return;

  var status = document.getElementById('form-status');
  var submit = document.getElementById('form-submit');
  var label = form.querySelector('.form__submit-label');
  var FALLBACK = 'contact@sinergiindonesia.com';

  function show(kind, text) {
    status.textContent = text;
    status.className = 'form__status is-shown form__status--' + kind;
    status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function sending(on) {
    submit.disabled = on;
    submit.classList.toggle('is-sending', on);
    label.textContent = on ? 'Sending…' : 'Submit Your Enquiry';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var data = Object.fromEntries(new FormData(form).entries());

    // Validate here too, so the visitor gets an answer without a round trip.
    if (!data.name || !data.name.trim()) return show('err', 'Please tell us your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email || '')) {
      return show('err', 'Please enter a valid email address so we can reply.');
    }
    if (!data.message || !data.message.trim()) return show('err', 'Please add a short message.');

    sending(true);
    status.className = 'form__status';

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (r) {
        if (r.ok) {
          form.reset();
          show('ok', 'Thank you — your message has been sent. We usually reply within one working day.');
        } else {
          show('err', r.body.error || ('Something went wrong. Please email ' + FALLBACK + '.'));
        }
      })
      .catch(function () {
        show('err', 'We could not reach the server. Please email ' + FALLBACK + ' directly.');
      })
      .finally(function () { sending(false); });
  });
})();
