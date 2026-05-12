// 1. Force environment for testing BEFORE ANYTHING ELSE
const dotenv = require('dotenv');
dotenv.config();

process.env.JWT_SECRET = 'testsecret';
process.env.NODE_ENV = 'test';

const ERROR_CODES = require('../src/constants/error-codes');

// Dynamically override DATABASE_URL for the whole process before application modules are loaded

const request = require('supertest');
const express = require('express');
const prisma = require('../src/config/prisma');
const { execSync } = require('child_process');

// Load routes and middleware AFTER environment setup
const authRoutes = require('../src/routes/auth.routes');
const errorMiddleware = require('../src/middlewares/error.middleware');

jest.setTimeout(60000);


const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Detailed error logger for test visibility
app.use((err, req, res, next) => {
  if (err.statusCode >= 400) {
    console.error('🧪 TEST DEBUG ERROR:', {
      status: err.statusCode,
      message: err.message,
      errorCode: err.errorCode,
      details: err.details,
      path: req.path
    });
  }
  next(err);
});
app.use(errorMiddleware);

beforeAll(async () => {
  // Ensure fresh DB in correct order
  await prisma.files.deleteMany({});
  await prisma.messages.deleteMany({});
  await prisma.meetingMinutes.deleteMany({});
  await prisma.meeting.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.schedules.deleteMany({});
  await prisma.systemLog.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  if (prisma) {
    await prisma.systemLog.deleteMany({});
    await prisma.schedules.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  }
});

beforeEach(async () => {
  await prisma.systemLog.deleteMany({});
  await prisma.schedules.deleteMany({});
  await prisma.user.deleteMany({});
});

describe('Auth System Unit Tests', () => {
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    fullname: 'Test User'
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.statusCode).toEqual(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.username).toEqual(testUser.username);
    });

    it('should fail to register with an existing email', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(testUser.password, 10);
      await prisma.user.create({
        data: { ...testUser, password: hashedPassword }
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.statusCode).toEqual(400);
      expect(res.body.errorCode).toEqual(ERROR_CODES.AUTH.USER_EXISTS);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create user directly to be sure
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(testUser.password, 10);
      await prisma.user.create({
        data: { ...testUser, password: hashedPassword }
      });
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUser.password
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should fail to login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'wrongpassword'
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body.errorCode).toEqual(ERROR_CODES.AUTH.AUTH_INVALID);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should increment tokenVersion and invalidate old tokens after password reset', async () => {
      const bcrypt = require('bcryptjs');
      const crypto = require('crypto');
      const hashedPassword = await bcrypt.hash(testUser.password, 10);
      await prisma.user.create({
        data: { ...testUser, password: hashedPassword }
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ identifier: testUser.email, password: testUser.password });

      expect(loginRes.statusCode).toEqual(200);
      const oldToken = loginRes.body.token;
      expect(oldToken).toBeDefined();

      const resetTokenRaw = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetTokenRaw).digest('hex');
      const expireAt = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.user.update({
        where: { username: testUser.username },
        data: { resetToken: resetTokenHash, resetTokenExpiry: expireAt }
      });

      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetTokenRaw, newPassword: 'newPassword123' });

      expect(resetRes.statusCode).toEqual(200);
      expect(resetRes.body.message).toContain('Mật khẩu đã được cập nhật');
      expect(resetRes.body.tokenVersion).toBeGreaterThanOrEqual(1);

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${oldToken}`);

      expect(logoutRes.statusCode).toEqual(401);
      expect(logoutRes.body.message).toContain('Session expired');

      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ identifier: testUser.email, password: 'newPassword123' });

      expect(newLoginRes.statusCode).toEqual(200);
      expect(newLoginRes.body.token).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return success message on logout', async () => {
      // Register first and get token
      const regRes = await request(app).post('/api/auth/register').send(testUser);
      const token = regRes.body.token;
      
      if (!token) {
         console.error('❌ Token was not generated in logout test setup:', regRes.body);
      }

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toEqual('User logged out successfully');
    });

    it('should fail to logout without token', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.statusCode).toEqual(401);
    });
  });
});
