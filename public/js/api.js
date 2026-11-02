// Thin wrapper around fetch calls to our Express API.

export class ApiRequestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, { body, headers } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'The server is not reachable.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = data.error ?? {};
    throw new ApiRequestError(res.status, error.code ?? 'UNKNOWN', error.message ?? res.statusText);
  }
  return data;
}

export const api = {
  getProducts: () => request('GET', '/products').then((d) => d.products),
  saveCart: (items, cartId) => request('POST', '/cart', { body: cartId ? { cartId, items } : { items } }),
  recordPayment: (cartId, idempotencyKey) =>
    request('POST', '/payment', {
      body: { cartId, paymentMethod: 'CLICK_TO_PAY' },
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  getOrders: () => request('GET', '/orders').then((d) => d.orders),
  getPayments: () => request('GET', '/payments').then((d) => d.payments),
  getConfig: () => request('GET', '/config'),
};

export const LOCALE = 'en-US';

export function formatMoney(amount, currency) {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(amount / 100);
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString(LOCALE);
}
