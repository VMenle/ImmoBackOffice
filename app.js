// ImmoBack – Landingpage – app.js
// Erstellt: 16.11.2026
// Mobile Navigation + Testlauf-Formular an den zentralen n8n Formularflow
// (Workflow "MODUL_Formularflow_Kontaktanfragen", Webhook /webhook/kontakt-anfrage).
// Es werden keine Zugangsdaten im Browser benötigt oder gespeichert.

(function () {
  'use strict';

  // ---- Konfiguration --------------------------------------------------------
  var CONFIG = {
    endpoint: 'https://n8n.energy-leisure.de/webhook/kontakt-anfrage',
    formId: 'immoback_testlauf',      // muss im n8n Knoten "Code – Prüfen & bereinigen" unter FORMS stehen
    site: 'immoback',
    consentVersion: '2026-11-16',     // = Stand der Datenschutzerklärung
    timeoutMs: 15000,
    fallbackMail: 'info@energy-leisure.de'
  };

  // ---- Mobile Navigation -----------------------------------------------------
  var menuBtn = document.querySelector('.menu-btn');
  var mobileNav = document.getElementById('mobile-nav');
  if (menuBtn && mobileNav) {
    var setMenu = function (open) {
      mobileNav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    };
    menuBtn.addEventListener('click', function () {
      setMenu(!mobileNav.classList.contains('open'));
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
  }

  // ---- Formular --------------------------------------------------------------
  var form = document.getElementById('trial-form');
  if (!form) return;

  var startedAt = Date.now();
  var submitBtn = document.getElementById('f-submit');
  var statusBox = document.getElementById('f-status');
  var btnText = submitBtn.textContent;
  var sending = false;

  var EMAIL_RE = /^[^\s@<>"'(),;:\\]+@[^\s@<>"'(),;:\\]+\.[A-Za-z]{2,}$/;
  var PHONE_RE = /^[0-9+()\/ .-]{5,40}$/;

  function val(name) {
    var el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  }

  function setInvalid(field, invalid) {
    var box = form.querySelector('[data-field="' + field + '"]');
    if (box) box.classList.toggle('invalid', invalid);
  }

  function clearInvalid() {
    form.querySelectorAll('.field.invalid').forEach(function (f) { f.classList.remove('invalid'); });
  }

  function showStatus(type, text) {
    statusBox.className = 'form-status show ' + type;
    statusBox.textContent = text;
  }

  function validate() {
    clearInvalid();
    var bad = [];
    if (!val('first_name')) bad.push('first_name');
    if (!val('last_name')) bad.push('last_name');
    if (!val('company')) bad.push('company');
    if (!EMAIL_RE.test(val('email'))) bad.push('email');
    if (val('mobile') && !PHONE_RE.test(val('mobile'))) bad.push('mobile');
    if (!val('units')) bad.push('options');
    if (!form.elements.consent.checked) bad.push('consent');
    bad.forEach(function (f) { setInvalid(f, true); });
    return bad;
  }

  form.querySelectorAll('input,select').forEach(function (el) {
    el.addEventListener('input', function () {
      var box = el.closest('.field');
      if (box) box.classList.remove('invalid');
    });
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (sending) return;
    statusBox.className = 'form-status';

    var bad = validate();
    if (bad.length) {
      var first = form.querySelector('.field.invalid input, .field.invalid select');
      if (first) first.focus();
      return;
    }

    var payload = {
      form_id: CONFIG.formId,
      site: CONFIG.site,
      page_url: location.origin + location.pathname,
      contact: {
        first_name: val('first_name'),
        last_name: val('last_name'),
        company: val('company'),
        email: val('email'),
        mobile: val('mobile')
      },
      options: [val('units')],
      message: 'Anfrage Gratis-Testlauf (20 Rechnungen)',
      consent: { given: true, version: CONFIG.consentVersion },
      meta: { hp: val('website'), elapsed_ms: Date.now() - startedAt }
    };

    sending = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gesendet …';

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, CONFIG.timeoutMs) : null;

    fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { status: res.status, data: data || {} };
        });
      })
      .then(function (r) {
        if (r.status === 200 && r.data.success === true) {
          form.reset();
          startedAt = Date.now();
          showStatus('ok', 'Vielen Dank! Ihre Anfrage ist bei uns eingegangen. Wir melden uns in der Regel innerhalb von zwei Werktagen persönlich bei Ihnen.');
          return;
        }
        if (r.status === 429) {
          showStatus('err', 'Sie haben in kurzer Zeit mehrere Anfragen gesendet. Bitte versuchen Sie es in einer Stunde erneut.');
          return;
        }
        if (r.status === 400 && Array.isArray(r.data.fields) && r.data.fields.length) {
          r.data.fields.forEach(function (f) { setInvalid(String(f), true); });
          showStatus('err', 'Bitte prüfen Sie die markierten Felder.');
          return;
        }
        throw new Error('unexpected');
      })
      .catch(function () {
        showStatus('err', 'Die Anfrage konnte leider nicht gesendet werden. Bitte versuchen Sie es später erneut oder schreiben Sie uns direkt an ' + CONFIG.fallbackMail + '.');
      })
      .then(function () {
        if (timer) clearTimeout(timer);
        sending = false;
        submitBtn.disabled = false;
        submitBtn.textContent = btnText;
      });
  });
})();
