'use strict';

const path = require('node:path');

// Location and version of the installed @netceterapx/click-to-pay-sdk package.
const packageJsonPath = require.resolve('@netceterapx/click-to-pay-sdk/package.json');
const { version } = require(packageJsonPath);

module.exports = {
  version,
  scriptPath: path.join(path.dirname(packageJsonPath), 'build', 'click-to-pay-sdk.js'),
};
