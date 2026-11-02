import { api, formatMoney } from './api.js';
import { store } from './store.js';
import { renderCatalog, renderCart } from './catalog.js';
import { showResult, hideResult, showRecordStatus } from './result.js';
import { createClickToPay, CtpErrorCode } from './ctp/ctp-adapter.js';
import { createManualEntry } from './manual-entry.js';

const byId = (id) => document.getElementById(id);

// The module script runs after the DOM is parsed, so elements can be looked up once.
const ui = {
  catalog: byId('catalog'),
  cart: byId('cart'),
  cartError: byId('cart-error'),
  checkout: byId('checkout'),
  ctpStart: byId('ctp-start'),
  ctpCancel: byId('ctp-cancel'),
  ctpStatus: byId('ctp-status'),
  ctpConfig: byId('ctp-config'),
  ctpContainer: byId('ctp-container'),
  ctpError: byId('ctp-error'),
  pendingRecord: byId('pending-record'),
  pendingRetry: byId('pending-retry'),
};

const state = {
  products: [],
  selection: store.getSelection(),
  cart: null,
  locked: false,
  syncSeq: 0,
  ctp: null,
  manualEntry: null,
};

// ---------- Cart ----------

function selectedItems() {
  return Object.entries(state.selection)
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));
}

function setQuantity(productId, quantity) {
  if (state.locked) return;
  const next = { ...state.selection };
  if (quantity > 0) next[productId] = quantity;
  else delete next[productId];
  state.selection = next;
  store.setSelection(next);
  state.cart = null; // the displayed total always comes from the server
  render();
  scheduleSync();
}

let syncTimer = null;
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncCart, 250);
}

function showCartError(message) {
  ui.cartError.textContent = message;
  ui.cartError.hidden = !message;
}

/** Updates the stored cart; an unknown or already completed cart is replaced by a new one. */
async function saveCart(items) {
  const cartId = store.getCartId();
  if (!cartId) return api.saveCart(items);
  try {
    return await api.saveCart(items, cartId);
  } catch (err) {
    if (err.status === 404 || err.code === 'CART_ALREADY_COMPLETED') return api.saveCart(items);
    throw err;
  }
}

/** Sends the selection to the backend; the displayed total always comes from the server response. */
async function syncCart() {
  const seq = ++state.syncSeq;
  const items = selectedItems();
  showCartError('');

  if (items.length === 0) {
    state.cart = null;
    store.setCartId(null);
    render();
    return;
  }

  try {
    const cart = await saveCart(items);
    if (seq !== state.syncSeq) return;
    state.cart = cart;
    store.setCartId(cart.cartId);
  } catch (err) {
    if (seq !== state.syncSeq) return;
    state.cart = null;
    showCartError(`The cart could not be priced: ${err.message}`);
  }
  render();
}

// ---------- Click to Pay ----------

function setLocked(locked) {
  state.locked = locked;
  ui.ctpStart.disabled = locked;
  ui.ctpCancel.hidden = !locked;
  if (!locked) state.manualEntry.reset();
  render();
}

function showCtpError(message) {
  ui.ctpError.textContent = message;
  ui.ctpError.hidden = !message;
}

function setCtpStatus(text) {
  ui.ctpStatus.textContent = text;
}

async function startCheckout() {
  clearTimeout(syncTimer);
  await syncCart();
  const cart = state.cart;
  if (!cart) return;

  hideResult();
  showCtpError('');
  setLocked(true);

  let result;
  try {
    const started = state.ctp.start({
      transaction: { amount: cart.totalAmount, currency: cart.currency, cartId: cart.cartId },
    });
    state.manualEntry.armToggle();
    result = await started;
  } catch (err) {
    state.ctp.destroy();
    setLocked(false);
    setCtpStatus('');
    const prefix = err.code === CtpErrorCode.CANCELLED ? 'Checkout cancelled.' : 'Click to Pay error.';
    showCtpError(`${prefix} ${err.message} You can try again.`);
    return;
  }

  setCtpStatus('');
  ui.ctpCancel.hidden = true;
  state.manualEntry.reset();
  state.ctp.destroy();
  showResult(result);
  await recordCompletion(cart.cartId);
}

/** Records the successful checkout; retries reuse the same key and never start a new SDK checkout. */
async function recordCompletion(cartId) {
  const pending = store.getPendingRecord();
  const idempotencyKey = pending?.cartId === cartId ? pending.idempotencyKey : crypto.randomUUID();
  store.setPendingRecord({ cartId, idempotencyKey });
  showRecordStatus({ state: 'saving' });

  try {
    const payment = await api.recordPayment(cartId, idempotencyKey);
    store.setPendingRecord(null);
    store.clearCheckout();
    state.selection = {};
    state.cart = null;
    state.ctp.destroy();
    setLocked(false);
    showRecordStatus({ state: 'saved', payment });
  } catch (err) {
    const retryable = err.status === 0 || err.status >= 500;
    if (!retryable) store.setPendingRecord(null);
    showRecordStatus({
      state: 'failed',
      message: err.message,
      onRetry: retryable ? () => recordCompletion(cartId) : null,
    });
  }
  render();
}

// ---------- Rendering ----------

function render() {
  const hasSelection = selectedItems().length > 0;
  renderCatalog(ui.catalog, state.products, state.selection, { locked: state.locked, onChange: setQuantity });
  renderCart(ui.cart, state.cart, hasSelection);

  const hasCart = Boolean(state.cart) && hasSelection;
  ui.checkout.hidden = !hasCart && !state.locked;
  if (hasCart) {
    ui.ctpStart.textContent = `Pay ${formatMoney(state.cart.totalAmount, state.cart.currency)} with Click to Pay`;
  }

  ui.pendingRecord.hidden = !store.getPendingRecord() || state.locked;
}

async function init() {
  const [products, config] = await Promise.all([api.getProducts(), api.getConfig()]);
  state.products = products;

  const ctpConfig = config.clickToPay;
  state.ctp = createClickToPay({
    config: ctpConfig,
    container: ui.ctpContainer,
    onStatus: setCtpStatus,
    onConsumerStatus: (status) => {
      // Consumer without a profile or without cards: open the manual entry form right away.
      const identity = status?.consumerIdentity;
      state.manualEntry.prefillEmail(identity?.identityType === 'EMAIL_ADDRESS' ? identity.identityValue : '');
      if (status?.manualCardEntryMandatory) state.manualEntry.open();
    },
  });
  state.manualEntry = createManualEntry({
    onSubmit: (params) => state.ctp.checkoutWithCard(params),
    // UX guide: the component button switches to the secondary (outlined) style while the form is open.
    onOpen: () => state.ctp.setButtonStyle('OUTLINED'),
  });
  ui.ctpConfig.textContent = state.ctp.isConfigured()
    ? `SDK ${ctpConfig.sdkVersion ?? '(version unknown)'} · environment: ${ctpConfig.environment}`
    : 'Click to Pay SDK is not configured (.env).';

  // Drop products that are no longer in the catalog.
  const known = new Set(products.map((p) => p.id));
  state.selection = Object.fromEntries(Object.entries(state.selection).filter(([id]) => known.has(id)));

  ui.ctpStart.addEventListener('click', startCheckout);
  ui.ctpCancel.addEventListener('click', () => state.ctp.cancel());
  ui.pendingRetry.addEventListener('click', () => {
    const pending = store.getPendingRecord();
    if (pending) recordCompletion(pending.cartId);
  });

  render();
  await syncCart();
}

init().catch((err) => {
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = `The application failed to load: ${err.message}`;
  ui.catalog.replaceChildren(p);
});
