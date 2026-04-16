const request = require('supertest');
const { app, server } = require('../index');
const prisma = require('../src/config/prisma');
const jwt = require('jsonwebtoken');
const io = require('socket.io-client');
const SOCKET_EVENTS = require('../src/constants/socket-events');

let adminToken, leaderToken, memberToken, viewerToken, outsiderToken;
let workspaceId;
let outsiderWorkspaceId;
const TEST_PORT = 5006;

beforeAll(async () => {
  // 1. Clean DB
  await prisma.file.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Create Users
  const users = [
    { username: 'admin_god', role: 'Admin', email: 'admin@test.com' },
    { username: 'leader_alice', role: 'Member', email: 'alice@test.com' },
    { username: 'member_bob', role: 'Member', email: 'bob@test.com' },
    { username: 'viewer_vince', role: 'Member', email: 'vince@test.com' },
    { username: 'outsider_eve', role: 'Member', email: 'eve@test.com' }
  ];

  const tokens = {};
  for (const u of users) {
    const user = await prisma.user.create({
      data: { ...u, password: 'password123', fullname: u.username }
    });
    tokens[u.username] = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
  }

  adminToken = tokens['admin_god'];
  leaderToken = tokens['leader_alice'];
  memberToken = tokens['member_bob'];
  viewerToken = tokens['viewer_vince'];
  outsiderToken = tokens['outsider_eve'];

  // 3. Setup Workspace: Alpha
  const ws = await prisma.workspace.create({
    data: {
      name: 'Workspace Alpha',
      admin: 'leader_alice',
      members: {
        set: [
          { username: 'leader_alice', workspacerole: 'Leader' },
          { username: 'member_bob', workspacerole: 'Member' },
          { username: 'viewer_vince', workspacerole: 'Viewer' }
        ]
      }
    }
  });
  workspaceId = ws.id;

  // 4. Setup Workspace: Beta (Outsider only)
  const ws2 = await prisma.workspace.create({
    data: {
      name: 'Workspace Beta',
      admin: 'outsider_eve',
      members: { set: [{ username: 'outsider_eve', workspacerole: 'Leader' }] }
    }
  });
  outsiderWorkspaceId = ws2.id;

  // Start Server
  await new Promise(r => server.listen(TEST_PORT, r));
});

afterAll(async () => {
  await prisma.$disconnect();
  server.close();
});

describe('Security & RBAC Enforcement Tests', () => {

  describe('Workspace Access Control (Cross-Tenant)', () => {
    test('User should NOT be able to read details of a workspace they are not member of', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('not a member');
    });

    test('System Admin CAN read any workspace', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Workspace Alpha');
    });
  });

  describe('Chat & Socket Security', () => {
    let socket;

    afterEach(() => {
      if (socket) socket.disconnect();
    });

    test('Outsider should be REJECTED when joining workspace room', (done) => {
      socket = io(`http://localhost:${TEST_PORT}`, { auth: { token: outsiderToken } });
      socket.on('connect', () => {
        socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceId);
      });
      socket.on(SOCKET_EVENTS.ERROR, (err) => {
        expect(err.message).toContain('not a member');
        done();
      });
    });

    test('Viewer should be REJECTED when sending a message (Read-only)', (done) => {
      socket = io(`http://localhost:${TEST_PORT}`, { auth: { token: viewerToken } });
      socket.on('connect', () => {
        socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceId);
        // Viewer can join, but cannot send
        setTimeout(() => {
          socket.emit(SOCKET_EVENTS.SEND_MESSAGE, { workspaceId, content: 'Hello' });
        }, 100);
      });
      socket.on(SOCKET_EVENTS.ERROR, (err) => {
        expect(err.message).toContain('Viewers cannot perform this action');
        done();
      });
    });
  });

  describe('Workspace Role Permissions (Leader vs Member)', () => {
    test('Member should NOT be able to add a new member', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ username: 'outsider_eve', workspacerole: 'Member' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Only Leaders');
    });

    test('Leader CAN add a new member', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ username: 'outsider_eve', workspacerole: 'Member' });

      expect(res.status).toBe(200);
    });
  });

  describe('File Deletion Ownership & Admin Override', () => {
    let fileId;

    beforeEach(async () => {
      // Create a file uploaded by Bob
      const file = await prisma.file.create({
        data: {
          uploader: 'member_bob',
          filename: 'bob_secrets.txt',
          ggid: 'mock_ggid_' + Date.now(),
          typefile: 'text/plain'
        }
      });
      fileId = file.id;
    });

    test('Alice (Leader) CANNOT delete Bob\'s file (Only uploader or OS Admin can for now unless linked to message)', async () => {
      // Actually, my implementation ALLOWS Leader to delete if it's linked to a message.
      // Let's test non-linked file first.
      const res = await request(app)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(res.status).toBe(403);
    });

    test('System Admin CAN delete Bob\'s file', async () => {
      const res = await request(app)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('File deleted successfully');
    });
  });

});
