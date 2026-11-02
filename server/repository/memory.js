'use strict';

/**
 * In-memory implementation of the storage layer.
 * A persistent store (JSON file or database) will be chosen later and must keep the same interface.
 * recordCheckout represents a single logical transaction.
 */
function createMemoryRepository({ products }) {
  const carts = new Map();
  const payments = new Map(); // paymentId -> completion record
  const orders = new Map(); // orderId -> order
  const counters = { cart: 0, payment: 0, order: 0 };

  const nextId = (type) => `${type}_${String(++counters[type]).padStart(3, '0')}`;
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));

  return {
    listProducts() {
      return clone(products);
    },

    findProduct(id) {
      return clone(products.find((p) => p.id === id));
    },

    newCartId() {
      return nextId('cart');
    },

    getCart(cartId) {
      return clone(carts.get(cartId));
    },

    saveCart(cart) {
      carts.set(cart.cartId, clone(cart));
      return clone(cart);
    },

    findPaymentByIdempotencyKey(key) {
      for (const payment of payments.values()) {
        if (payment.idempotencyKey === key) return clone(payment);
      }
      return undefined;
    },

    findPaymentByCartId(cartId) {
      for (const payment of payments.values()) {
        if (payment.cartId === cartId) return clone(payment);
      }
      return undefined;
    },

    /** Completion record, order and cart closure as one unit. */
    recordCheckout({ cartId, idempotencyKey, requestHash, paymentMethod, createdAt }) {
      const cart = carts.get(cartId);
      const paymentId = nextId('payment');
      const orderId = nextId('order');

      const payment = {
        paymentId,
        orderId,
        cartId,
        idempotencyKey,
        requestHash,
        status: 'COMPLETED',
        paymentMethod,
        totalAmount: cart.totalAmount,
        currency: cart.currency,
        processingMode: 'DEMO',
        paymentProcessed: false,
        createdAt,
      };
      const order = {
        orderId,
        paymentId,
        cartId,
        totalAmount: cart.totalAmount,
        currency: cart.currency,
        processingMode: 'DEMO',
        paymentProcessed: false,
        createdAt,
        items: cart.items.map(({ name, quantity, unitPrice, totalAmount }) => ({
          name,
          quantity,
          unitPrice,
          totalAmount,
        })),
      };

      payments.set(paymentId, payment);
      orders.set(orderId, order);
      carts.set(cartId, { ...cart, status: 'COMPLETED' });
      return clone(payment);
    },

    listPayments() {
      return clone([...payments.values()].reverse());
    },

    listOrders() {
      return clone([...orders.values()].reverse());
    },
  };
}

module.exports = { createMemoryRepository };
