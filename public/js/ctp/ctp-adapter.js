// The only module that knows about the G+D Netcetera Click to Pay SRCI SDK.
// The contract follows the documentation (SDK 5.0.0), accessed 2 Nov 2026:
//   https://srci-docs.prod.srci.cloud.netcetera.com/sdk-integration/
//   https://srci-docs.prod.srci.cloud.netcetera.com/sdk-config-guide/
//   https://srci-docs.prod.srci.cloud.netcetera.com/sdk-config-properties/
//   https://srci-docs.prod.srci.cloud.netcetera.com/sdk-config-mc/
//   https://srci-docs.prod.srci.cloud.netcetera.com/sdk-checkout-api/
//   https://srci-docs.prod.srci.cloud.netcetera.com/sdk-checkout-response/
//
// The SDK is the <click-to-pay> web component. It is configured through attributes and
// properties (config, transactionamount) and reports the outcome through events. For manual
// card entry the integrator renders the form and calls checkout() on the same element.
//
// Contract towards the rest of the application:
//   const ctp = createClickToPay({ config, container, onStatus, onConsumerStatus })
//   ctp.isConfigured()                    -> boolean
//   await ctp.start({ transaction })      -> CtpResult (saved card or manual entry)
//   await ctp.checkoutWithCard(input)     -> manual entry; its result also settles start()
//   ctp.setButtonStyle(style), ctp.cancel(), ctp.destroy()
//
//   transaction: { amount (minor units), currency, cartId }
//   CtpResult: { flow: 'SAVED_CARD' | 'NEW_CARD', outputLabel, output, creditCardBrand, completedAt }

export const CtpErrorCode = Object.freeze({
  NOT_CONFIGURED: 'SDK_NOT_CONFIGURED',
  LOAD_FAILED: 'SDK_LOAD_FAILED',
  CANCELLED: 'CANCELLED',
  SDK_ERROR: 'SDK_ERROR',
});

export class CtpError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

// Mastercard: without this value (or if the issuer does not support tokenization) a PAN payload is returned.
const MASTERCARD_DYNAMIC_DATA_TYPE = 'CARD_APPLICATION_CRYPTOGRAM_SHORT_FORM';
const OUTPUT_FIELD = 'checkoutResponseSignature';

let sdkLoadPromise = null;

function loadSdkScript(url) {
  if (customElements.get('click-to-pay')) return Promise.resolve();
  if (!sdkLoadPromise) {
    sdkLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => customElements.whenDefined('click-to-pay').then(resolve);
      script.onerror = () => {
        sdkLoadPromise = null;
        script.remove();
        reject(new CtpError(CtpErrorCode.LOAD_FAILED, `Failed to load the SDK script: ${url}`));
      };
      document.head.appendChild(script);
    });
  }
  return sdkLoadPromise;
}

/** Converts minor units to a dot-separated decimal string, e.g. 9980 -> "99.80". */
export function toDecimalAmount(amount) {
  return (amount / 100).toFixed(2);
}

function buildSchemeConfig(config) {
  return {
    mastercard: {
      srcInitiatorId: config.srcInitiatorId,
      srciDpaId: config.srciDpaId,
      dpaData: {
        dpaName: config.dpaName,
        dpaPresentationName: config.dpaName,
      },
      dpaTransactionOptions: {
        dpaLocale: config.locale,
        dpaBillingPreference: 'NONE',
        dpaShippingPreference: 'NONE',
        paymentOptions: { dynamicDataType: MASTERCARD_DYNAMIC_DATA_TYPE },
      },
    },
  };
}

function describeSdkError(detail) {
  if (!detail) return 'Unknown SDK error.';
  if (typeof detail === 'string') return detail;
  const reason = detail.reason ?? detail.error?.reason;
  const message = detail.message ?? detail.error?.message;
  return [reason, message].filter(Boolean).join(': ') || JSON.stringify(detail);
}

