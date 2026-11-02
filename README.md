# click-to-pay-demo

Demo application for the bachelor thesis „Анализа и имплементација Click to Pay концепта у системима електронског пословања“ (*Analysis and Implementation of the Click to Pay Concept in E-Business Systems*).
The frontend is plain HTML/CSS/JavaScript and the backend is Node.js + Express. The Click to Pay integration uses G+D Netcetera SRCi.

> The demo processes no payments. `POST /payment` only records a successfully completed Click to Pay checkout (`processingMode: DEMO`, `paymentProcessed: false`).

## Getting started

```bash
npm install
cp .env.example .env   # fill in the Netcetera sandbox values once available
npm start              # http://localhost:3000
npm test               # API tests (node:test)
```

## Structure

| Path | Purpose |
| --- | --- |
| `server/app.js` | Express app: static frontend, API routes, error handling |
| `server/domain/` | Cart pricing and checkout recording (idempotent) |
| `server/repository/` | Storage layer; in-memory for now, JSON file or database later |
| `server/data/products.json` | Static catalog (EUR, prices in cents) |
| `server/sdk.js` | Location and version of the installed Click to Pay SDK |
| `public/js/ctp/ctp-adapter.js` | **The only place** that knows about the Netcetera SDK |
| `public/js/manual-entry.js` | Manual card entry form passed to the SDK `checkout()` method |
| `public/index.html`, `public/orders.html` | Shop and records overview |

## API

`GET /products`, `POST /cart`, `POST /payment` (`Idempotency-Key` header), `GET /orders`, `GET /payments`, `GET /config` (public part of the Click to Pay configuration).
The SDK script is served at `/vendor/click-to-pay-sdk.js`.

## Integration status

- [x] Catalog, cart, server-side pricing, cart locked during the SDK flow
- [x] Checkout recording with idempotency and retry after failure
- [x] Output display (page memory only) and records overview
- [x] Adapter for the `<click-to-pay>` component (SDK 5.0.0): configuration, events, saved card, manual entry via `checkout()`, display of `checkoutResponseSignature`
- [x] SDK `@netceterapx/click-to-pay-sdk@5.0.0` (public npm, MIT), pinned in `package.json`
- [ ] Mastercard sandbox configuration (`CTP_SRC_INITIATOR_ID`, `CTP_SRCI_DPA_ID`) and test data
- [ ] Browser check with the real SDK: origin/HTTPS on `localhost`, CSP, exact shape of the `paymentError` detail
- [ ] Choice of persistent storage

Until the SDK is configured, the "Pay with Click to Pay" button shows the `SDK_NOT_CONFIGURED` error. Success is never simulated.

## Sources (accessed 2 Nov 2026)

- G+D Netcetera, Click to Pay SRCi documentation: https://srci-docs.prod.srci.cloud.netcetera.com/
  - SDK integration: https://srci-docs.prod.srci.cloud.netcetera.com/sdk-integration/
  - SDK configuration guide: https://srci-docs.prod.srci.cloud.netcetera.com/sdk-config-guide/
  - Mastercard configuration: https://srci-docs.prod.srci.cloud.netcetera.com/sdk-config-mc/
  - Checkout API: https://srci-docs.prod.srci.cloud.netcetera.com/sdk-checkout-api/
  - Checkout response: https://srci-docs.prod.srci.cloud.netcetera.com/sdk-checkout-response/
  - UX guide: https://srci-docs.prod.srci.cloud.netcetera.com/sdk-integration-ux-guide/
  - SRCI Server payload endpoint: https://srci-docs.prod.srci.cloud.netcetera.com/server-payload-endpoint/
- SDK npm package: https://www.npmjs.com/package/@netceterapx/click-to-pay-sdk (version 5.0.0, published 14 Oct 2026)
- Mastercard Click to Pay sandbox profile enrollment: https://sandbox.src.mastercard.com/profile/enroll
