'use strict';

const express = require('express');
const { recordCompletion } = require('../domain/checkout');

module.exports = (repo) => {
  const router = express.Router();
  router.post('/payment', (req, res) => {
    const { payment, created } = recordCompletion(repo, {
      idempotencyKey: req.get('Idempotency-Key'),
      body: req.body,
    });
    res.status(created ? 201 : 200).json(payment);
  });
  return router;
};
