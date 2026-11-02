import { api, formatMoney, formatDateTime } from './api.js';
import { el } from './catalog.js';

const when = formatDateTime;
const empty = (text) => el('p', { className: 'muted', textContent: text });
const mode = (r) => `${r.processingMode}, charged: ${r.paymentProcessed ? 'yes' : 'no'}`;

function table(headers, rows) {
  return el(
    'table',
    { className: 'data-table' },
    el('thead', {}, el('tr', {}, ...headers.map((h) => el('th', { textContent: h })))),
    el('tbody', {}, ...rows),
  );
}

function renderOrders(root, orders) {
  if (orders.length === 0) return root.replaceChildren(empty('No demo orders yet.'));
  const rows = orders.map((o) =>
    el(
      'tr',
      {},
      el('td', { textContent: o.orderId }),
      el('td', { textContent: when(o.createdAt) }),
      el(
        'td',
        {},
        el(
          'ul',
          {},
          ...o.items.map((i) =>
            el('li', { textContent: `${i.name} × ${i.quantity} — ${formatMoney(i.totalAmount, o.currency)}` }),
          ),
        ),
      ),
      el('td', { className: 'num', textContent: formatMoney(o.totalAmount, o.currency) }),
      el('td', { textContent: mode(o) }),
    ),
  );
  root.replaceChildren(table(['Order', 'Time', 'Items', 'Amount', 'Mode'], rows));
}

function renderPayments(root, payments) {
  if (payments.length === 0) return root.replaceChildren(empty('No Click to Pay checkouts recorded yet.'));
  const rows = payments.map((p) =>
    el(
      'tr',
      {},
      el('td', { textContent: p.paymentId }),
      el('td', { textContent: p.cartId }),
      el('td', { textContent: p.status }),
      el('td', { textContent: p.paymentMethod }),
      el('td', { className: 'num', textContent: formatMoney(p.totalAmount, p.currency) }),
      el('td', { textContent: mode(p) }),
      el('td', { textContent: when(p.createdAt) }),
    ),
  );
  root.replaceChildren(table(['Record', 'Cart', 'Status', 'Method', 'Amount', 'Mode', 'Time'], rows));
}

Promise.all([api.getOrders(), api.getPayments()])
  .then(([orders, payments]) => {
    renderOrders(document.getElementById('orders'), orders);
    renderPayments(document.getElementById('payments'), payments);
  })
  .catch((err) => {
    for (const id of ['orders', 'payments']) {
      document.getElementById(id).replaceChildren(el('p', { className: 'error', textContent: err.message }));
    }
  });
