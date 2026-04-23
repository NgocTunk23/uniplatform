const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');

/**
 * Middleware to validate request data using Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 */
const validate = (schema) => (req, res, next) => {
  try {
    const validatedData = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    // Assign validated data back to request
    req.body = validatedData.body;
    req.query = validatedData.validatedQuery;
    req.params = validatedData.params;
    
    next();
  } catch (error) {
    const errorMessage = error.errors
      ? error.errors.map((details) => details.message).join(', ')
      : error.message;
    return next(new ApiError(400, errorMessage, ERROR_CODES.VALIDATION.VALIDATION_ERROR));
  }
};

module.exports = validate;
