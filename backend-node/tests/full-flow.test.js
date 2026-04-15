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
    server.listen(0, async () => {
      const actualPort = server.address().port;
      console.log(`🧪 Full Flow Server started on ${actualPort}`);
      
      socketA = ioc(`http://localhost:${actualPort}`);
      socketB = ioc(`http://localhost:${actualPort}`);

      let connected = 0;
      const onConnect = () => {
        connected++;
        if (connected === 2) resolve();
      };

      socketA.on('connect', onConnect);
      socketB.on('connect', onConnect);
    });
  });
});

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
  });

  step('2. Register and Login User B (Member)', async () => {
    await request(app).post('/api/auth/register').send(userB);
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: userB.email,
      password: userB.password
    });
    tokenB = loginRes.body.token;
    expect(tokenB).toBeDefined();
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
    socketA.emit('join_workspace', workspaceId);
    socketB.emit('join_workspace', workspaceId);
    // Briefly wait for server-side room join to complete
    setTimeout(done, 500);
  });

  step('6. User A sends a message, User B receives it in real-time', (done) => {
    const messageContent = 'Hello Alpha Squad! Team meeting at 10.';

    // User B should receive it
    socketB.once('receive_message', async (data) => {
      try {
        expect(data.content).toBe(messageContent);
        expect(data.senderusername).toBe(userA.username);

        // Verify DB persistence
        setTimeout(async () => {
          const saved = await prisma.message.findFirst({ where: { content: messageContent } });
          expect(saved).toBeDefined();
          done();
        }, 500);
      } catch (e) {
        done(e);
      }
    });

    socketA.emit('send_message', {
      workspaceId,
      senderusername: userA.username,
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
          socketA.off('receive_message', handleReceive);
          socketB.off('receive_message', handleReceive);
          done();
        }
      }
    };

    socketA.on('receive_message', handleReceive);
    socketB.on('receive_message', handleReceive);

    socketB.emit('ask_ai', {
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
