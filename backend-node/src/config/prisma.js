const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Prisma Client Singleton for Prisma 6
 * Stable version for MongoDB support
 */
const prisma = new PrismaClient();

module.exports = prisma;
