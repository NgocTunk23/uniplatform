const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token for a given user ID and token version
 * @param {string} id - The user ID
 * @param {number} tokenVersion - The version of the token
 * @returns {string} The signed JWT
 */
const generateToken = (id, tokenVersion = 0) => {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

module.exports = {
  generateToken,
};
