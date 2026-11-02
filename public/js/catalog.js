import { formatMoney } from './api.js';

export const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

export function renderCatalog(root, products, selection, { locked, onChange }) {
  root.replaceChildren(
    ...products.map((product) => {
      const quantity = selection[product.id] ?? 0;
      const minus = el('button', {
        type: 'button',
        textContent: '−',
        disabled: locked || quantity === 0,
        onclick: () => onChange(product.id, quantity - 1),
      });
      minus.setAttribute('aria-label', `Decrease quantity: ${product.name}`);
      const plus = el('button', {
        type: 'button',
        textContent: '+',
        disabled: locked || quantity >= 99,
        onclick: () => onChange(product.id, quantity + 1),
      });
      plus.setAttribute('aria-label', `Increase quantity: ${product.name}`);

      return el(
        'article',
        { className: 'product' },
        el('img', { src: product.imageUrl, alt: '', width: 320, height: 200 }),
        el('h3', { textContent: product.name }),
        el('p', { className: 'muted', textContent: product.description }),
        el(
          'div',
          { className: 'product-footer' },
          el('strong', { textContent: formatMoney(product.unitPrice, product.currency) }),
          el('div', { className: 'qty' }, minus, el('output', { textContent: String(quantity) }), plus),
        ),
      );
    }),
  );
}

export function renderCart(root, cart, hasSelection) {
  if (!hasSelection) {
    root.replaceChildren(el('p', { className: 'muted', textContent: 'Your cart is empty.' }));
    return;
  }
  if (!cart) {
    root.replaceChildren(el('p', { className: 'muted', textContent: 'Calculating…' }));
    return;
  }
  const rows = cart.items.map((item) =>
    el(
      'tr',
      {},
      el('td', { textContent: `${item.name} × ${item.quantity}` }),
      el('td', { className: 'num', textContent: formatMoney(item.totalAmount, cart.currency) }),
    ),
  );
  root.replaceChildren(
    el(
      'table',
      { className: 'cart-table' },
      el('tbody', {}, ...rows),
      el(
        'tfoot',
        {},
        el(
          'tr',
          {},
          el('th', { textContent: 'Total' }),
          el('th', { className: 'num', textContent: formatMoney(cart.totalAmount, cart.currency) }),
        ),
      ),
    ),
    el('p', { className: 'muted small', textContent: `Cart ${cart.cartId}` }),
  );
}
