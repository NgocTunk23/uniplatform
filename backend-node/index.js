const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const passport = require('passport'); // Bổ sung thư viện passport
const { normalizeDates } = require('./src/utils/timezone.util');

// Set server timezone to GMT+7 for all API responses and local date formatting
process.env.TZ = 'Asia/Bangkok';

// Load env vars
dotenv.config();

// Khởi tạo cấu hình Passport cho Google và GitHub
require('./src/config/passport'); 

const prisma = require('./src/config/prisma');
const meetingRecordingService = require('./src/services/meeting-recording.service');
const SOCKET_EVENTS = require('./src/constants/socket-events');
const { registerChatHandlers } = require('./src/socket/chat.socket');
const { registerMeetingHandlers } = require('./src/socket/meeting.socket');
const { protect } = require('./src/middlewares/auth.middleware');
const { swaggerUi, specs } = require('./src/config/swagger');
const errorMiddleware = require('./src/middlewares/error.middleware');

// Prisma Connection Check
prisma.$connect()
  .then(async () => {
    console.log('🛡️  Prisma connected to MongoDB');
    await meetingRecordingService.resetStaleRecordingMeetings();
  })
  .catch((err) => console.error('❌ Prisma connection error:', err));

const workspaceRoutes = require('./src/routes/workspace.routes');
const messageRoutes = require('./src/routes/message.routes');
const fileRoutes = require('./src/routes/file.routes');
const adminRoutes = require('./src/routes/admin.routes');
const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');
const meetingRoutes = require('./src/routes/meeting.routes');
const scheduleRoutes = require('./src/routes/schedule.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (payload) => originalJson(normalizeDates(payload));
  next();
});
app.use(morgan('dev'));

// Kích hoạt Passport Middleware (Bắt buộc phải nằm trước các routes)
app.use(passport.initialize());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/schedules', scheduleRoutes);

// Basic Health Check Route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'UniPlatform Backend is running' });
});

// Centralized Error Handling
app.use(errorMiddleware);

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Socket.io Middleware for Authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { username: decoded.id },
    });

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    if (user.status === 'locked') {
      return next(new Error('Authentication error: Account is locked'));
    }

    // Check if token version matches (for Force Logout)
    if (typeof decoded.tokenVersion !== 'undefined' && decoded.tokenVersion < user.tokenVersion) {
      return next(new Error('Authentication error: Session expired'));
    }

    // Attach user to socket
    const { password, ...userData } = user;
    socket.user = userData;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io Handlers
io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
  registerChatHandlers(io, socket);
  registerMeetingHandlers(io, socket);

  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    console.log('🔥 User disconnected');
  });
});

const PORT = process.env.PORT || 5001;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
}

module.exports = { app, server, io };
