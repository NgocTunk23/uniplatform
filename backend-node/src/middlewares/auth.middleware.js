const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');

/**
 * Middleware to protect routes and verify JWT tokens
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      


      // Kiểm tra xem decoded.id (lúc này chứa username) có tồn tại không
      if (!decoded || !decoded.id) {
          throw new ApiError(401, 'Token không hợp lệ hoặc thiếu thông tin định danh', ERROR_CODES.AUTH.AUTH_INVALID);
      }


      // Get user from the token
      const user = await prisma.user.findUnique({
        where: { username: decoded.id },
      });

      if (!user) {
        throw new ApiError(401, 'Not authorized, user not found', ERROR_CODES.AUTH.AUTH_ERROR);
      }

      if (user.status === 'locked') {
        throw new ApiError(401, 'Account is locked', ERROR_CODES.AUTH.AUTH_LOCKED);
      }

      // Check if token version matches (for Force Logout)
      if (typeof decoded.tokenVersion !== 'undefined' && decoded.tokenVersion < user.tokenVersion) {
        throw new ApiError(401, 'Session expired, please login again', ERROR_CODES.AUTH.AUTH_INVALID);
      }

      const { password, ...userData } = user;
      req.user = userData;

      next();
    } catch (error) {
      console.log("JWT Error Details:", error.message);
      next(error instanceof ApiError ? error : new ApiError(401, 'Not authorized, token failed', ERROR_CODES.AUTH.AUTH_INVALID));
    }
  }

  if (!token) {
    next(new ApiError(401, 'Not authorized, no token', ERROR_CODES.AUTH.AUTH_MISSING));
  }
};

/**
 * Middleware to restrict access to certain roles
 * @param {...string} roles - Roles allowed to access the route
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user ? req.user.role : 'Guest'} is not authorized to access this route`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
