const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token for a given user identifier and token version
 * @param {string} identifier - The user identifier (username or email)
 * @param {number} tokenVersion - The version of the token
 * @returns {string} The signed JWT
 */
const generateToken = (identifier, tokenVersion = 0) => {
  const tv = tokenVersion ?? 0;
  return jwt.sign({ id: identifier, tokenVersion: tv.toString() }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

module.exports = {
  generateToken,
};
