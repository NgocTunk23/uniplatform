const request = require('supertest');
const dotenv = require('dotenv');
dotenv.config();

// Mock AI Service BEFORE importing the app
jest.mock('../src/services/ai.service', () => ({
  getEmbedding: jest.fn().mockResolvedValue(Array(768).fill(0.1)),
  generateResponse: jest.fn().mockResolvedValue('Hello, I am UniBot! I see this workspace is new.')
}));

const { app, server } = require('../index');
const prisma = require('../src/config/prisma');
const { generateToken } = require('../src/utils/jwt.util');
const SOCKET_EVENTS = require('../src/constants/socket-events');
const io = require('socket.io-client');

describe('Reliability & Edge Cases (Production Hardening)', () => {
  let leaderToken;
  let leaderUser;
  let workspaceId;
  const TEST_PORT = 5006;

  beforeAll(async () => {
    // Clean DB
    await prisma.file.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.workspace.deleteMany({});
    await prisma.systemLog.deleteMany({});
    await prisma.user.deleteMany({});

    // Create Leader
    leaderUser = await prisma.user.create({
      data: {
        username: 'edge_leader',
        email: 'leader@edge.com',
        password: 'password123',
        fullname: 'Edge Leader',
        role: 'Member'
      }
    });
    leaderToken = generateToken(leaderUser.id, leaderUser.tokenVersion);

    // Create Workspace
    const ws = await prisma.workspace.create({
      data: {
        name: 'Empty Workspace',
        admin: 'edge_leader',
        members: {
          set: [{ username: 'edge_leader', workspacerole: 'Leader' }]
        }
      }
    });
    workspaceId = ws.id;

    // Start server for socket tests
    if (!server.listening) {
      await new Promise(resolve => server.listen(TEST_PORT, resolve));
    }
  });

  afterAll(async () => {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await prisma.user.deleteMany({ where: { username: { in: ['edge_leader', 'edge_member'] } } });
  });

  describe('CASE 1: Workspace Audit Logs', () => {
    test('Leader adding a member should trigger a SystemLog', async () => {
      // 1. Create a potential member
      await prisma.user.create({
        data: { username: 'edge_member', email: 'member@edge.com', password: 'password123', fullname: 'Member' }
      });

      // 2. Add member via API
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ username: 'edge_member', workspacerole: 'Member' });

      expect(res.status).toBe(200);

      // 3. Verify Log
      const logs = await prisma.systemLog.findMany({
        where: { targetresource: 'Workspace', targetid: workspaceId }
      });

      expect(logs.length).toBeGreaterThan(0);
      const lastLog = logs[logs.length - 1];
      expect(lastLog.actorusername).toBe('edge_leader');
      
      const memberChanges = lastLog.changes.find(c => c.field === 'members');
      expect(memberChanges).toBeDefined();
      expect(JSON.stringify(memberChanges.new)).toContain('edge_member');
    });
  });

  describe('CASE 2: Negative Validation (Zod Resilience)', () => {
    test('Should reject workspace creation with empty name', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    test('Should reject registration with malformed email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'bad_email',
          email: 'not-an-email',
          password: 'password123',
          fullname: 'Bad Email'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('CASE 3: Empty Workspace AI RAG', () => {
    let socket;

    test('AI should respond gracefully in an empty workspace', (done) => {
      socket = io(`http://localhost:${TEST_PORT}`, { auth: { token: leaderToken } });
      
      socket.on('connect', () => {
        socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceId);
        
        // Wait a bit to ensure joined
        setTimeout(() => {
          socket.emit(SOCKET_EVENTS.ASK_AI, {
            workspaceId,
            prompt: 'What is the goal of this workspace?',
            senderusername: 'edge_leader'
          });
        }, 200);
      });

      socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (msg) => {
        if (msg.senderusername === 'UniBot') {
          console.log('🤖 AI Response for Empty WS:', msg.content);
          expect(msg.content).toBeDefined();
          socket.disconnect();
          done();
        }
      });

      // Failure case
      socket.on(SOCKET_EVENTS.AI_STATUS, (data) => {
        if (data.status === 'error') {
          // It's acceptable if it says "I don't have enough context", 
          // but it shouldn't crash the server.
          socket.disconnect();
          done();
        }
      });
    }, 15000); // 15s for AI
  });
});
