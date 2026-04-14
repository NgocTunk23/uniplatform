const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token for a given user ID
 * @param {string} id - The user ID
 * @returns {string} The signed JWT
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

module.exports = {
  generateToken,
};
