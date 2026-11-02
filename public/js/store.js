// localStorage keeps only the product selection, the cartId and a pending completion record.
// Card data and the Click to Pay output are NEVER written here.

const KEYS = {
  selection: 'ctp-demo:selection',
  cartId: 'ctp-demo:cartId',
  pending: 'ctp-demo:pendingRecord',
};

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};
const write = (key, value) =>
  value === null || value === undefined ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value));

export const store = {
  getSelection: () => read(KEYS.selection, {}),
  setSelection: (selection) => write(KEYS.selection, selection),
  getCartId: () => read(KEYS.cartId, null),
  setCartId: (cartId) => write(KEYS.cartId, cartId),
  /** { cartId, idempotencyKey } while the outcome of recording is unknown. */
  getPendingRecord: () => read(KEYS.pending, null),
  setPendingRecord: (pending) => write(KEYS.pending, pending),
  clearCheckout() {
    write(KEYS.selection, null);
    write(KEYS.cartId, null);
  },
};
