// Manual card entry form. Per the Netcetera UX guide the integrator renders the form,
// and the data is passed to the SDK Checkout API (the checkout method on the <click-to-pay> element).
// Values are read only at submit time and are never stored anywhere in the application.

const byId = (id) => document.getElementById(id);
const digits = (value) => String(value ?? '').replace(/\D/g, '');

function luhnValid(pan) {
  let sum = 0;
  for (let i = 0; i < pan.length; i++) {
    let d = Number(pan[pan.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Reads and validates the form; returns checkout() params or throws an Error with a user-facing message. */
function readForm(form) {
  const data = new FormData(form);
  const pan = digits(data.get('pan'));
  const expMonth = digits(data.get('expMonth')).padStart(2, '0');
  const expYear = digits(data.get('expYear'));
  const cvc = digits(data.get('cvc'));

  if (pan.length < 12 || pan.length > 19 || !luhnValid(pan)) throw new Error('The card number is not valid.');
  if (!/^(0[1-9]|1[0-2])$/.test(expMonth)) throw new Error('The expiry month must be between 01 and 12.');
  if (!/^\d{2}$/.test(expYear)) throw new Error('The expiry year must have two digits (YY).');
  if (!/^\d{3,4}$/.test(cvc)) throw new Error('The CVC must have three or four digits.');

  if (!data.get('enroll')) {
    throw new Error(
      'Without saving to Click to Pay the card would be processed as a regular card payment by the payment service provider, which is outside the scope of this demo.',
    );
  }

  const email = String(data.get('email') ?? '').trim();
  const countryCode = digits(data.get('phoneCountryCode'));
  const phoneNumber = digits(data.get('phoneNumber'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (countryCode.length < 1 || countryCode.length > 4) throw new Error('The country calling code must have one to four digits.');
  if (phoneNumber.length < 4 || phoneNumber.length > 14) throw new Error('The mobile number must have 4 to 14 digits.');

  const firstName = String(data.get('firstName') ?? '').trim();
  const lastName = String(data.get('lastName') ?? '').trim();
  const profileDetails = { email, mobileNumber: { countryCode, phoneNumber } };
  if (firstName) profileDetails.firstName = firstName;
  if (lastName) profileDetails.lastName = lastName;
  if (firstName && lastName) profileDetails.fullName = `${firstName} ${lastName}`;

  return {
    card: {
      primaryAccountNumber: pan,
      panExpirationMonth: expMonth,
      panExpirationYear: expYear,
      cardSecurityCode: cvc,
    },
    profileDetails,
    skipVerificationNextTime: Boolean(data.get('rememberMe')),
  };
}

export function createManualEntry({ onSubmit, onOpen }) {
  const form = byId('manual-entry');
  const toggleWrap = byId('manual-entry-toggle-wrap');
  const errorEl = byId('manual-entry-error');
  const profileFields = byId('profile-fields');
  let toggleTimer = null;

  const showError = (message) => {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  };

  function open() {
    form.hidden = false;
    toggleWrap.hidden = true;
    onOpen?.();
    form.querySelector('input[name="pan"]').focus();
  }

  byId('manual-entry-toggle').addEventListener('click', open);

  form.querySelector('input[name="enroll"]').addEventListener('change', (event) => {
    profileFields.disabled = !event.target.checked;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');
    let params;
    try {
      params = readForm(form);
    } catch (err) {
      showError(err.message);
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await onSubmit(params);
    } catch (err) {
      showError(err.message);
    } finally {
      submit.disabled = false;
    }
  });

  return {
    /** UX guide: the manual entry button appears 3300 ms after the component starts loading. */
    armToggle() {
      clearTimeout(toggleTimer);
      toggleTimer = setTimeout(() => {
        if (form.hidden) toggleWrap.hidden = false;
      }, 3300);
    },
    open,
    prefillEmail(email) {
      const input = form.querySelector('input[name="email"]');
      if (email && !input.value) input.value = email;
    },
    reset() {
      clearTimeout(toggleTimer);
      form.reset();
      profileFields.disabled = false;
      showError('');
      form.hidden = true;
      toggleWrap.hidden = true;
    },
  };
}
