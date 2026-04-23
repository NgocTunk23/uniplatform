process.env.GOOGLE_DRIVE_MOCK = 'true';

const request = require('supertest');
const io = require('socket.io-client');
// Mock AI Service BEFORE importing the app
jest.mock('../src/services/ai.service', () => ({
  getEmbedding: jest.fn().mockResolvedValue(Array(768).fill(0.1)),
  generateResponse: jest.fn().mockResolvedValue('Hello, I am UniBot! How can I help you?')
}));

const { app, server } = require('../index');
const prisma = require('../src/config/prisma');
const SOCKET_EVENTS = require('../src/constants/socket-events');

let users = [];
let workspaceId;
let sockets = [];
const TEST_PORT = 5003; 
const serverUrl = `http://localhost:${TEST_PORT}`;

jest.setTimeout(30000);

beforeAll(async () => {
  // 1. Clean up
  await prisma.file.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Start Server
  await new Promise((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`📡 Test Server listening on port ${TEST_PORT}`);
      resolve();
    });
  });

  // 3. Create 3 users
  const userData = [
    { username: 'alice', password: 'password123', fullname: 'Alice', email: 'alice@example.com' },
    { username: 'bob', password: 'password123', fullname: 'Bob', email: 'bob@example.com' },
    { username: 'charlie', password: 'password123', fullname: 'Charlie', email: 'charlie@example.com' }
  ];

  for (const u of userData) {
    await request(app).post('/api/auth/register').send(u);
    const loginRes = await request(app).post('/api/auth/login').send({
      identifier: u.username,
      password: u.password
    });
    users.push({ ...u, token: loginRes.body.token, id: loginRes.body.id });
  }

  // 4. Alice creates workspace
  const workspaceRes = await request(app)
    .post('/api/workspaces')
    .set('Authorization', `Bearer ${users[0].token}`)
    .send({ name: 'Full Flow Workspace', admin: 'alice' });
  workspaceId = workspaceRes.body.id;

  // 5. Add Bob and Charlie to workspace
  await request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set('Authorization', `Bearer ${users[0].token}`)
    .send({ username: 'bob', workspacerole: 'Member' });

  await request(app)
    .post(`/api/workspaces/${workspaceId}/members`)
    .set('Authorization', `Bearer ${users[0].token}`)
    .send({ username: 'charlie', workspacerole: 'Member' });
});

afterAll(async () => {
  sockets.forEach(s => s.disconnect());
  await prisma.$disconnect();
  server.close();
});

function createSocket(token) {
  return io(serverUrl, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true
  });
}

describe('3-User Chat Full Flow Integration Test', () => {

  test('Step 1: All users connect and join workspace room', (done) => {
    let connectedCount = 0;
    users.forEach((user, index) => {
      const socket = createSocket(user.token);
      sockets[index] = socket;

      socket.on('connect', () => {
        socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceId);
      });

      socket.on(SOCKET_EVENTS.WORKSPACE_JOINED, (data) => {
        expect(data.workspaceId).toBe(workspaceId);
        connectedCount++;
        if (connectedCount === 3) done();
      });
    });
  });

  test('Step 2: Alice sends text message -> Bob and Charlie receive', (done) => {
    const messageContent = 'Hello everyone!';
    let receivedCount = 0;

    // Wait for CONFIRMED event which means it's saved in DB
    sockets[1].once(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, (data) => {
      expect(data.content).toBe(messageContent);
      expect(data.senderusername).toBe('alice');
      receivedCount++;
      if (receivedCount === 2) done();
    });

    sockets[2].once(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, (data) => {
      expect(data.content).toBe(messageContent);
      expect(data.senderusername).toBe('alice');
      receivedCount++;
      if (receivedCount === 2) done();
    });

    sockets[0].emit(SOCKET_EVENTS.SEND_MESSAGE, {
      workspaceId,
      content: messageContent
    });
  });

  test('Step 3: Bob uploads file then sends message with attachment', async () => {
    // 1. Bob uploads file via API
    const uploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${users[1].token}`)
      .attach('file', Buffer.from('bob file content'), 'bob_report.pdf');
    
    expect(uploadRes.statusCode).toBe(201);
    const fileId = uploadRes.body.file.id;

    // 2. Bob sends message with fileId via Socket
    const promise = new Promise((resolve) => {
      sockets[0].once(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, (data) => {
        expect(data.senderusername).toBe('bob');
        expect(data.files).toHaveLength(1);
        expect(data.files[0].filename).toBe('bob_report.pdf');
        resolve();
      });
    });

    sockets[1].emit(SOCKET_EVENTS.SEND_MESSAGE, {
      workspaceId,
      content: 'Here is the report',
      fileIds: [fileId]
    });

    await promise;
  });

  test('Step 4: Charlie verifies chat history with attachments', async () => {
    const res = await request(app)
      .get(`/api/messages/${workspaceId}`)
      .set('Authorization', `Bearer ${users[2].token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2); // Alice's text + Bob's file message
    
    const bobMsg = res.body.find(m => m.senderusername === 'bob');
    expect(bobMsg.files).toHaveLength(1);
    expect(bobMsg.files[0].filename).toBe('bob_report.pdf');
    expect(bobMsg.files[0].ggid).toBeDefined();
  });

  test('Step 5: Alice sends a file-only message', async () => {
    // 1. Upload file
    const uploadRes = await request(app)
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${users[0].token}`)
      .attach('file', Buffer.from('photo data'), 'photo.jpg');
    
    expect(uploadRes.status).toBe(201);
    
    const fileId = uploadRes.body.file.id;

    const promise = new Promise((resolve) => {
      sockets[2].once(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, (data) => {
        expect(data.senderusername).toBe('alice');
        expect(data.content).toBe('');
        expect(data.files).toHaveLength(1);
        expect(data.files[0].filename).toBe('photo.jpg');
        resolve();
      });
    });

    sockets[0].emit(SOCKET_EVENTS.SEND_MESSAGE, {
      workspaceId,
      content: '',
      fileIds: [fileId]
    });

    await promise;
  });

  test('Step 6: Final history check for all 3 messages', async () => {
    const res = await request(app)
      .get(`/api/messages/${workspaceId}`)
      .set('Authorization', `Bearer ${users[1].token}`);

    expect(res.body).toHaveLength(3);
    // Sort by date to verify sequence
    const sorted = res.body.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    expect(sorted[0].content).toBe('Hello everyone!');
    expect(sorted[1].content).toBe('Here is the report');
    expect(sorted[2].files[0].filename).toBe('photo.jpg');
  });

});
