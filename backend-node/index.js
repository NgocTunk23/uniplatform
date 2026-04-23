const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const prisma = require('./src/config/prisma');
const SOCKET_EVENTS = require('./src/constants/socket-events');
const { registerChatHandlers } = require('./src/socket/chat.socket');
const { protect } = require('./src/middlewares/auth.middleware');
const { swaggerUi, specs } = require('./src/config/swagger');
const errorMiddleware = require('./src/middlewares/error.middleware');

// Load env vars
dotenv.config();

// Prisma Connection Check
prisma.$connect()
  .then(() => console.log('Prisma connected to MongoDB'))
  .catch((err) => console.error('Prisma connection error:', err));

const workspaceRoutes = require('./src/routes/workspace.routes');
const messageRoutes = require('./src/routes/message.routes');
const fileRoutes = require('./src/routes/file.routes');
const adminRoutes = require('./src/routes/admin.routes');
const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

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
      where: { id: decoded.id },
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

  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 5001;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

// module1
const mongoose = require('mongoose');
const ScheduleSchema = new mongoose.Schema({
  scheduleid: String,
  username: String,
  title: String,
  starttime: Date,
  endtime: Date,
  type: { type: String, default: 'Lịch họp' }, // Ban / Lich hop / Tu do
  createat: { type: Date, default: Date.now }
});

const Schedule = mongoose.model('Schedule', ScheduleSchema);
app.post('/api/meetings/create', async (req, res) => {
  try {
    const { title, username, starttime, endtime } = req.body;

    // new record
    const newSchedule = new Schedule({
      scheduleid: 'SCH' + Date.now(), // ID created by timestamp
      username,
      title,
      starttime: new Date(starttime),
      endtime: new Date(endtime),
      type: 'Lịch họp'
    });

    // Luu xuong MongoDB Atlas
    await newSchedule.save();

    res.json({
      success: true,
      message: "Đã tạo lịch họp thành công và lưu vào hệ thống!",
      data: newSchedule
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lưu lịch: " + error.message });
  }
});

module.exports = { app, server, io };