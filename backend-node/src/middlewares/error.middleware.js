const ERROR_CODES = require('../constants/error-codes');

/**
 * Centralized error handling middleware
 */
const errorMiddleware = (err, req, res, next) => {
  let { statusCode, message, errorCode } = err;

  if (!statusCode) {
    statusCode = 500;
  }

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    errorCode: errorCode || (statusCode === 500 ? ERROR_CODES.SYSTEM.INTERNAL_SERVER_ERROR : ERROR_CODES.SYSTEM.ERROR),
    message: message || 'Something went wrong',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorMiddleware;
