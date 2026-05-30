# UniPlatform

UniPlatform là một hệ thống quản lý họp nhóm, làm việc cùng nhau và ghi âm hội nghị với AI hỗ trợ.

## Tổng quan

Dự án bao gồm:

- `frontend/`: ứng dụng web React + Vite.
- `backend-node/`: API chính bằng Node.js và Express.
- `backend-python/`: dịch vụ transcription bằng Python.
- `docker-compose.yml`: cấu hình MongoDB, Ollama, frontend, backend-node và backend-python.

## Liên kết mặc định

- Frontend: `http://localhost:5173`
- Backend Node API: `http://localhost:5001`
- Backend Python Swagger: `http://localhost:8000/docs`

## Hướng dẫn nhanh

### 1. Sao chép cấu hình môi trường

```bash
cp .env.example .env
```

### 2. Khởi động toàn bộ dịch vụ bằng Docker

```bash
docker compose up --build
```

Hoặc chạy nền:

```bash
docker compose up -d --build
```

### 3. Khi cần dừng dịch vụ

```bash
docker compose down
```

### 4. Chạy frontend thủ công

```bash
cd frontend
npm install
npm run dev
```

### 5. Chạy backend-node thủ công

```bash
cd backend-node
npm install
npx prisma generate
npm run dev
```

### 6. Chạy backend-python thủ công

```bash
cd backend-python
python3 -m venv venv
venv/bin/python -m pip install -r requirements.txt
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Tài liệu cài đặt chi tiết

Xem `INSTALLATION.md` để có hướng dẫn đầy đủ từ đầu đến cuối, gồm các bước cài đặt MongoDB, Ollama, Google Drive, môi trường và chạy thử.

## Cấu trúc thư mục chính

```text
frontend/
backend-node/
backend-python/
docker-compose.yml
.env.example
INSTALLATION.md
```

## Ghi chú quan trọng

- Nếu bạn chạy backend Node trong Docker Desktop trên macOS, hãy kiểm tra cấu hình `OLLAMA_BASE_URL`.
- Nếu gặp lỗi `import.meta.env`, kiểm tra tệp `vite-env.d.ts` trong `frontend/src`.

---

## Các tài nguyên tham khảo

- `frontend/README.md`: hướng dẫn chi tiết cho frontend.
- `backend-node/README.md`: hướng dẫn chi tiết cho backend Node.
- `backend-python/README.md`: hướng dẫn chi tiết cho backend Python.
- `INSTALLATION.md`: cài đặt đầy đủ và bước chi tiết.
