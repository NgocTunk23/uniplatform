# UniPlatform Frontend

Ứng dụng web React/TypeScript của UniPlatform, chạy với Vite.

## 🚀 Yêu cầu

- Node.js 18+
- npm hoặc pnpm
- Backend Node đang chạy tại `http://localhost:5001`

## 🛠️ Cài đặt

```bash
cd frontend
npm install
```

## 🧪 Chạy ứng dụng

```bash
npm run dev
```

Mở truy cập:

```
http://localhost:5173
```

## 🌐 Biến môi trường

Frontend sử dụng biến Vite:

- `VITE_API_URL`: URL của backend Node. Mặc định `http://localhost:5001`

Trong Docker Compose, biến này đã được đặt sẵn.

## 📦 Lệnh hữu ích

- `npm run dev`: khởi chạy frontend trong chế độ phát triển.
- `npm run build`: build sản phẩm để deploy.
- `npm run preview`: xem bản build cục bộ.

## 🧩 Cấu trúc thư mục chính

```text
frontend/
├── public/         # Tài nguyên tĩnh
├── src/            # Mã nguồn ứng dụng
├── src/app/        # Component, routes, utilities
├── src/styles/     # Style, CSS
└── vite.config.ts  # Cấu hình Vite
```

## 📌 Ghi chú

- Nếu bạn gặp lỗi `import.meta.env`, kiểm tra tệp `frontend/src/vite-env.d.ts`.
- Đảm bảo backend Node đang chạy chính xác trước khi mở frontend.
