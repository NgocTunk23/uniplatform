# UniPlatform Backend (Node.js)

Hệ thống backend chính của UniPlatform chịu trách nhiệm cung cấp API, xác thực, quản lý workspace, chat thời gian thực, upload file và các chức năng AI.

## 🚀 Công nghệ chính

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **ORM:** Prisma 6.19.3
- **Database:** MongoDB (Replica Set)
- **Validation:** Zod
- **Realtime:** Socket.io
- **Docs:** Swagger (OpenAPI)
- **Testing:** Jest + Supertest

## 🛠️ Cài đặt

### 1. Cài đặt phụ thuộc

```bash
cd backend-node
npm install
```

### 2. Chuẩn bị môi trường

Sao chép tệp môi trường từ root:

```bash
cp ../.env.example .env
```

Chỉnh sửa `.env` hoặc sử dụng file `.env` ở thư mục root để cấu hình:

- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_FOLDER_ID`

### 3. Khởi tạo database

```bash
cd backend-node
npx prisma generate
npx prisma db push
npx prisma db seed
```

> Lưu ý: MongoDB cần chạy dưới chế độ Replica Set để Prisma hỗ trợ transaction.

### 4. Chạy ứng dụng

```bash
npm run dev
```

Hoặc chạy production:

```bash
npm start
```

### 5. Kiểm tra cấu hình ghi âm

```bash
npm run check:recording-env
```

## 📖 Tài liệu API

Sau khi backend Node khởi động, mở:

```
http://localhost:5001/api-docs
```

## 🧪 Kiểm thử

```bash
npm test
```

Chạy test cụ thể:

```bash
NODE_OPTIONS='--experimental-vm-modules' npx jest tests/production-case-study.test.js --runInBand
```

## 🗂️ Cấu trúc thư mục

```text
backend-node/
├── config/        # Cấu hình Prisma, Swagger, Socket.io
├── constants/     # Hằng số, mã lỗi, vai trò
├── controllers/   # Xử lý yêu cầu API
├── middlewares/   # Xác thực, validate, xử lý lỗi
├── routes/        # Định nghĩa endpoint
├── services/      # Logic nghiệp vụ chính
├── utils/         # Tiện ích chung
└── validations/   # Schema Zod
```

## 🔒 Cấu hình Google Drive

Nếu cần bật tính năng upload file lên Google Drive:

1. Tạo OAuth Client trên Google Cloud Console.
2. Thêm `http://localhost:5001/api/auth/google/callback` vào Authorized redirect URIs.
3. Điền `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` vào `.env`.
4. Chạy:

```bash
node scripts/get-refresh-token.js
```

5. Dán `refresh_token` vào `GOOGLE_DRIVE_REFRESH_TOKEN`.
6. Gán `GOOGLE_DRIVE_FOLDER_ID` bằng ID thư mục Drive.

## 🤝 Các endpoint chính

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/messages/:workspaceId`
- `POST /api/files/upload`
- `PUT /api/users/profile`
- `POST /api/admin/users/:id/force-logout`

## 📌 Ghi chú

- Nếu dùng Docker Desktop trên macOS, cấu hình `OLLAMA_BASE_URL` phù hợp để backend truy cập Ollama.
- `INSTALLATION.md` trong root chứa hướng dẫn cài đặt đầy đủ và chi tiết.
