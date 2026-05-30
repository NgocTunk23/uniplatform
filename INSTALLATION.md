# Hướng dẫn cài đặt UniPlatform

Tài liệu này mô tả chi tiết cách cài đặt và khởi chạy toàn bộ dự án UniPlatform từ đầu đến cuối.

---

## 1. Tổng quan

UniPlatform gồm ba phần chính:

- `backend-node/`: API chính viết bằng Node.js + Express.
- `backend-python/`: dịch vụ ghi âm / nhận dạng giọng nói (transcription) bằng Python.
- `frontend/`: ứng dụng web React + Vite.

Ngoài ra, dự án sử dụng MongoDB và Ollama để phục vụ chức năng ghi âm, xử lý ngôn ngữ tự nhiên và tóm tắt.

---

## 2. Yêu cầu hệ thống

Trước khi cài đặt, bạn cần chuẩn bị:

- Node.js 18+ và npm
- Python 3.11+ hoặc Python 3.12
- Docker & Docker Compose
- `ffmpeg` cài đặt trên máy
- Ollama (local AI model server)
- MongoDB thông qua Docker Compose hoặc cài đặt riêng

> Nếu bạn dùng macOS và chạy backend trong Docker, cần chú ý cấu hình `OLLAMA_BASE_URL` để kết nối tới host.

---

## 3. Chuẩn bị nguồn code

Mở thư mục chứa dự án và kiểm tra mã nguồn:

```bash
cd /home/toon/uniplatform
ls
```

---

## 4. Sao chép file cấu hình môi trường

Tạo file `.env` từ mẫu có sẵn:

```bash
cp .env.example .env
```

Mở file `.env` và kiểm tra / cập nhật các giá trị sau nếu cần:

- `PORT` - cổng backend Node
- `VITE_API_URL` - đường dẫn API cho frontend
- `MONGO_URI` - kết nối MongoDB
- `JWT_SECRET` - khóa JWT
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `GOOGLE_DRIVE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`
- `PYTHON_API_URL` - đường dẫn backend Python
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- `RECORDINGS_DIR`, `WHISPER_*`, `SUMMARY_SCORE_*`

> `.env.example` đã chứa cấu hình mẫu cơ bản. Bạn chỉ cần sửa giá trị phù hợp với môi trường của mình.

---

## 5. Khởi chạy dịch vụ hạ tầng bằng Docker

Dự án có file `docker-compose.yml` cấu hình sẵn các service sau:

- `mongodb`
- `frontend`
- `backend-node`
- `backend-python`
- `ollama`

### 5.1. Khởi chạy toàn bộ bằng Docker

```bash
docker compose up --build
```

Hoặc nếu chỉ cần chạy nền:

```bash
docker compose up -d --build
```

### 5.2. Nếu cần chỉ chạy MongoDB riêng

```bash
docker compose up -d mongodb
```

### 5.3. Kiểm tra trạng thái

```bash
docker compose ps
```

---

## 6. Cài đặt phụ thuộc Python

Chuyển vào thư mục backend Python và cài đặt thư viện:

```bash
cd backend-python
python3 -m venv venv
venv/bin/python -m pip install -r requirements.txt
```

Nếu bạn dùng Windows, thay `venv/bin/python` bằng `venv\\Scripts\\python.exe`.

---

## 7. Chạy backend Python

```bash
cd backend-python
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Nếu dùng Docker Compose, service `backend-python` đã được khởi động cùng các container khác.

---

## 8. Chạy backend Node.js

Chuyển vào thư mục `backend-node` và cài đặt:

```bash
cd backend-node
npm install
```

Tạo dữ liệu mẫu và khởi chạy:

```bash
npx prisma generate
npm run dev
```

### 8.1. Kiểm tra môi trường ghi âm

```bash
npm run check:recording-env
```

---

## 9. Chạy frontend

Chuyển vào thư mục frontend và cài đặt:

```bash
cd frontend
npm install
```

Khởi chạy ứng dụng front-end:

```bash
npm run dev
```

Mặc định frontend sẽ chạy tại: `http://localhost:5173`

---

## 10. Truy cập ứng dụng

Sau khi khởi động thành công, mở trình duyệt:

- Frontend: `http://localhost:5173`
- Backend Node API: `http://localhost:5001`
- Backend Python Swagger: `http://localhost:8000/docs`

---

## 11. Cấu hình thêm cho Google Drive

Nếu muốn dùng tính năng tải file lên Google Drive, bạn cần thiết lập OAuth 2.0:

1. Tạo project trên Google Cloud Console.
2. Bật API: **Google Drive API**.
3. Tạo credential loại **OAuth 2.0 Client ID**.
4. Thêm `http://localhost:5001/api/auth/google/callback` vào **Authorized redirect URIs**.
5. Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` vào `.env`.
6. Chạy script lấy refresh token:

```bash
cd backend-node
node scripts/get-refresh-token.js
```

7. Sao chép `refresh_token` vào `GOOGLE_DRIVE_REFRESH_TOKEN`.
8. Gán `GOOGLE_DRIVE_FOLDER_ID` bằng ID thư mục Google Drive cần lưu file.

---

## 12. Chạy Ollama và model nội bộ

Nếu chưa có Ollama, bạn cần cài đặt và khởi chạy:

```bash
OLLAMA_HOST="0.0.0.0:11434" ollama serve
```

Hoặc nếu dùng Docker Compose, service `ollama` sẽ khởi động tự động.

Nếu bạn chạy Ollama trên máy host và backend chạy trong Docker, hãy đảm bảo `OLLAMA_BASE_URL` trỏ tới `http://host.docker.internal:11434` hoặc `http://ollama:11434` tùy cấu hình.

---

## 13. Kiểm thử cơ bản

1. Mở `http://localhost:5173` và đăng nhập.
2. Kiểm tra tính năng tạo workspace, chat, upload file.
3. Kiểm thử chức năng ghi âm bằng meeting room.
4. Kiểm tra tính năng transcription tại `http://localhost:8000/docs`.

---

## 14. Câu lệnh hữu ích

```bash
# Dừng docker-compose
docker compose down

# Build lại container backend Node
docker compose build --no-cache backend-node

# Chạy test backend Node
cd backend-node
npm test

# Xây dựng múi giờ và API frontend
cd frontend
npm run dev
```

---

## 15. Lưu ý đặc biệt

- Nếu bạn dùng macOS với Docker Desktop, `host.docker.internal` là cách tốt nhất để kết nối từ container tới dịch vụ chạy trên host.
- Nếu gặp lỗi `import.meta.env`, khởi động lại server Vite hoặc đảm bảo tệp `vite-env.d.ts` tồn tại.
- Nếu MongoDB không khởi động đúng, kiểm tra lại `mongodb.key` và cấu hình Replica Set.

---

## 16. Tài liệu tham khảo

- `docker-compose.yml`: cấu hình dịch vụ chung
- `backend-node/README.md`: hướng dẫn chi tiết backend Node
- `backend-python/README.md`: hướng dẫn chi tiết backend Python
