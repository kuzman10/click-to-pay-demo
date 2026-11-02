'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app');

let server;
let base;

beforeEach(async () => {
  server = createApp({ env: {} }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => new Promise((resolve) => server.close(resolve)));

async function call(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const createCart = () => call('POST', '/cart', { items: [{ productId: 'product_001', quantity: 2 }] });
const pay = (cartId, key = 'key-1', paymentMethod = 'CLICK_TO_PAY') =>
  call('POST', '/payment', { cartId, paymentMethod }, { 'Idempotency-Key': key });

test('GET /products returns the static catalog', async () => {
  const { status, body } = await call('GET', '/products');
  assert.equal(status, 200);
  assert.ok(body.products.length > 0);
  assert.equal(body.products[0].currency, 'EUR');
  assert.ok(Number.isInteger(body.products[0].unitPrice));
});

test('POST /cart creates a cart with prices from the catalog', async () => {
  const { status, body } = await createCart();
  assert.equal(status, 201);
  assert.equal(body.status, 'OPEN');
  assert.equal(body.items[0].unitPrice, 4990);
  assert.equal(body.totalAmount, 9980);
  assert.equal(body.currency, 'EUR');
});

test('POST /cart with cartId replaces items and returns 200', async () => {
  const { body: cart } = await createCart();
  const { status, body } = await call('POST', '/cart', {
    cartId: cart.cartId,
    items: [{ productId: 'product_003', quantity: 1 }],
  });
  assert.equal(status, 200);
  assert.equal(body.cartId, cart.cartId);
  assert.equal(body.items.length, 1);
  assert.equal(body.totalAmount, 2490);
});

test('POST /cart validates the request', async () => {
  const cases = [
    [{ items: [] }, 'CART_EMPTY'],
    [{}, 'CART_EMPTY'],
    [{ items: [{ productId: 'nope', quantity: 1 }] }, 'PRODUCT_NOT_FOUND'],
    [{ items: [{ productId: 'product_001', quantity: 0 }] }, 'INVALID_QUANTITY'],
    [{ items: [{ productId: 'product_001', quantity: 1.5 }] }, 'INVALID_QUANTITY'],
    [
      {
        items: [
          { productId: 'product_001', quantity: 1 },
          { productId: 'product_001', quantity: 2 },
        ],
      },
      'DUPLICATE_PRODUCT',
    ],
  ];
  for (const [payload, code] of cases) {
    const { status, body } = await call('POST', '/cart', payload);
    assert.equal(status, 400, code);
    assert.equal(body.error.code, code);
  }
});

test('POST /cart with unknown cartId returns 404', async () => {
  const { status, body } = await call('POST', '/cart', {
    cartId: 'cart_999',
    items: [{ productId: 'product_001', quantity: 1 }],
  });
  assert.equal(status, 404);
  assert.equal(body.error.code, 'CART_NOT_FOUND');
});

test('POST /payment records a demo completion and closes the cart', async () => {
  const { body: cart } = await createCart();
  const { status, body } = await pay(cart.cartId);
  assert.equal(status, 201);
  assert.equal(body.status, 'COMPLETED');
  assert.equal(body.processingMode, 'DEMO');
  assert.equal(body.paymentProcessed, false);
  assert.equal(body.totalAmount, 9980);
  assert.equal(body.idempotencyKey, undefined);

  const update = await call('POST', '/cart', {
    cartId: cart.cartId,
    items: [{ productId: 'product_001', quantity: 1 }],
  });
  assert.equal(update.status, 409);
  assert.equal(update.body.error.code, 'CART_ALREADY_COMPLETED');
});

test('POST /payment replay with same key returns existing record with 200', async () => {
  const { body: cart } = await createCart();
  const first = await pay(cart.cartId, 'same-key');
  const second = await pay(cart.cartId, 'same-key');
  assert.equal(second.status, 200);
  assert.deepEqual(second.body, first.body);

  const { body } = await call('GET', '/payments');
  assert.equal(body.payments.length, 1);
});

test('POST /payment same key with different request returns 409', async () => {
  const { body: a } = await createCart();
  const { body: b } = await createCart();
  await pay(a.cartId, 'k');
  const { status, body } = await pay(b.cartId, 'k');
  assert.equal(status, 409);
  assert.equal(body.error.code, 'IDEMPOTENCY_KEY_REUSED');
});

test('POST /payment with new key on completed cart returns 409', async () => {
  const { body: cart } = await createCart();
  await pay(cart.cartId, 'k1');
  const { status, body } = await pay(cart.cartId, 'k2');
  assert.equal(status, 409);
  assert.equal(body.error.code, 'CART_ALREADY_COMPLETED');
});

test('POST /payment validation errors', async () => {
  const { body: cart } = await createCart();
  const noKey = await call('POST', '/payment', { cartId: cart.cartId, paymentMethod: 'CLICK_TO_PAY' });
  assert.equal(noKey.status, 400);
  assert.equal(noKey.body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');

  const badMethod = await pay(cart.cartId, 'x', 'CARD');
  assert.equal(badMethod.status, 400);

  const missing = await pay('cart_999', 'y');
  assert.equal(missing.status, 404);
});

test('GET /orders and /payments return empty lists initially', async () => {
  assert.deepEqual((await call('GET', '/orders')).body, { orders: [] });
  assert.deepEqual((await call('GET', '/payments')).body, { payments: [] });
});

test('GET /orders returns newest first with items', async () => {
  const { body: c1 } = await createCart();
  const { body: c2 } = await call('POST', '/cart', { items: [{ productId: 'product_002', quantity: 1 }] });
  await pay(c1.cartId, 'a');
  await pay(c2.cartId, 'b');
  const { body } = await call('GET', '/orders');
  assert.equal(body.orders.length, 2);
  assert.equal(body.orders[0].totalAmount, 7990);
  assert.equal(body.orders[0].items[0].name, 'Mechanical keyboard');
  assert.equal(body.orders[0].paymentProcessed, false);
});

test('invalid JSON returns 400', async () => {
  const res = await fetch(base + '/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad',
  });
  assert.equal(res.status, 400);
});

test('SDK script is served from the pinned npm package', async () => {
  const res = await fetch(base + '/vendor/click-to-pay-sdk.js');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /javascript/);
  assert.match(await res.text(), /customElements\.define\("click-to-pay"/);

  const { body } = await call('GET', '/config');
  assert.equal(body.clickToPay.sdkVersion, require('@netceterapx/click-to-pay-sdk/package.json').version);
  assert.equal(body.clickToPay.sdkUrl, '/vendor/click-to-pay-sdk.js');
  assert.equal(body.clickToPay.srcInitiatorId, null);
});
