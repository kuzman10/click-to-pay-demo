'use strict';

const express = require('express');

module.exports = (repo) => {
  const router = express.Router();
  router.get('/products', (req, res) => {
    res.json({ products: repo.listProducts() });
  });
  return router;
};