export function createClickToPay({ config, container, onStatus = () => {}, onConsumerStatus = () => {} }) {
  let element = null;
  let pending = null; // { resolve, reject } dok tok traje

  const isConfigured = () => Boolean(config?.sdkUrl && config?.srcInitiatorId && config?.srciDpaId);

  function settle(kind, value) {
    if (!pending) return;
    const { resolve, reject } = pending;
    pending = null;
    if (kind === 'ok') resolve(value);
    else reject(value);
  }

  function toResult(flow, response) {
    return {
      flow,
      outputLabel: OUTPUT_FIELD,
      output: response[OUTPUT_FIELD],
      creditCardBrand: response.creditCardBrand,
      completedAt: new Date().toISOString(),
    };
  }

  /** Handles a CheckoutResponse (from the paymentSuccess event or the checkout() method). */
  function handleCheckoutResponse(flow, response) {
    const action = response?.userAction;
    if (action === 'COMPLETE' && response[OUTPUT_FIELD]) return settle('ok', toResult(flow, response));
    if (action === 'CANCEL') {
      return settle('err', new CtpError(CtpErrorCode.CANCELLED, 'The Click to Pay checkout was cancelled by the user.', response));
    }
    return settle('err', new CtpError(CtpErrorCode.SDK_ERROR, `The checkout did not complete (userAction: ${action}).`, response));
  }

  function createElement(transaction) {
    const el = document.createElement('click-to-pay');
    el.setAttribute('locale', config.locale);
    el.setAttribute('sandbox', String(config.environment !== 'production'));
    el.setAttribute('dcfopeningbehaviour', 'full');
    el.setAttribute('dpapresentationname', config.dpaName);
    if (config.debugLogs) el.setAttribute('debuglogs', 'true');

    // Complex properties can only be set programmatically.
    el.config = buildSchemeConfig(config);
    el.transactionamount = {
      amount: toDecimalAmount(transaction.amount),
      currencyCode: transaction.currency,
    };

    el.addEventListener('consumerStatus', (event) => onConsumerStatus(event.detail));
    el.addEventListener('paymentSuccess', (event) => handleCheckoutResponse('SAVED_CARD', event.detail));
    el.addEventListener('paymentError', (event) => {
      settle('err', new CtpError(CtpErrorCode.SDK_ERROR, describeSdkError(event.detail), event.detail));
    });
    el.addEventListener('generalEvents', (event) => {
      if (event.detail === 'ON_DCF_CANCEL') {
        settle('err', new CtpError(CtpErrorCode.CANCELLED, 'The Click to Pay checkout was cancelled by the user.'));
      } else if (event.detail === 'ON_DCF_CHANGE_CARD') {
        onStatus('Card selection has been reopened.');
      }
    });
    return el;
  }

  async function start({ transaction }) {
    if (pending) throw new CtpError(CtpErrorCode.SDK_ERROR, 'A Click to Pay checkout is already in progress.');
    if (!isConfigured()) {
      throw new CtpError(
        CtpErrorCode.NOT_CONFIGURED,
        'The Click to Pay SDK is not configured. Set CTP_SRC_INITIATOR_ID and CTP_SRCI_DPA_ID in the .env file.',
      );
    }

    onStatus('Loading the Click to Pay SDK…');
    await loadSdkScript(config.sdkUrl);

    destroy();
    const result = new Promise((resolve, reject) => {
      pending = { resolve, reject };
    });
    element = createElement(transaction);
    container.append(element);
    onStatus('');
    return result;
  }

  /**
   * Manual entry: card/consumer enrollment and checkout in a single step (SDK Checkout API).
   * Card data goes only to the SDK and never to our backend.
   */
  async function checkoutWithCard({ card, profileDetails, skipVerificationNextTime }) {
    if (!element || !pending) throw new CtpError(CtpErrorCode.SDK_ERROR, 'The Click to Pay component has not been started.');
    const params = { card };
    if (profileDetails) params.profileDetails = profileDetails;
    if (skipVerificationNextTime) params.skipVerificationNextTime = true;

    onStatus('Processing the card through Click to Pay…');
    try {
      const response = await element.checkout(params);
      handleCheckoutResponse('NEW_CARD', response);
    } catch (err) {
      // A manual entry error does not end the whole flow; the user can correct the data.
      throw new CtpError(CtpErrorCode.SDK_ERROR, describeSdkError(err), err);
    } finally {
      onStatus('');
    }
  }

  /** Sets the component button style: 'FILLED' (default) or 'OUTLINED'. */
  function setButtonStyle(style) {
    element?.setAttribute('buttonstyle', style);
  }

  function cancel() {
    destroy();
    settle('err', new CtpError(CtpErrorCode.CANCELLED, 'The Click to Pay checkout was cancelled.'));
  }

  function destroy() {
    // The documentation names no teardown method; the component is removed from the DOM.
    element?.remove();
    element = null;
  }

  return { isConfigured, start, checkoutWithCard, setButtonStyle, cancel, destroy };
}

/** Decodes the JWS header and payload for display. The signature is NOT verified. */
export function decodeJws(jws) {
  try {
    const [header, payload] = jws.split('.').slice(0, 2).map((part) => {
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    });
    return { header, payload };
  } catch {
    return null;
  }
}
