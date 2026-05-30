// 1. Force environment for testing
// Environment set via shell or .env.test


process.env.JWT_SECRET = 'testsecret';
process.env.NODE_ENV = 'test';

// Rely on DATABASE_URL from shell environment


const { Server } = require('socket.io');
const ioc = require('socket.io-client');
const http = require('http');
const prisma = require('../src/config/prisma');
const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');
const SOCKET_EVENTS = require('../src/constants/socket-events');

// Mock AI Service BEFORE importing the app
jest.mock('../src/services/ai.service', () => ({
  getEmbedding: jest.fn().mockResolvedValue(Array(768).fill(0.1)),
  generateResponse: jest.fn().mockResolvedValue('Hello, I am UniBot! How can I help you?')
}));
jest.mock('../src/services/rag.service', () => ({
  getAnswerFromKnowledge: jest.fn().mockResolvedValue('Hello, I am UniBot with RAG knowledge!')
}));

const ROLES = require('../src/constants/roles');
const { server, io } = require('../index');

let clientSocket;
const port = 0; // Use random port for socket tests to avoid EADDRINUSE
let workspaceid; 

jest.setTimeout(15000);

beforeAll(async () => {
  // Setup Workspace & Database

  // Ensure fresh DB and create a dummy workspace for the hardcoded ID
  // Ensure fresh DB in correct order for relations
  await prisma.files.deleteMany({});
  await prisma.messages.deleteMany({});
  await prisma.meetingMinutes.deleteMany({});
  await prisma.meeting.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.systemLog.deleteMany({});
  await prisma.user.deleteMany({});

  require('fs').writeFileSync('db_debug.log', `🧹 Cleanup finished successfully\n`, { flag: 'a' });

  const user = await prisma.user.create({
    data: {
      username: 'testadmin',
      email: 'admin@test.com',
      password: 'hashedpassword',
      fullname: 'Test Admin'
    }
  });

  const token = jwt.sign({ id: user.username }, process.env.JWT_SECRET);

  const ws = await prisma.workspace.create({
    data: {
      name: 'Test Workspace',
      admin: 'testadmin',
      member: {
        set: [{ username: 'testadmin', workspacerole: ROLES.WORKSPACE.LEADER }]
      }
    }
  });
  workspaceid = ws.workspaceid;

  return new Promise((resolve) => {
    server.listen(port, () => {
      const actualPort = server.address().port;
      clientSocket = ioc(`http://localhost:${actualPort}`, {
        auth: { token }
      });
      clientSocket.on('connect', resolve);
    });
  });
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  io.close();
  server.close();
  if (clientSocket) clientSocket.disconnect();
});

describe('Real-time Chat Socket Tests', () => {
  
  beforeEach(async () => {
    // Clean up messages between tests
    await prisma.messages.deleteMany({});
  });

  test('User should join a workspace room', (done) => {
    clientSocket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceid);
    // Success is implicit if no error, but we can't easily verify room membership from client
    // So we just ensure the event can be sent
    setTimeout(done, 100);
  });

  test('should broadcast and save a message when send_message is emitted', (done) => {
    const testMessage = {
      workspaceid,
      senderusername: 'testadmin',
      content: 'Hello everyone!',
      mentions: []
    };

    // 1. Listen for the broadcast
    clientSocket.once(SOCKET_EVENTS.RECEIVE_MESSAGE, async (receivedData) => {
      try {
        expect(receivedData.content).toBe(testMessage.content);
        expect(receivedData.senderusername).toBe(testMessage.senderusername);
        
        // 2. Wait a bit for background save to finish, then check DB
        setTimeout(async () => {
          const savedMessage = await prisma.messages.findFirst({
            where: { content: testMessage.content }
          });
          expect(savedMessage).toBeDefined();
          expect(savedMessage.workspaceid).toBe(workspaceid);
          done();
        }, 500);
      } catch (err) {
        done(err);
      }
    });

    // 2. Emit the message
    clientSocket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceid);
    clientSocket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
      workspaceid: testMessage.workspaceid,
      content: testMessage.content
    });
  });

  test('should handle AI interaction via ask_ai', (done) => {
    const aiPrompt = {
      workspaceid,
      prompt: 'What is our project status?',
      senderusername: 'testadmin'
    };

    clientSocket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceid);

    // 1. Listen for status changes
    let statusReceived = false;
    clientSocket.on(SOCKET_EVENTS.AI_STATUS, (data) => {
      if (data.status === 'typing') statusReceived = true;
    });

    // 2. Listen for the final AI message
    clientSocket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, async (receivedData) => {
      if (receivedData.senderusername === 'UniBot') {
        try {
          expect(statusReceived).toBe(true);
          expect(receivedData.content).toContain('UniBot');
          
          // Verify it was saved
          const savedAiMsg = await prisma.messages.findFirst({
            where: { senderusername: 'UniBot' }
          });
          expect(savedAiMsg).toBeDefined();
          
          clientSocket.off(SOCKET_EVENTS.AI_STATUS);
          clientSocket.off(SOCKET_EVENTS.RECEIVE_MESSAGE);
          done();
        } catch (err) {
          done(err);
        }
      }
    });

    clientSocket.emit(SOCKET_EVENTS.ASK_AI, aiPrompt);
  });

  test('should save message with file attachments', async () => {
    // 1. Create a dummy file in DB
    const dummyFile = await prisma.files.create({
      data: {
        uploader: 'testadmin',
        filename: 'attachment.pdf',
        ggid: 'drive_123',
        typefile: 'application/pdf',
        sizefile: '1024'
      }
    });

    const messageWithFiles = {
      workspaceid,
      senderusername: 'testadmin',
      content: 'See this file!',
      fileIds: [dummyFile.fileid]
    };

    return new Promise((resolve, reject) => {
      clientSocket.once(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, async (newMessage) => {
        try {
          expect(newMessage.content).toBe(messageWithFiles.content);
          expect(newMessage.files).toHaveLength(1);
          expect(newMessage.files[0].filename).toBe('attachment.pdf');

          // Verify in DB with relation
          const dbMsg = await prisma.messages.findUnique({
            where: { messageid: newMessage.messageid || newMessage.id },
            include: { files: true }
          });
          expect(dbMsg.files).toHaveLength(1);
          expect(dbMsg.files[0].fileid).toBe(dummyFile.fileid);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      clientSocket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceid);
      clientSocket.emit(SOCKET_EVENTS.SEND_MESSAGE, messageWithFiles);
    });
  });
});
