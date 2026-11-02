'use strict';

const express = require('express');
const sdk = require('../sdk');

/**
 * Public part of the Click to Pay configuration for the <click-to-pay> component.
 * srcInitiatorId and srciDpaId are not secrets (they are used in the browser), but they live in .env
 * so they stay out of the repository.
 */
module.exports = (env) => {
  const router = express.Router();
  router.get('/config', (req, res) => {
    res.json({
      clickToPay: {
        environment: env.CTP_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
        sdkUrl: env.CTP_SDK_URL || '/vendor/click-to-pay-sdk.js',
        sdkVersion: sdk.version,
        srcInitiatorId: env.CTP_SRC_INITIATOR_ID || null,
        srciDpaId: env.CTP_SRCI_DPA_ID || null,
        dpaName: env.CTP_DPA_NAME || 'Click to Pay Demo',
        locale: env.CTP_LOCALE || 'en_US',
        debugLogs: env.CTP_DEBUG_LOGS === 'true',
      },
    });
  });
  return router;
};
