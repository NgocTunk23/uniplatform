# MODULE 2 Walkthrough: From Foundation to Production Reliability

Tài liệu này ghi chép lại hành trình phát triển Module 2, từ việc xây dựng cấu trúc cơ bản đến việc kiểm chứng hệ thống ở cấp độ Production.

## 1. Các giai đoạn phát triển chính

### Giai đoạn 1: Thiết lập nền tảng (Foundation)
- Khởi tạo kiến trúc Layered Architecture (Controller - Service - Router).
- Chuyển đổi toàn bộ hệ thống từ Mongoose sang **Prisma ORM** để tối ưu hóa hiệu suất và tính toàn vẹn dữ liệu.
- Thiết lập hệ thống mã lỗi tập trung (`ErrorCode`) và phân quyền (`ROLES`).

### Giai đoạn 2: Phát triển tính năng lõi (Core Features)
- **Auth:** Hoàn thiện luồng Register/Login/Profile với JWT.
- **Workspace:** Triển khai quản lý nhóm và phân quyền Leader/Member/Viewer.
- **Real-time Chat:** Xây dựng hệ thống Chat qua Socket.io, hỗ trợ Threaded Replies và Mentions.
- **Cloud Storage:** Tích hợp Google Drive API cho việc lưu trữ tệp tin đính kèm.

### 🛡️ Admin (`/api/admin`)
- `GET /stats`: Xem chỉ số sức khỏe hệ thống (CPU, RAM, DB, **Google Drive Quota**).
- `GET /users`: Quản lý danh sách toàn bộ người dùng.
- `PATCH /users/:id/status`: Khóa hoặc mở khóa tài khoản người dùng (Ghi Audit Log).
- `POST /users/:id/force-logout`: Cưỡng chế đăng xuất người dùng ngay lập tức.
- `GET /logs`: Xem nhật ký thao tác chi tiết (**Audit Logs với Old/New values**).

### Giai đoạn 3: Tích hợp AI & RAG
- Sử dụng Gemini API để tạo Embeddings cho mọi tin nhắn.
- Xây dựng **RAG Service** cho phép UniBot truy vấn thông tin từ lịch sử hội thoại để hỗ trợ người dùng.

## 3. Giai đoạn 4: Securing & Monitoring (Hardening)
Đây là bước cuối cùng để đưa hệ thống đạt chuẩn Production-grade:
- **Cơ chế Force Logout:** Triển khai `tokenVersion` để cho phép Admin vô hiệu hóa phiên làm việc của User ngay lập tức.
- **Audit Logging:** Xây dựng bộ so sánh dữ liệu (Diff) để lưu vết chi tiết các thay đổi nhạy cảm trong hệ thống.
- **Drive Monitoring:** Dashboard Admin hiển thị trực quan hạn mức lưu trữ Google Drive.
- **AI Stability:** Chuyển đổi sang `text-embedding-004` và chuẩn hóa endpoint `v1beta` để loại bỏ hoàn toàn lỗi 404.

## 4. Kết quả xác minh cuối cùng (Verification)

Hệ thống đã trải qua kỳ kiểm thử "Dự án Alpha" cực kỳ khắt khe:
- **Tỷ lệ vượt qua:** 100% (48/48 test cases).
- **Phạm vi:** Kiểm tra từ Auth, Workspace, Chat, File thật, AI thật, cho đến Security Hardening (Audit logs, Force logout).
- **Độ ổn định:** Vượt qua kỳ test liên tục 8 bộ test suite mà không gặp lỗi mạng hay lỗi logic.

🏁 **Tình trạng Module 2:** **HOÀN THÀNH (CERTIFIED)**
Hệ thống hiện tại không chỉ hoạt động tốt mà còn cực kỳ vững chắc, sẵn sàng để mở rộng các tính năng AI chuyên sâu hơn trong Module 3.
