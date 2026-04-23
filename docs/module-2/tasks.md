# MODULE 2: Giao tiếp & Truy cập (Chat & Auth) - Tasks

## Phase 1: Khởi tạo & Cấu trúc (Foundation)
- [x] T1.1: Thiết lập cấu trúc thư mục `src/` theo Layered Architecture.
- [x] T1.2: Cấu hình biến môi trường (`.env` với placeholders) và kết nối MongoDB Local.
- [x] T1.3: Cài đặt các dependencies cần thiết (mongoose, socket.io, dotenv, v.v.).
- [x] T1.4: Tạo mã nguồn Seed dữ liệu: Tự động khởi tạo 3 tài khoản Admin mặc định.

## Phase 2: Xác thực & Người dùng (Auth & User)
- [x] T2.1: Triển khai Mongoose Model cho `User`.
- [x] T2.2: Viết APIs Đăng ký, Đăng nhập, Đăng xuất (JWT).
- [x] T2.3: Triển khai Middleware Auth.
- [x] T2.4: Viết APIs Quản lý hồ sơ (Profile, Avatar, Password).
- [x] T2.5: Triển khai chức năng Quên mật khẩu (Flow giả lập OTP qua Console).

## Phase 3: Không gian làm việc (Workspace)
- [x] T3.1: Triển khai Model `Workspace` (Prisma).
- [x] T3.2: Viết APIs CRUD Workspace (Tạo, Sửa, Xóa).
- [x] T3.3: Viết chức năng Quản lý thành viên (Thêm, Xóa, Phân quyền Leader/Member/Viewer).

## Phase 4: Nhắn tin & Socket.io (Chat)
- [x] T4.1: Triển khai Model `Messages` và `Files` (Prisma).
- [x] T4.2: Tái cấu trúc Socket.io code (Vòng đời kết nối, Room theo Workspace).
- [x] T4.3: Lưu trữ tin nhắn vào DB và xử lý Pagination/Infinite Scroll.
- [x] T4.4: Tích hợp Google Drive API (v3) qua chế độ **OAuth2 (Refresh Token)**.
- [x] T4.5: Ràng buộc quyền sở hữu File (Chỉ uploader mới được xóa).

## Phase 5: AI & Smart Search (AI Integration)
- [x] T5.1: Cấu hình Gemini API (Model: `gemini-1.5-flash`).
- [x] T5.2: Triển khai logic tính toán Vector Embedding (Model: `text-embedding-004`).
- [x] T5.3: Xây dựng RAG Service (Search Vector + LLM Prompting).
- [x] T5.4: API/Socket Chat với UniBot.

## Phase 6: Quản trị & Nhật ký (Admin & Logs)
- [x] T6.1: Triển khai Audit Logger Utility (Lưu vết Old/New values).
- [x] T6.2: Viết APIs Admin: Dashboard stats (CPU, RAM, Drive Quota), Quản lý User (Khóa/Mở).
- [x] T6.3: Cơ chế cưỡng chế đăng xuất (Force Logout via tokenVersion).

## Phase 7: Kiểm thử & Chứng nhận (Production Hardware)
- [x] T7.1: Viết Integration Test cho Auth, Chat, File (MockDrive).
- [x] T7.2: Viết **Production-Grade Case Study** (Test real 100% với GDrive thật/AI thật).
- [x] T7.3: Viết **Admin Hardening Test** (Kiểm thử Security/Audit logs).
- [x] T7.4: Viết **RBAC & Security Hardening Test** (Kiểm thử phân quyền chéo, Viewer restriction).
- [x] T7.5: Đạt tỷ lệ Pass 100% cho toàn bộ 9 bộ test suite.

---
🏁 **Module 2 Status: 100% COMPLETED**
- Toàn bộ kiến trúc hiện đại (Prisma, Zod, Swagger).
- Hệ thống bảo mật đa tầng (RBAC, Ownership, Session Revocation).
- Tích hợp AI RAG và Real-time Chat ổn định.
- Sẵn sàng bàn giao cho giai đoạn tích hợp Frontend.
