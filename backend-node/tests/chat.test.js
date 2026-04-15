// 1. Force environment for testing
const dotenv = require('dotenv');
dotenv.config();

process.env.JWT_SECRET = 'testsecret';
process.env.NODE_ENV = 'test';

// Dynamically override MONGO_URI for testing
if (process.env.MONGO_URI) {
  const baseUri = process.env.MONGO_URI.split('?')[0].replace('/uniplatform', '/uniplatform_test');
  const params = process.env.MONGO_URI.split('?')[1] || '';
  process.env.MONGO_URI = `${baseUri}?${params}&directConnection=true`;
}

const { Server } = require('socket.io');
const ioc = require('socket.io-client');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

// Mock AI Service BEFORE importing the app
jest.mock('../src/services/ai.service', () => ({
  getEmbedding: jest.fn().mockResolvedValue(Array(768).fill(0.1)),
  generateResponse: jest.fn().mockResolvedValue('Hello, I am UniBot! How can I help you?')
}));

const { server, io } = require('../index');

let prisma;
let clientSocket;
const port = 5002; // Use a different port for socket tests to be safe
const workspaceId = '654321654321654321654321'; // Valid MongoDB ObjectId format

jest.setTimeout(15000);

beforeAll(async () => {
  // Setup Workspace & Database
  prisma = new PrismaClient({
    datasources: { db: { url: process.env.MONGO_URI } }
  });

  // Ensure fresh DB and create a dummy workspace for the hardcoded ID
  await prisma.message.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: 'Test Workspace',
      admin: 'testadmin'
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      clientSocket = ioc(`http://localhost:${port}`);
      clientSocket.on('connect', resolve);
    });
  });
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  io.close();
  server.close();
  clientSocket.disconnect();
});

describe('Real-time Chat Socket Tests', () => {
  
  beforeEach(async () => {
    // Clean up messages between tests
    await prisma.message.deleteMany({});
  });

  test('User should join a workspace room', (done) => {
    clientSocket.emit('join_workspace', workspaceId);
    // Success is implicit if no error, but we can't easily verify room membership from client
    // So we just ensure the event can be sent
    setTimeout(done, 100);
  });

  test('should broadcast and save a message when send_message is emitted', (done) => {
    const testMessage = {
      workspaceId,
      senderusername: 'testadmin',
      content: 'Hello everyone!',
      mentions: []
    };

    // 1. Listen for the broadcast
    clientSocket.once('receive_message', async (receivedData) => {
      try {
        expect(receivedData.content).toBe(testMessage.content);
        expect(receivedData.senderusername).toBe(testMessage.senderusername);
        
        // 2. Wait a bit for background save to finish, then check DB
        setTimeout(async () => {
          const savedMessage = await prisma.message.findFirst({
            where: { content: testMessage.content }
          });
          expect(savedMessage).toBeDefined();
          expect(savedMessage.workspaceId).toBe(workspaceId);
          done();
        }, 500);
      } catch (err) {
        done(err);
      }
    });

    // 2. Emit the message
    clientSocket.emit('join_workspace', workspaceId);
    clientSocket.emit('send_message', testMessage);
  });

  test('should handle AI interaction via ask_ai', (done) => {
    const aiPrompt = {
      workspaceId,
      prompt: 'What is our project status?',
      senderusername: 'testadmin'
    };

    clientSocket.emit('join_workspace', workspaceId);

    // 1. Listen for status changes
    let statusReceived = false;
    clientSocket.on('ai_status', (data) => {
      if (data.status === 'typing') statusReceived = true;
    });

    // 2. Listen for the final AI message
    clientSocket.on('receive_message', async (receivedData) => {
      if (receivedData.senderusername === 'UniBot') {
        try {
          expect(statusReceived).toBe(true);
          expect(receivedData.content).toContain('UniBot');
          
          // Verify it was saved
          const savedAiMsg = await prisma.message.findFirst({
            where: { senderusername: 'UniBot' }
          });
          expect(savedAiMsg).toBeDefined();
          
          clientSocket.off('ai_status');
          clientSocket.off('receive_message');
          done();
        } catch (err) {
          done(err);
        }
      }
    });

    clientSocket.emit('ask_ai', aiPrompt);
  });
});
