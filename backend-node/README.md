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

# Google Drive Configuration
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5001/api/auth/google/callback
GOOGLE_DRIVE_REFRESH_TOKEN=...
GOOGLE_DRIVE_FOLDER_ID=...
```

### 2. Cấu hình Google Drive (Bắt buộc cho Module File)
Hệ thống sử dụng OAuth2 để tương tác với Google Drive. Hãy thực hiện chính xác các bước sau:
1. **Google Cloud Console:** 
   - Truy cập [Google Cloud Console](https://console.cloud.google.com/).
   - Tạo Project mới và Enable **Google Drive API**.
   - Tại mục **OAuth consent screen**: Chọn User Type là **External**, thêm email cá nhân vào danh sách **Test users**.
   - Tại mục **Credentials**: Tạo **OAuth 2.0 Client ID** loại **Web application**.
   - Thêm `http://localhost:5001/api/auth/google/callback` vào mục **Authorized redirect URIs**.
2. **Lấy Refresh Token:**
   - Điền `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` vào file `.env`.
   - Chạy lệnh: `node scripts/get-refresh-token.js`.
   - Làm theo hướng dẫn trên terminal để lấy mã `refresh_token` và dán vào `.env`.
3. **Cấu hình Thư mục lưu trữ:**
   - Tạo 1 Folder trên Drive của bạn.
   - Copy ID của Folder (chuỗi ký tự cuối trên URL) dán vào `GOOGLE_DRIVE_FOLDER_ID`.
4. **Kiểm tra kết nối Real-upload:**
   - Chạy: `node scripts/test-real-upload.js` để đảm bảo file có thể tải lên thành công.

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
Dự án sử dụng Jest để kiểm thử tích hợp. Bộ test bao gồm các kịch bản thực tế (Real GDrive/AI).

**Lưu ý quan trọng:** Do sử dụng các thư viện Node.js hiện đại (ESM), bạn cần chạy test với cờ thực nghiệm:

```bash
# Chạy toàn bộ test suite
npm test

# Chạy riêng bộ test Case-Study thực tế (Production-grade)
NODE_OPTIONS='--experimental-vm-modules' npx jest tests/production-case-study.test.js --runInBand
```

## 🛡️ Phân quyền & Bảo mật (RBAC)
Hệ thống áp dụng các quy tắc bảo mật chặt chẽ cho Module 2:
- **Socket Authentication:** Tất cả kết nối Socket đều bắt buộc phải có JWT Token trong `handshake.auth`.
- **Vai trò Workspace:**
    - `Leader`: Có toàn quyền quản lý Workspace và thành viên.
    - `Member`: Có quyền chat và upload file.
    - `Viewer`: Chỉ có quyền xem tin nhắn và file, bị chặn quyền xóa.
- **Quyền sở hữu File:** Chỉ có người tải lên tệp tin (**uploader**) mới có quyền xóa tệp đó khỏi hệ thống, kể cả khi người đó có quyền Leader trong Workspace (ngoại trừ admin hệ thống).

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
- `GET /stats`: Xem chỉ số sức khỏe hệ thống (CPU, RAM, DB, **Google Drive Quota**).
- `GET /users`: Quản lý danh sách toàn bộ người dùng.
- `PATCH /users/:id/status`: Khóa hoặc mở khóa tài khoản người dùng (Ghi Audit Log).
- `POST /users/:id/force-logout`: Cưỡng chế đăng xuất người dùng ngay lập tức.
- `GET /logs`: Xem nhật ký thao tác chi tiết (**Audit Logs với Old/New values**).

## 🔐 Bảo mật & Phân quyền (RBAC)

Hệ thống UniPlatform hỗ trợ phân quyền đa tầng để đảm bảo an toàn dữ liệu:

### 1. Vai trò Hệ thống (System Roles)
- **Admin**: Quản trị viên tối cao (Superuser). Có quyền truy cập mọi Workspace và xóa mọi tệp tin để quản lý hệ thống.
- **Member**: Người dùng thông thường. Có thể tạo Workspace riêng.

### 2. Vai trò Workspace (Workspace Roles)
- **Leader**: Chủ sở hữu hoặc Quản lý Workspace. Có quyền thêm/xóa thành viên và quản lý toàn bộ nội dung trong Workspace đó.
- **Member**: Thành viên chính thức. Có quyền Chat, Tải tệp lên và xóa tệp của chính mình.
- **Viewer**: Người xem. Chế độ **Read-only** (Chỉ đọc). Chỉ có thể xem lịch sử tin nhắn và tải xuống tệp tin, không được phép Chat hoặc Upload.

---

## 📡 Hướng dẫn Tích hợp Chat (Socket.io)

Hệ thống sử dụng Socket.io cho giao tiếp thời gian thực. Dưới đây là cách tích hợp chính xác:

### 1. Kết nối & Xác thực
Phải truyền JWT Token trong phần `auth` khi khởi tạo kết nối.

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:5001", {
  auth: {
    token: "YOUR_JWT_TOKEN_HERE"
  }
});
```

### 2. Các Sự kiện chính (Events)

| Sự kiện (Event) | Loại | Dữ liệu (Payload) | Mô tả |
| :--- | :--- | :--- | :--- |
| `join_workspace` | Emit | `workspaceId` (string) | Tham gia vào phòng chat của nhóm |
| `send_message` | Emit | `{ workspaceId, content, reply, fileIds }` | Gửi tin nhắn mới |
| `receive_message` | Listen | `MessageObject` | Nhận tin nhắn tức thì (Snappy UI) |
| `receive_message_confirmed` | Listen | `FullMessageObject` | Tin nhắn đã lưu DB (có ID và metadata tệp) |
| `ask_ai` | Emit | `{ workspaceId, prompt }` | Gửi câu hỏi cho UniBot (AI) |
| `ai_status` | Listen | `{ status: 'typing'\|'done'\|'error' }` | Trạng thái xử lý của AI |

### 3. Ví dụ tích hợp với React

```jsx
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
// Tại Frontend, bạn cũng nên định nghĩa hoặc dùng chung file constants
const SOCKET_EVENTS = {
  JOIN_WORKSPACE: 'join_workspace',
  SEND_MESSAGE: 'send_message',
  RECEIVE_MESSAGE: 'receive_message'
};

function ChatRoom({ workspaceId, token }) {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = io("http://localhost:5001", { auth: { token } });
    
    s.on('connect', () => {
      s.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceId);
    });

    s.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    setSocket(s);
    return () => s.disconnect();
  }, [workspaceId, token]);

  const sendMessage = (text) => {
    socket.emit(SOCKET_EVENTS.SEND_MESSAGE, { workspaceId, content: text });
  };
```

  return (
    <div>
      {/* Render UI Chat */}
    </div>
  );
}
```

## 🛡️ Hệ thống mã lỗi tập trung
Hệ thống sử dụng các mã lỗi chuẩn (e.g., `AUTH_INVALID`, `USER_EXISTS`) giúp Frontend dễ dàng bắt lỗi và hiển thị thông báo chính xác cho người dùng. Toàn bộ định nghĩa có tại `src/constants/error-codes.js`.
