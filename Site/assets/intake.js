// Shared intake enhancement for buyer and supplier forms. The original FormSubmit
// action remains available as a fallback until the D1 inbox is enabled.
let turnstileLoader;

function setMessage(form, value) {
  const message = form.querySelector('[data-intake-message]');
  if (message) message.textContent = value;
}

async function loadTurnstile() {
  if (window.turnstile) return;
  if (!turnstileLoader) turnstileLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Security check could not load.'));
    document.head.append(script);
  });
  await turnstileLoader;
}

async function configureTurnstile(form) {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) return;
    const config = await response.json();
    if (!config.turnstile_required) return;
    form.dataset.turnstileRequired = 'true';
    if (!config.turnstile_site_key) {
      form.dataset.turnstileError = 'true';
      setMessage(form, 'Form security is being configured. Please contact hello@evergladeslumber.com for help.');
      return;
    }
    await loadTurnstile();
    const container = document.createElement('div');
    container.className = 'elx-turnstile';
    container.setAttribute('aria-label', 'Security verification');
    const button = form.querySelector('button[type="submit"]');
    button?.before(container);
    form.dataset.turnstileWidget = window.turnstile.render(container, {
      sitekey: config.turnstile_site_key,
      action: 'elx_intake',
      callback: (token) => { form.dataset.turnstileToken = token; setMessage(form, 'Security check complete.'); },
      'expired-callback': () => { form.dataset.turnstileToken = ''; setMessage(form, 'Security check expired. Please verify again.'); },
      'error-callback': () => { form.dataset.turnstileToken = ''; setMessage(form, 'Security check failed to load. Please retry.'); },
    });
  } catch {
    // Server validation remains authoritative; form submission will show a clear
    // challenge error if Turnstile is required but its configuration did not load.
  }
}

document.querySelectorAll('form[data-elx-intake]').forEach((form) => {
  configureTurnstile(form);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const originalLabel = button?.textContent || 'Submit';
    if (form.dataset.turnstileRequired === 'true' && (!form.dataset.turnstileToken || form.dataset.turnstileError === 'true')) {
      setMessage(form, 'Complete the security check before submitting.');
      return;
    }
    if (button) { button.disabled = true; button.textContent = 'Sending securely…'; }
    setMessage(form, 'Saving your request…');
    const fields = Object.fromEntries(new FormData(form).entries());
    form.dataset.submissionId ||= crypto.randomUUID();
    const payload = {
      ...fields,
      kind: form.dataset.elxIntake,
      submission_id: form.dataset.submissionId,
      turnstile_token: form.dataset.turnstileToken || '',
      consent: Boolean(fields.supplier_contact_consent || fields.contact_consent),
    };
    try {
      const response = await fetch('/api/intake', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 503 && result.fallback === true) {
        setMessage(form, 'Using the email submission route…');
        HTMLFormElement.prototype.submit.call(form);
        return;
      }
      if (!response.ok) throw new Error(result.error || 'The request could not be saved. Please try again.');
      location.assign(form.dataset.elxIntake === 'supplier' ? '/supplier-thank-you' : '/thank-you');
    } catch (error) {
      setMessage(form, error.message || 'We could not save that just now. Please retry or email hello@evergladeslumber.com.');
      if (window.turnstile && form.dataset.turnstileWidget) {
        window.turnstile.reset(form.dataset.turnstileWidget);
        form.dataset.turnstileToken = '';
      }
      if (button) { button.disabled = false; button.textContent = originalLabel; }
    }
  });
});
