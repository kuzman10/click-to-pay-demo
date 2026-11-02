'use strict';

const express = require('express');
const { upsertCart } = require('../domain/cart');

module.exports = (repo) => {
  const router = express.Router();
  router.post('/cart', (req, res) => {
    const { cart, created } = upsertCart(repo, req.body);
    res.status(created ? 201 : 200).json(cart);
  });
  return router;
};
