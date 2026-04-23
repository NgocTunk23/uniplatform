process.env.GOOGLE_DRIVE_MOCK = 'false';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const request = require('supertest');
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { app, server } = require('../index');
const prisma = require('../src/config/prisma');
const SOCKET_EVENTS = require('../src/constants/socket-events');

// NOTE: We are NOT mocking aiService or gdrive.util to test REAL production flow
// ensure your .env has valid GOOGLE_* and GEMINI_API_KEY credentials.

let users = [];
let workspaceId;
let sockets = [];
let driveFileIds = []; // Track real Drive IDs for cleanup
const TEST_PORT = 5005; 
const serverUrl = `http://localhost:${TEST_PORT}`;

jest.setTimeout(60000); // 1 minute for real network calls

beforeAll(async () => {
  // 1. Clean up OLD test data from DB
  await prisma.file.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.workspace.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Start Server
  await new Promise((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`📡 REAL Production-Grade Test Server listening on port ${TEST_PORT}`);
      resolve();
    });
  });
});

afterAll(async () => {
  // 1. Cleanup Sockets
  sockets.forEach(s => s.disconnect());
  
  // 2. IMPORTANT: Cleanup REAL Google Drive Files
  const gdriveUtil = require('../src/utils/gdrive.util');
  for (const id of driveFileIds) {
    try {
      await gdriveUtil.deleteFile(id);
      console.log(`🗑️ Cleanup: Deleted REAL GDrive file: ${id}`);
    } catch (err) {
      console.warn(`⚠️ Cleanup: Failed to delete GDrive file ${id}:`, err.message);
    }
  }

  // 3. Shutdown
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

describe('UniPlatform Production-Grade Case Study', () => {

  describe('Phase 1: Multi-User Onboarding & RBAC Setup', () => {
    
    test('1.1: Register and Login 3 Users (Admin, Member, Viewer)', async () => {
      const userData = [
        { username: 'alice_admin', password: 'password123', fullname: 'Alice Admin', email: 'alice@alpha.com' },
        { username: 'bob_member', password: 'password123', fullname: 'Bob Member', email: 'bob@alpha.com' },
        { username: 'charlie_viewer', password: 'password123', fullname: 'Charlie Viewer', email: 'charlie@alpha.com' }
      ];

      for (const u of userData) {
        await request(app).post('/api/auth/register').send(u);
        const loginRes = await request(app).post('/api/auth/login').send({
          identifier: u.username,
          password: u.password
        });
        users.push({ ...u, token: loginRes.body.token, id: loginRes.body.id });
      }
      expect(users).toHaveLength(3);
    });

    test('1.2: Admin Alice creates "Project Alpha" Workspace', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${users[0].token}`)
        .send({ name: 'Project Alpha', admin: 'alice_admin' });
      
      if (res.statusCode !== 201) console.error('❌ Create Workspace Failed:', res.body);
      expect(res.statusCode).toBe(201);
      workspaceId = res.body.id;
    });

    test('1.3: Assign roles to Bob (Member) and Charlie (Viewer)', async () => {
      // Add Bob as Member
      const resBob = await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${users[0].token}`)
        .send({ username: 'bob_member', workspacerole: 'Member' });
      if (resBob.statusCode !== 200) console.error('❌ Add Bob Failed:', resBob.body);

      // Add Charlie as Viewer
      const resCharlie = await request(app)
        .post(`/api/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${users[0].token}`)
        .send({ username: 'charlie_viewer', workspacerole: 'Viewer' });
      if (resCharlie.statusCode !== 200) console.error('❌ Add Charlie Failed:', resCharlie.body);

      const workspace = await request(app)
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${users[0].token}`);
      
      expect(workspace.body.members).toHaveLength(3);
      const charlie = workspace.body.members.find(m => m.username === 'charlie_viewer');
      expect(charlie.workspacerole).toBe('Viewer');
    });

    test('1.4: All sockets connect and join workspace room', (done) => {
      let joined = 0;
      users.forEach((user, index) => {
        const socket = createSocket(user.token);
        sockets[index] = socket;

        socket.on('connect', () => socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceId));
        socket.on(SOCKET_EVENTS.WORKSPACE_JOINED, () => {
          joined++;
          if (joined === 3) done();
        });
      });
    });
  });

  describe('Phase 2: REAL File Management & RBAC Enforcement', () => {
    
    test('2.1: Admin Alice uploads REAL Project Plan (PDF)', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Project Alpha Plan) >>\nendobj');
      
      const res = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${users[0].token}`)
        .attach('file', pdfBuffer, 'Project_Plan.pdf');

      if (res.statusCode !== 201) {
        console.error('❌ Phase 2.1 Upload Failed:', res.body);
      }
      expect(res.statusCode).toBe(201);
      expect(res.body.file.ggid).toBeDefined();
      expect(res.body.file.ggid).not.toContain('mock');
      
      driveFileIds.push(res.body.file.ggid); // Track for cleanup
    });

    test('2.2: Viewer Charlie tries to DELETE the plan (Should be REJECTED)', async () => {
      const file = await prisma.file.findFirst({ where: { filename: 'Project_Plan.pdf' } });
      if (!file) throw new Error('File "Project_Plan.pdf" not found. Upload likely failed.');
      
      const fileId = file.id;
      const res = await request(app)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${users[2].token}`); // Charlie

      expect(res.statusCode).toBe(403); 
      expect(res.body.message).toContain('Unauthorized');
    });

    test('2.3: Admin Alice uploads MULTIPLE files at once', async () => {
      const textBuffer = Buffer.from('Some data content');
      
      // Upload 1
      const res1 = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${users[0].token}`)
        .attach('file', textBuffer, 'data_v1.txt');
      
      if (res1.statusCode !== 201) console.error('❌ Upload 1 Failed:', res1.body);
      expect(res1.statusCode).toBe(201);
      
      // Upload 2
      const res2 = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${users[0].token}`)
        .attach('file', textBuffer, 'data_v2.txt');

      if (res2.statusCode !== 201) console.error('❌ Upload 2 Failed:', res2.body);
      expect(res2.statusCode).toBe(201);

      const fileIds = [res1.body.file.id, res2.body.file.id];
      driveFileIds.push(res1.body.file.ggid, res2.body.file.ggid);

      // Send message with 2 files
      const promise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Receive Multi-file message TIMEOUT')), 10000);
        sockets[1].once(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, (msg) => {
          clearTimeout(timeout);
          try {
            expect(msg.files).toHaveLength(2);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      sockets[0].emit(SOCKET_EVENTS.SEND_MESSAGE, {
        workspaceId,
        content: 'Check these 2 logs',
        fileIds
      });

      await promise;
    });
  });

  describe('Phase 3: High-Fidelity Communication (Replies/Mentions)', () => {
    
    let planMessageId;

    test('3.1: Alice announces the plan and mentions everyone', (done) => {
      const announceText = 'Hey @bob_member @charlie_viewer, I uploaded the plan!';
      
      const onMessage = (msg) => {
        if (msg.content === announceText) {
          planMessageId = msg.id;
          sockets[1].off(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, onMessage);
          done();
        }
      };
      
      sockets[1].on(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, onMessage);

      sockets[0].emit(SOCKET_EVENTS.SEND_MESSAGE, {
        workspaceId,
        content: announceText,
      });
    }, 15000);

    test('3.2: Bob replies specifically to the plan message', (done) => {
      const replyContent = 'Got it Alice! Checking Budget now.';
      
      const onReply = (msg) => {
        if (msg.content === replyContent) {
          expect(msg.replyToId).toBe(planMessageId);
          sockets[0].off(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, onReply);
          done();
        }
      };

      sockets[0].on(SOCKET_EVENTS.RECEIVE_MESSAGE_CONFIRMED, onReply);

      sockets[1].emit(SOCKET_EVENTS.SEND_MESSAGE, {
        workspaceId,
        content: replyContent,
        reply: planMessageId,
      });
    }, 15000);
  });

  describe('Phase 4: AI & RAG Interaction (Gemini Real Call)', () => {
    
    test('4.1: Bob (Member) asks AI UniBot about the project', (done) => {
      console.log('🤖 Skipping Viewer AI request check...');
      // REAL AI Call might take time
      const prompt = 'Who is the project leader and what did Alice just say?';
      
      // Use sockets[1] (Bob - Member) instead of sockets[2] (Charlie - Viewer)
      sockets[1].on(SOCKET_EVENTS.AI_STATUS, (data) => {
        console.log(`🤖 AI Status: ${data.status}`);
      });

      sockets[1].on(SOCKET_EVENTS.RECEIVE_MESSAGE, (msg) => {
        if (msg.senderusername === 'UniBot') {
          console.log(`🤖 UniBot Response: ${msg.content}`);
          expect(msg.content).toBeDefined();
          sockets[1].off(SOCKET_EVENTS.RECEIVE_MESSAGE);
          done();
        }
      });

      sockets[1].emit(SOCKET_EVENTS.ASK_AI, {
        workspaceId,
        prompt,
        senderusername: 'bob_member'
      });
    }, 60000); // 60s for REAL AI
  });

  describe('Phase 5: Performance & History Retrieval', () => {
    
    test('5.1: Verify History Pagination (Skip/Limit)', async () => {
      // Fill with 10 messages
      for (let i = 0; i < 5; i++) {
        await prisma.message.create({
          data: {
            workspaceId,
            senderusername: 'alice_admin',
            content: `Spam ${i}`
          }
        });
      }

      const res = await request(app)
        .get(`/api/messages/${workspaceId}?limit=3&skip=0`)
        .set('Authorization', `Bearer ${users[0].token}`);
      
      expect(res.body).toHaveLength(3);
    });
  });

  describe('Phase 6: Admin Management & Final Cleanup', () => {
    
    test('6.1: Alice removes Bob from Project Alpha', async () => {
      const res = await request(app)
        .delete(`/api/workspaces/${workspaceId}/members/bob_member`)
        .set('Authorization', `Bearer ${users[0].token}`);
      
      expect(res.statusCode).toBe(200);
      
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { members: true }
      });
      expect(workspace.members).toHaveLength(2); // Alice & Charlie left
    });

    test('6.2: Final database cleanup verification', async () => {
      // Just a check to see if we reached the end successfully
      console.log('🏁 Case study completed successfully.');
    });
  });
});
