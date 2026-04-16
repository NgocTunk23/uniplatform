// 1. Force environment for testing
const dotenv = require('dotenv');
dotenv.config();

process.env.JWT_SECRET = 'fullflowsecret';
process.env.NODE_ENV = 'test';

if (process.env.MONGO_URI) {
  const baseUri = process.env.MONGO_URI.split('?')[0].replace('/uniplatform', '/uniplatform_test_full');
  const params = process.env.MONGO_URI.split('?')[1] || '';
  process.env.MONGO_URI = `${baseUri}?${params}&directConnection=true`;
}

jest.setTimeout(30000); // Increase timeout for E2E flow

const request = require('supertest');
const ioc = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const SOCKET_EVENTS = require('../src/constants/socket-events');
const { server, io, app } = require('../index');

// Mock AI Service
jest.mock('../src/services/ai.service', () => ({
  getEmbedding: jest.fn().mockResolvedValue(Array(768).fill(0.1)),
  generateResponse: jest.fn().mockResolvedValue('I am your AI assistant for PROJECT FULL FLOW.')
}));

let prisma;
let socketA, socketB;
const userA = { username: 'leader_a', email: 'leader@flow.com', password: 'password123', fullname: 'Leader Alice' };
const userB = { username: 'member_b', email: 'member@flow.com', password: 'password123', fullname: 'Member Bob' };

let tokenA, tokenB, workspaceId;

beforeAll(async () => {
  prisma = new PrismaClient({
    datasources: { db: { url: process.env.MONGO_URI } }
  });

  // Ensure fresh DB
  await prisma.message.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});

  return new Promise((resolve) => {
    server.listen(0, () => {
      const actualPort = server.address().port;
      console.log(`🧪 Full Flow Server started on ${actualPort}`);
      resolve();
    });
  });
});

function createSocket(token) {
  const actualPort = server.address().port;
  return ioc(`http://localhost:${actualPort}`, {
    auth: { token }
  });
}

afterAll(async () => {
  if (socketA) socketA.disconnect();
  if (socketB) socketB.disconnect();
  io.close();
  server.close();
  if (prisma) await prisma.$disconnect();
});

describe('UniPlatform Full-Flow (E2E) Integration Tests', () => {

  step('1. Register and Login User A (Leader)', async () => {
    await request(app).post('/api/auth/register').send(userA);
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: userA.email,
      password: userA.password
    });
    tokenA = loginRes.body.token;
    expect(tokenA).toBeDefined();
    socketA = createSocket(tokenA);
  });

  step('2. Register and Login User B (Member)', async () => {
    await request(app).post('/api/auth/register').send(userB);
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: userB.email,
      password: userB.password
    });
    tokenB = loginRes.body.token;
    expect(tokenB).toBeDefined();
    socketB = createSocket(tokenB);
  });

  step('3. User A creates a Workspace', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Alpha Squad', admin: userA.username });

    expect(res.statusCode).toBe(201);
    workspaceId = res.body.id;
    expect(workspaceId).toBeDefined();
  });

  step('4. User A adds User B to the Workspace', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ username: userB.username, workspacerole: 'Member' });

    expect(res.statusCode).toBe(200);
    expect(res.body.members.some(m => m.username === userB.username)).toBe(true);
  });

  step('5. Both Users join Workspace Room via Sockets', (done) => {
    let joined = 0;
    const checkJoined = () => {
      joined++;
      if (joined === 2) done();
    };

    socketA.once(SOCKET_EVENTS.WORKSPACE_JOINED, checkJoined);
    socketB.once(SOCKET_EVENTS.WORKSPACE_JOINED, checkJoined);

    socketA.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceId);
    socketB.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceId);
  });

  step('6. User A sends a message, User B receives it in real-time', (done) => {
    const messageContent = 'Hello Alpha Squad! Team meeting at 10.';

    // User B should receive it
    socketB.once(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, async (data) => {
      try {
        expect(data.content).toBe(messageContent);
        expect(data.senderusername).toBe(userA.username);

        // Verify DB persistence
        const saved = await prisma.message.findFirst({ where: { content: messageContent } });
        expect(saved).toBeDefined();
        done();
      } catch (e) {
        done(e);
      }
    });

    socketA.emit(SOCKET_EVENTS.SEND_MESSAGE, {
      workspaceId,
      content: messageContent
    });
  });

  step('7. User B asks AI a question, both see the response', (done) => {
    const aiPrompt = 'Who is our leader?';
    let receivedCount = 0;

    const handleReceive = (data) => {
      if (data.senderusername === 'UniBot') {
        receivedCount++;
        if (receivedCount === 2) {
          socketA.off(SOCKET_EVENTS.RECEIVE_MESSAGE, handleReceive);
          socketB.off(SOCKET_EVENTS.RECEIVE_MESSAGE, handleReceive);
          done();
        }
      }
    };

    socketA.on(SOCKET_EVENTS.RECEIVE_MESSAGE, handleReceive);
    socketB.on(SOCKET_EVENTS.RECEIVE_MESSAGE, handleReceive);

    socketB.emit(SOCKET_EVENTS.ASK_AI, {
      workspaceId,
      prompt: aiPrompt,
      senderusername: userB.username
    });
  });
});

/**
 * Custom step helper to ensure sequential execution easily in Jest
 * since serializing long flows is better for E2E
 */
function step(name, fn) {
  test(name, fn);
}
