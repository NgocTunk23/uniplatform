const express = require('express');
const http = require('http'); // Thêm thư viện http
const { Server } = require('socket.io'); // Thêm Socket.io
const cors = require('cors');

const app = express();
app.use(cors());

// Tạo Server HTTP từ app Express
const server = http.createServer(app);

// Khởi tạo Socket.io với cấu hình CORS cho phép Frontend truy cập
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Lắng nghe các kết nối từ Client 
io.on('connection', (socket) => {
  console.log('⚡ Một người dùng đã kết nối:', socket.id);

  // Lắng nghe sự kiện người dùng tham gia vào một nhóm cụ thể (Room)
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} đã tham gia phòng: ${roomId}`);
  });

  // Lắng nghe khi có tin nhắn mới được gửi từ Client 
  socket.on('send_message', (data) => {
    // data bao gồm: roomId, sender, message
    // Phát lại (Broadcast) tin nhắn đó cho tất cả mọi người trong phòng 
    io.to(data.roomId).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('🔥 Người dùng đã ngắt kết nối');
  });
});

// LƯU Ý: Phải dùng server.listen thay vì app.listen
server.listen(5000, () => {
  console.log("🚀 Server Socket.io đang chạy tại port 5000");
});