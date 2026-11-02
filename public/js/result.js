// Displays the Click to Pay output. The output only lives in page memory.
import { formatDateTime } from './api.js';
import { decodeJws } from './ctp/ctp-adapter.js';

const byId = (id) => document.getElementById(id);
const FLOW_LABELS = { SAVED_CARD: 'Saved card', NEW_CARD: 'Manually entered card' };

const ui = {
  section: byId('result'),
  flow: byId('result-flow'),
  brand: byId('result-brand'),
  label: byId('result-label'),
  time: byId('result-time'),
  output: byId('result-output'),
  copy: byId('result-copy'),
  decodedWrap: byId('result-decoded-wrap'),
  decoded: byId('result-decoded'),
  recordStatus: byId('record-status'),
};

let currentOutput = '';

export function showResult(result) {
  currentOutput = typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2);
  ui.flow.textContent = FLOW_LABELS[result.flow] ?? result.flow;
  ui.brand.textContent = result.creditCardBrand ?? '—';
  ui.label.textContent = result.outputLabel;
  ui.time.textContent = formatDateTime(result.completedAt);
  ui.output.textContent = currentOutput;

  const decoded = typeof result.output === 'string' ? decodeJws(result.output) : null;
  ui.decoded.textContent = decoded ? JSON.stringify(decoded, null, 2) : '';
  ui.decodedWrap.hidden = !decoded;
  ui.section.hidden = false;
  ui.section.scrollIntoView({ behavior: 'smooth' });
}

export function hideResult() {
  currentOutput = '';
  ui.output.textContent = '';
  ui.decoded.textContent = '';
  ui.recordStatus.replaceChildren();
  ui.section.hidden = true;
}

export function showRecordStatus({ state, payment, message, onRetry }) {
  const root = ui.recordStatus;
  root.className = `record record-${state}`;
  if (state === 'saving') {
    root.textContent = 'Recording the completed checkout…';
    return;
  }
  if (state === 'saved') {
    root.replaceChildren(
      `Recorded: ${payment.paymentId} / ${payment.orderId} (DEMO, no payment processed). `,
      Object.assign(document.createElement('a'), { href: '/orders.html', textContent: 'View records' }),
    );
    return;
  }
  root.replaceChildren(`The record was not saved. ${message} `);
  if (onRetry) {
    root.append(
      Object.assign(document.createElement('button'), {
        type: 'button',
        textContent: 'Retry recording',
        onclick: onRetry,
      }),
    );
  }
}

ui.copy.addEventListener('click', async () => {
  if (!currentOutput) return;
  try {
    await navigator.clipboard.writeText(currentOutput);
    ui.copy.textContent = 'Copied';
  } catch {
    ui.copy.textContent = 'Copy failed';
  }
  setTimeout(() => (ui.copy.textContent = 'Copy output'), 1500);
});
