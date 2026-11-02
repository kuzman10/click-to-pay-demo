'use strict';

const products = require('../data/products.json');
const { createMemoryRepository } = require('./memory');

/** Single place where the storage implementation is chosen. */
function createRepository() {
  return createMemoryRepository({ products });
}

module.exports = { createRepository };
