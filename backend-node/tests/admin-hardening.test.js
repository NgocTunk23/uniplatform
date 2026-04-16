const request = require('supertest');
const { app } = require('../index');
const prisma = require('../src/config/prisma');
const { generateToken } = require('../src/utils/jwt.util');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('Admin Hardening & Audit Logs Integration Tests', () => {
  let adminToken;
  let userToken;
  let userId;
  let adminUser;

  beforeAll(async () => {
    // 0. Clean DB for isolation
    await prisma.file.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.workspace.deleteMany({});
    await prisma.user.deleteMany({});

    // 1. Setup Admin
    adminUser = await prisma.user.create({
      data: {
        username: 'ah_admin',
        email: 'ah_admin@test.com',
        password: 'password123',
        fullname: 'System Admin',
        role: 'Admin'
      }
    });
    adminToken = generateToken(adminUser.id, adminUser.tokenVersion);

    // 2. Setup regular User
    const user = await prisma.user.create({
      data: {
        username: 'ah_victim',
        email: 'ah_victim@test.com',
        password: 'password123',
        fullname: 'Victim User',
        role: 'Member'
      }
    });
    userId = user.id;
    userToken = generateToken(user.id, user.tokenVersion);
  });

  afterAll(async () => {
    await prisma.systemLog.deleteMany({ where: { actorusername: adminUser.username } });
    await prisma.user.deleteMany({ where: { username: { in: ['ah_admin', 'ah_victim'] } } });
  });

  test('PHASE 1: Admin Dashboard should show Google Drive Quota', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.system).toHaveProperty('googleDrive');
    // If not in REAL mode, it might be 'Quota info unavailable' or the mock
    console.log('--- Google Drive Quota Info ---');
    console.log(res.body.system.googleDrive);
  });

  test('PHASE 2: Admin should be able to Lock User and trigger Audit Log', async () => {
    // Lock user
    const lockRes = await request(app)
      .patch(`/api/admin/users/${userId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'locked' });

    expect(lockRes.status).toBe(200);
    expect(lockRes.body.status).toBe('locked');

    // Verify Audit Log
    const logsRes = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`);

    const lastLog = logsRes.body[0];
    expect(lastLog.actorusername).toBe('ah_admin');
    expect(lastLog.targetresource).toBe('User');
    expect(lastLog.targetid).toBe(userId);
    
    const statusChange = lastLog.changes.find(c => c.field === 'status');
    expect(statusChange.old).toBe('active');
    expect(statusChange.new).toBe('locked');
  });

  test('PHASE 3: Admin should be able to Force Logout User', async () => {
    // 1. User is still active for this test but we will increment version
    await prisma.user.update({ where: { id: userId }, data: { status: 'active' } });

    // 2. Admin Force Logout
    const forceRes = await request(app)
      .post(`/api/admin/users/${userId}/force-logout`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(forceRes.status).toBe(200);
    expect(forceRes.body.tokenVersion).toBeGreaterThan(0);

    // 3. User tries with old token
    const userRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(userRes.status).toBe(401);
    expect(userRes.body.message).toContain('Session expired');
  });
});
