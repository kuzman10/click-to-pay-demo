'use strict';

const crypto = require('node:crypto');
const { badRequest, notFound, conflict } = require('../errors');

const PAYMENT_METHODS = new Set(['CLICK_TO_PAY']);

function hashRequest(body) {
  const normalized = JSON.stringify({ cartId: body.cartId, paymentMethod: body.paymentMethod });
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function toPublic(payment) {
  const { idempotencyKey, requestHash, ...rest } = payment;
  return rest;
}

/**
 * Records a successfully completed Click to Pay checkout. No payment is processed.
 * The same key with the same request returns the existing record before the completed-cart check.
 */
function recordCompletion(repo, { idempotencyKey, body, now = new Date() }) {
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
    throw badRequest('IDEMPOTENCY_KEY_REQUIRED', 'The Idempotency-Key header is required.');
  }
  const { cartId, paymentMethod } = body ?? {};
  if (typeof cartId !== 'string' || cartId === '') {
    throw badRequest('INVALID_CART_ID', 'cartId is required.');
  }
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    throw badRequest('INVALID_PAYMENT_METHOD', 'paymentMethod must be CLICK_TO_PAY.');
  }

  const requestHash = hashRequest({ cartId, paymentMethod });
  const existing = repo.findPaymentByIdempotencyKey(idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw conflict('IDEMPOTENCY_KEY_REUSED', 'The Idempotency-Key was already used for a different request.');
    }
    return { payment: toPublic(existing), created: false };
  }

  const cart = repo.getCart(cartId);
  if (!cart) throw notFound('CART_NOT_FOUND', `Cart ${cartId} does not exist.`);
  if (cart.status === 'COMPLETED' || repo.findPaymentByCartId(cartId)) {
    throw conflict('CART_ALREADY_COMPLETED', 'The demo checkout has already been recorded.');
  }

  const payment = repo.recordCheckout({
    cartId,
    idempotencyKey,
    requestHash,
    paymentMethod,
    createdAt: now.toISOString(),
  });
  return { payment: toPublic(payment), created: true };
}

module.exports = { recordCompletion, toPublic };
