process.env.GOOGLE_DRIVE_MOCK = 'true';

const request = require('supertest');
const { app, server } = require('../index');
const prisma = require('../src/config/prisma');

let token;
let validMessageId;

beforeAll(async () => {
  // Clean up database
  await prisma.file.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create and login user
  await request(app).post('/api/auth/register').send({
    username: 'testadmin',
    password: 'password123',
    fullname: 'Test Admin',
    email: 'testadmin@example.com'
  });

  const loginRes = await request(app).post('/api/auth/login').send({
    identifier: 'testadmin',
    password: 'password123'
  });
  token = loginRes.body.token;

  // 2. Create a dummy workspace and message to get a valid ObjectID
  const workspaceRes = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'System Workspace', admin: 'testadmin' });
  
  const workspaceId = workspaceRes.body.id;

  const messageRes = await prisma.message.create({
    data: {
      workspaceId,
      senderusername: 'testadmin',
      content: 'Sample message'
    }
  });
  validMessageId = messageRes.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  server.close();
});

describe('COMPREHENSIVE FILE API TESTS', () => {

  test('CASE 1: Upload SUCCESS with empty messageid (Fixing the 500 Error reported by user)', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('messageid', '') // Empty string should be sanitized
      .field('meetingminuteid', '')
      .attach('file', Buffer.from('content 1'), 'empty_id_test.txt');

    expect(res.statusCode).toBe(201);
    expect(res.body.file.messageId).toBeNull(); // Prisma stores it as null if undefined
    expect(res.body.file.filename).toBe('empty_id_test.txt');
  });

  test('CASE 2: Upload SUCCESS with VALID messageId', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('messageid', validMessageId)
      .attach('file', Buffer.from('content 2'), 'valid_id_test.txt');

    expect(res.statusCode).toBe(201);
    expect(res.body.file.messageId).toBe(validMessageId);
  });

  test('CASE 3: Upload SUCCESS with INVALID (not 24-char) messageId (Should be sanitized to undefined)', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('messageid', 'short-id') 
      .attach('file', Buffer.from('content 3'), 'invalid_id_test.txt');

    expect(res.statusCode).toBe(201);
    expect(res.body.file.messageId).toBeNull();
  });

  test('CASE 4: Upload FAIL - Unauthorized (No Token)', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .attach('file', Buffer.from('content 4'), 'unauthorized.txt');

    expect(res.statusCode).toBe(401);
  });

  test('CASE 5: Upload FAIL - Missing File', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('messageid', '');

    expect(res.statusCode).toBe(400);
    expect(res.body.errorCode).toBe('FILE_MISSING');
  });

  test('CASE 6: Delete SUCCESS', async () => {
    // First upload a file to delete
    const uploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('content to delete'), 'delete_me.txt');
    
    const fileId = uploadRes.body.file.id;

    const res = await request(app)
      .delete(`/api/files/${fileId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('File deleted successfully');

    // Confirm deleted from DB
    const dbFile = await prisma.file.findUnique({ where: { id: fileId } });
    expect(dbFile).toBeNull();
  });

});
