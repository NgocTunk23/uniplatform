const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt.util');
const ApiError = require('../utils/api-error');
const ERROR_CODES = require('../constants/error-codes');
const ROLES = require('../constants/roles');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - fullname
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the user
 *         username:
 *           type: string
 *         email:
 *           type: string
 *         fullname:
 *           type: string
 *         role:
 *           type: string
 *           enum: [Admin, Leader, Member]
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - fullname
 *             properties:
 *               username: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               fullname: { type: string }
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: User already exists
 */
const registerUser = async (req, res, next) => {
  const { username, email, password, fullname } = req.body;

  try {
    const userExists = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (userExists) {
      throw new ApiError(400, 'User already exists', ERROR_CODES.AUTH.USER_EXISTS);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        fullname,
        role: ROLES.SYSTEM.MEMBER,
      },
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      token: generateToken(user.id),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate a user & get token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier: { type: string, description: "Email or username" }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid identifier or password
 */
const loginUser = async (req, res, next) => {
  const { identifier, password } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      if (user.status === 'locked') {
        throw new ApiError(401, 'Account is locked', ERROR_CODES.AUTH.AUTH_LOCKED);
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        fullname: user.fullname,
        role: user.role,
        token: generateToken(user.id),
      });
    } else {
      throw new ApiError(401, 'Invalid identifier or password', ERROR_CODES.AUTH.AUTH_INVALID);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile information
 *       404:
 *         description: User not found
 */
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    
    if (user) {
      const { password, ...userData } = user;
      res.json(userData);
    } else {
      throw new ApiError(404, 'User not found', ERROR_CODES.AUTH.USER_NOT_FOUND);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
const logoutUser = async (req, res, next) => {
  res.json({ message: 'User logged out successfully' });
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
};
