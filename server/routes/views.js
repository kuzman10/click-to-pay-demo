'use strict';

const express = require('express');
const { toPublic } = require('../domain/checkout');

module.exports = (repo) => {
  const router = express.Router();
  router.get('/orders', (req, res) => {
    res.json({ orders: repo.listOrders() });
  });
  router.get('/payments', (req, res) => {
    res.json({ payments: repo.listPayments().map(toPublic) });
  });
  return router;
};
