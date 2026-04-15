# UniPlatform Backend (Node.js)

Hệ thống Backend trung tâm của UniPlatform, được xây dựng trên nền tảng Node.js với kiến trúc hiện đại, tập trung vào tính bảo mật, hiệu suất và khả năng mở rộng.

## 🚀 Công nghệ sử dụng (Tech Stack)

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **ORM:** Prisma 6.19.3 (Optimized for MongoDB)
- **Database:** MongoDB (Single-node Replica Set for Transactions)
- **Validation:** Zod (Request body, params, query validation)
- **Documentation:** Swagger (OpenAPI 3.0)
- **Real-time:** Socket.io (Hệ thống Chat)
- **Testing:** Jest & Supertest

## 🛠️ Cài đặt & Khởi chạy

### 1. Cấu hình môi trường
Tạo file `.env` dựa trên các thông tin sau (Lưu ý cổng 5001 được sử dụng để tránh xung đột với macOS AirPlay):

```env
PORT=5001
MONGO_URI="mongodb://root:password@localhost:27017/uniplatform?authSource=admin&replicaSet=rs0"
JWT_SECRET=your_jwt_secret_here
GOOGLE_DRIVE_REFRESH_TOKEN=...
GOOGLE_DRIVE_CLIENT_ID=...
GOOGLE_DRIVE_CLIENT_SECRET=...
```

### 2. Khởi tạo Database
Dự án yêu cầu MongoDB chạy ở chế độ **Replica Set** để Prisma có thể thực hiện các giao dịch (Transactions).

```bash
# Khởi chạy docker (đã cấu hình Replica Set tự động)
docker-compose up -d

# Đẩy schema Prisma vào DB
npx prisma db push

# Khởi tạo dữ liệu mẫu (3 tài khoản Admin)
npx prisma db seed
```

### 3. Chạy ứng dụng
```bash
# Chế độ phát triển
npm run dev

# Chế độ Production
npm start
```

## 📖 Tài liệu API
Tài liệu API đầy đủ có tại: `http://localhost:5001/api-docs` (Swagger UI).
Tất cả các endpoint đều được mô tả chi tiết với payload yêu cầu và các mã lỗi trả về.

## 🏗️ Cấu trúc thư mục

```text
src/
├── config/             # Cấu hình Prisma, Swagger, Socket.io
├── constants/          # Hằng số tập trung (Error Codes, Roles)
├── controllers/        # Xử lý Logic nghiệp vụ API
├── middlewares/        # Auth, Validation, Error Handling
├── routes/             # Định nghĩa các endpoint API
├── services/           # Tầng giao tiếp với Prisma & Business Logic
├── utils/              # Tiện ích bổ trợ (JWT, Cloud Storage)
└── validations/        # Định nghĩa Zod Schemas
```

## 🧪 Kiểm thử (Testing)
Dự án sử dụng Jest để kiểm thử tích hợp. Bộ test đã được cấu hình để chạy trên một database riêng biệt (`uniplatform_test`) để đảm bảo không ảnh hưởng đến dữ liệu phát triển.

```bash
# Chạy toàn bộ test
npm test
```

## 📡 Danh sách API Endpoints

Hỗ trợ đầy đủ các tính năng thông qua các module sau:

### 🔑 Authentication (`/api/auth`)
- `POST /register`: Đăng ký tài khoản mới (Validate bằng Zod).
- `POST /login`: Đăng nhập hệ thống & nhận JWT Token.
- `POST /logout`: Đăng xuất (Yêu cầu Token).
- `GET /me`: Lấy thông tin tài khoản đang đăng nhập.

### 🏢 Workspace (`/api/workspaces`)
- `POST /`: Tạo Workspace mới (Leader).
- `GET /`: Liệt kê tất cả nội dung không gian làm việc.
- `GET /:id`: Xem chi tiết 1 Workspace.
- `POST /:id/members`: Thêm thành viên vào Workspace.
- `DELETE /:id/members/:username`: Xóa thành viên khỏi nhóm.
- `PATCH /:id/members/:username`: Cập nhật quyền thành viên (Leader/Member).

### 💬 Messages (`/api/messages`)
- `GET /:workspaceId`: Lấy lịch sử tin nhắn của một Workspace (Hỗ trợ phân trang).

### 📁 Files (`/api/files`)
- `POST /upload`: Tải tệp tin lên Google Drive.
- `DELETE /:id`: Xóa tệp tin khỏi hệ thống.

### 👤 User Profile (`/api/users`)
- `PUT /profile`: Cập nhật thông tin cá nhân (Hov tên, ngày sinh, địa chỉ...).
- `PATCH /change-password`: Thay đổi mật khẩu định kỳ.

### 🛡️ Admin (`/api/admin`)
- `GET /stats`: Xem chỉ số sức khỏe hệ thống (CPU, RAM, DB).
- `GET /users`: Quản lý danh sách toàn bộ người dùng.
- `PATCH /users/:id/status`: Khóa hoặc mở khóa tài khoản người dùng.
- `GET /logs`: Xem nhật ký thao tác hệ thống (Audit Logs).

## 🛡️ Hệ thống mã lỗi tập trung
Hệ thống sử dụng các mã lỗi chuẩn (e.g., `AUTH_INVALID`, `USER_EXISTS`) giúp Frontend dễ dàng bắt lỗi và hiển thị thông báo chính xác cho người dùng. Toàn bộ định nghĩa có tại `src/constants/error-codes.js`.
