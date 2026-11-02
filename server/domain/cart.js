'use strict';

const { badRequest, notFound, conflict } = require('../errors');

const CURRENCY = 'EUR';

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('CART_EMPTY', 'The cart must contain at least one item.');
  }
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || item.productId === '') {
      throw badRequest('INVALID_PRODUCT_ID', 'Each item must have a productId.');
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw badRequest('INVALID_QUANTITY', `Quantity for ${item.productId} must be a positive integer.`);
    }
    if (seen.has(item.productId)) {
      throw badRequest('DUPLICATE_PRODUCT', `Product ${item.productId} is listed more than once.`);
    }
    seen.add(item.productId);
  }
}

/**
 * Creates or updates a cart. The submitted list replaces all previous items,
 * and prices are always taken from the catalog.
 */
function upsertCart(repo, body) {
  const { cartId, items } = body ?? {};
  if (cartId !== undefined && (typeof cartId !== 'string' || cartId === '')) {
    throw badRequest('INVALID_CART_ID', 'cartId must be a non-empty string.');
  }
  validateItems(items);

  let created = true;
  if (cartId !== undefined) {
    const existing = repo.getCart(cartId);
    if (!existing) throw notFound('CART_NOT_FOUND', `Cart ${cartId} does not exist.`);
    if (existing.status === 'COMPLETED') {
      throw conflict('CART_ALREADY_COMPLETED', 'The demo checkout has already been recorded.');
    }
    created = false;
  }

  const lines = items.map(({ productId, quantity }) => {
    const product = repo.findProduct(productId);
    if (!product) throw badRequest('PRODUCT_NOT_FOUND', `Product ${productId} does not exist.`);
    return {
      productId,
      name: product.name,
      quantity,
      unitPrice: product.unitPrice,
      totalAmount: product.unitPrice * quantity,
    };
  });

  const cart = repo.saveCart({
    cartId: created ? repo.newCartId() : cartId,
    status: 'OPEN',
    items: lines,
    totalAmount: lines.reduce((sum, line) => sum + line.totalAmount, 0),
    currency: CURRENCY,
  });
  return { cart, created };
}

module.exports = { upsertCart };
