const ERROR_CODES = require('../constants/error-codes');

/**
 * Centralized error handling middleware
 */
const errorMiddleware = (err, req, res, next) => {
  let { statusCode, message, errorCode } = err;

  if (err?.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File exceeds 50MB';
    errorCode = ERROR_CODES.FILE.FILE_TOO_LARGE;
  }

  if (!statusCode) {
    statusCode = 500;
  }

  res.status(statusCode).json({
    success: false,
    status: statusCode,
    errorCode: errorCode || (statusCode === 500 ? ERROR_CODES.SYSTEM.INTERNAL_SERVER_ERROR : ERROR_CODES.SYSTEM.ERROR),
    message: message || 'Something went wrong',
    details: err.details,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorMiddleware;
