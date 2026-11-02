'use strict';

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (code, message) => new ApiError(400, code, message);
const notFound = (code, message) => new ApiError(404, code, message);
const conflict = (code, message) => new ApiError(409, code, message);

module.exports = { ApiError, badRequest, notFound, conflict };
