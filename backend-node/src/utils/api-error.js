/**
 * Custom error class for API errors
 */
const ERROR_CODES = require('../constants/error-codes');

class ApiError extends Error {
  constructor(statusCode, message, errorCode = null, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode || (statusCode >= 500 ? ERROR_CODES.SYSTEM.INTERNAL_SERVER_ERROR : ERROR_CODES.SYSTEM.BAD_REQUEST);
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
