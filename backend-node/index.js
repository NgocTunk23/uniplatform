const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const prisma = require('./src/config/prisma');
const { swaggerUi, specs } = require('./src/config/swagger');
const errorMiddleware = require('./src/middlewares/error.middleware');

// Load env vars
dotenv.config();

// Prisma Connection Check
prisma.$connect()
  .then(() => console.log('🛡️  Prisma connected to MongoDB'))
  .catch((err) => console.error('❌ Prisma connection error:', err));

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

const registerChatHandlers = require('./src/socket/chat.socket');

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Socket.io Handlers
io.on('connection', (socket) => {
  registerChatHandlers(io, socket);

  socket.on('disconnect', () => {
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