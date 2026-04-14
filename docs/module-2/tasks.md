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
- [ ] T2.5: Triển khai chức năng Quên mật khẩu (Bỏ qua tạm thời).

## Phase 3: Không gian làm việc (Workspace)
- [x] T3.1: Triển khai Mongoose Model cho `Workspace`.
- [x] T3.2: Viết APIs CRUD Workspace (Tạo, Sửa, Xóa).
- [x] T3.3: Viết chức năng Quản lý thành viên (Thêm, Xóa, Phân quyền).

## Phase 4: Nhắn tin & Socket.io (Chat)
- [x] T4.1: Triển khai Mongoose Model cho `Messages` và `Files`.
- [x] T4.2: Tái cấu trúc Socket.io code (chia module, xử lý Room theo Workspace).
- [x] T4.3: Lưu trữ tin nhắn vào DB và xử lý Pagination/Infinite Scroll.
- [x] T4.4: Tích hợp Google Drive API để upload/download file đính kèm.

## Phase 5: AI & Smart Search (AI Integration)
- [x] T5.1: Cấu hình Gemini API và Service xử lý AI.
- [x] T5.2: Triển khai logic tính toán Vector Embedding khi có tin nhắn mới.
- [x] T5.3: Xây dựng RAG Service (Search Vector + LLM Prompting).
- [x] T5.4: API/Socket Chat với Bot.

## Phase 6: Quản trị & Nhật ký (Admin & Logs)
- [x] T6.1: Triển khai Middleware SystemLog (lưu vết thao tác).
- [x] T6.2: Viết APIs Admin: Dashboard stats, Quản lý User (Khóa/Mở).
- [x] T6.3: Kiểm tra tổng thể (Testing) và hoàn thiện tài liệu Walkthrough.

## Phase 7: Kiểm thử (Testing)
- [x] T7.1: Cấu hình Jest và môi trường Test (Mongo Memory Server).
- [x] T7.2: Viết Unit Test cho Auth (Register, Login, Logout).
- [x] T7.3: Cập nhật tài liệu dự án Phase 2.

## Phase 8: Nâng cấp Kiến trúc (Architectural Upgrade)
- [x] T8.1: Di cư từ Mongoose sang **Prisma ORM**.
- [x] T8.2: Triển khai **Zod** Validation cho toàn bộ API endpoints.
- [x] T8.3: Tích hợp **Swagger/OpenAPI** cho tài liệu API chuyên nghiệp.
- [x] T8.4: Cấu hình **MongoDB Replica Set** và Centralized Error Handling.
- [x] T8.5: Hoàn thiện dữ liệu mẫu qua Prisma Seeding.
- [x] T8.6: Quản lý tập trung các hằng số (Error Codes, Roles).

---
🏁 **Module 2 Status: COMPLETED**
- Toàn bộ kiến trúc đã được hiện đại hóa với Prisma và Zod.
- Hệ thống Error Handling và Role management được tập trung hóa.
- Tài liệu API (Swagger) và Bộ test đã sẵn sàng 100%.
