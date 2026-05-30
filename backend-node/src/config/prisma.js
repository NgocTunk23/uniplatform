const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Prisma Client Singleton for Prisma 6
 * Stable version for MongoDB support
 */
/**
 * Global fix for BigInt serialization in JSON.stringify (used by Express res.json)
 */
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const prisma = new PrismaClient();

module.exports = prisma;
