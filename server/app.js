'use strict';

const path = require('node:path');
const express = require('express');
const { ApiError } = require('./errors');
const { createRepository } = require('./repository');
const sdk = require('./sdk');

function createApp({ repo = createRepository(), env = process.env } = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json({ limit: '50kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  // Netcetera Click to Pay SDK from the npm package (UMD build, not *.es.js).
  app.get('/vendor/click-to-pay-sdk.js', (req, res) => res.sendFile(sdk.scriptPath));

  app.use(require('./routes/products')(repo));
  app.use(require('./routes/cart')(repo));
  app.use(require('./routes/payment')(repo));
  app.use(require('./routes/views')(repo));
  app.use(require('./routes/config')(env));

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } });
  });

  // Express recognizes an error handler only by its four parameters, so `next` must stay.
  // noinspection JSUnusedLocalSymbols
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
    }
    console.error(err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.' } });
  });

  return app;
}

module.exports = { createApp };
