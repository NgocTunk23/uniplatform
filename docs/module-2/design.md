# MODULE 2: Giao tiếp & Truy cập (Chat & Auth) - Design

Tài liệu này mô tả chi tiết kiến trúc kỹ thuật của hệ thống core Module 2, bao gồm cấu trúc tầng, cơ chế real-time và tích hợp AI nâng cao.

## 1. Kiến trúc hệ thống (Layered Architecture)

Cấu trúc thư mục đề xuất cho `backend-node`:
```
backend-node/
├── src/
│   ├── config/             # Cấu hình DB (Prisma), Environment, Swagger
│   ├── constants/          # Quản lý hằng số tập trung (Error Codes, Roles)
│   ├── controllers/        # Request logic + Swagger JSDoc annotations
│   ├── services/           # Business logic sử dụng Prisma Client
│   ├── validations/        # Zod Schemas cho Request Validation
│   ├── routes/             # API routes + Validation middleware
│   ├── middlewares/        # Auth, Logging, Validation, Error Handling
│   ├── socket/             # Socket.io handlers
│   └── utils/              # Helper functions (AI, Google Drive, Crypto)
├── tests/                  # Unit & Integration tests (Sử dụng DB test biệt lập)
├── prisma/                 # Prisma Schema và Seed scripts
├── .env                    # Biến môi trường (PORT=5001)
├── index.js                # Điểm khởi đầu ứng dụng
└── ...
```

**Cải tiến Production-grade:**
- **GDrive Utility Singleton:** Để đảm bảo tính ổn định trong môi trường ESM/Jest, Drive Client được khởi tạo theo cơ chế **Singleton/Cache**, tránh việc nạp lại thư viện Gaxios nhiều lần gây lỗi `ERR_VM_DYNAMIC_IMPORT`.

## 2. Thiết kế Cơ sở Dữ liệu (Prisma Schema)

Dữ liệu được quản lý qua `prisma/schema.prisma` với các Model chính:
- `User`: Quản lý tài khoản, phân quyền (`Admin`, `Member`, `Viewer`), và trạng thái (active/locked).
- `Workspace`: Quản lý nhóm làm việc và danh sách thành viên nhúng (Member[]).
- `Message`: Lưu trữ tin nhắn, vector embedding cho AI RAG.
- `File`: Metadata tệp tin trên Google Drive, bao gồm thông tin **uploaderId** để kiểm soát quyền xóa.
- `SystemLog`: Nhật ký hành động (Audit log) với cấu trúc Diff (old/new).

## 3. Quy trình xác thực (Authentication Flow)

1. **Đăng nhập:**
   - User gửi Email/Password.
   - Server kiểm tra verify mật khẩu (bcrypt).
   - Server sinh JWT (AccessToken & RefreshToken).
   - Trả về thông tin User + Tokens.
2. **Middleware Auth:**
   - Kiểm tra Header `Authorization: Bearer <token>`.
   - Giải mã JWT, kiểm tra trạng thái User (có bị khóa không).
   - Gán `req.user` cho các request tiếp theo.
3. **Đăng xuất:**
   - Client xóa Token.
   - Endpoint `/api/auth/logout` trả về thông báo thành công.

## 4. Kiểm thử (Testing)

- **Framework:** Jest + Supertest (API), socket.io-client (Real-time).
- **Database:** Sử dụng `uniplatform_test` (Docker MongoDB) để đảm bảo hỗ trợ đầy đủ Replica Set và Transactions.
- **Môi trường:** `JWT_SECRET` được cô lập riêng cho môi trường test. `ai.service` hỗ trợ Dynamic Config để chuyển đổi giữa Real/Mock linh hoạt.
- **Phạm vi & ESM support:** Kiểm tra đầy đủ các luồng Register, Login, Logout, bảo mật API, broadcast tin nhắn socket thành công 100%. Yêu cầu chạy với cờ `--experimental-vm-modules` để hỗ trợ nạp module GDrive.

## 5. Giải pháp Real-time Chat

- Sử dụng **Socket.io Channels/Rooms** dựa trên `workspaceid`.
- **Socket Authentication:** Token JWT được kiểm tra ngay tại bước `handshake`. Chỉ những kết nối có Token hợp lệ mới được duy trì.
- Khi gửi tin nhắn:
    1. Client phát sự kiện `send_message`.
    2. Server lưu tin nhắn vào MongoDB.
    3. Server tính toán Vector Embedding (nếu cần cho AI).
    4. Server phát lại tin nhắn cho các Client trong Room qua `receive_message`.
    5. Server xác nhận trạng thái lưu trữ qua `receive_message_confirmed`.

## 6. Tích hợp AI & Vector Search (RAG)

- **Vector Embedding:** Sử dụng Gemini API (`embedding-001` hoặc `text-embedding-004`) để chuyển content thành vector.
- **Search:** Sử dụng `$vectorSearch` của MongoDB Atlas hoặc tìm kiếm tương đồng vector cục bộ.
- **RAG Architecture:**
    1. Nhận câu hỏi từ User.
    2. Chuyển câu hỏi thành Vector.
    3. Tìm kiếm nội dung liên quan nhất (Context Retrieval) trong `Messages` và `MeetingMinutes`.
    4. Gửi Prompt (Câu hỏi + Ngữ cảnh đã trích xuất) cho Gemini.
    5. Trả về câu trả lời thông minh cho User.
