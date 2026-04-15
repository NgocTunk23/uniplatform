# MODULE 2: Giao tiếp & Truy cập (Chat & Auth) - Requirements

## 1. Xác thực (Auth)
- **Mặc định:** Tạo sẵn 3 tài khoản Admin trong CSDL (bỏ qua bước đăng ký/đăng nhập tự do tạm thời).
- **Quản lý hồ sơ:**
    - Cập nhật ảnh đại diện (Upload Google Drive).
    - Đổi mật khẩu.
    - Cập nhật thông tin cá nhân (Họ tên, ngày sinh, địa chỉ, số điện thoại).

## 2. Quản lý Không gian làm việc (Workspace)
- **Tạo Workspace:** Trưởng nhóm tạo nhóm mới.
- **Quản lý thành viên:**
    - Mời thành viên vào Workspace.
    - Xóa thành viên khỏi Workspace.
    - Phân quyền trong Workspace (Leader/Member).

## 1. Kiến trúc hệ thống (Layered Architecture)

- **Database:** Sử dụng MongoDB Local.
- **Auth:** Sử dụng JWT cho xác thực người dùng.
- **Testing:** Sử dụng Jest + Supertest cho Integration & Unit Testing.

Cấu trúc thư mục cho `backend-node`:

## 3. Nhắn tin nhóm (Real-time Chat)
- **Kết nối Real-time:** Sử dụng Socket.io.
- **Chức năng nhắn tin:**
    - Gửi/Nhận tin nhắn văn bản.
    - Gửi tệp đính kèm (Lưu trữ Google Drive).
    - Trả lời tin nhắn (Reply).
    - Tag/Mention thành viên.
- **Lịch sử Chat:**
    - Lưu vào MongoDB.
    - Phân trang (Pagination) hoặc Cuộn vô hạn (Infinite Scroll).

## 4. Tra cứu thông minh bằng AI (Smart Search/Chatbot)
- **Phân loại Intent:** Phân biệt hỏi lịch trình và tra cứu văn bản.
- **RAG (Retrieval-Augmented Generation):**
    - Sử dụng Vector Search trên MongoDB.
    - Kết hợp ngữ cảnh từ lịch sử Chat và Biên bản họp.
    - Trả lời bằng Gemini API.

## 5. Quản lý Hệ thống (Admin System)
- **Dashboard:** Theo dõi CPU, RAM, DB Storage, Google Drive Quota.
- **Quản lý User:** Khóa/Mở khóa tài khoản, Force logout.
- **Hệ thống Log (System Logs):** 
    - Ghi lại các thao tác thay đổi dữ liệu (Audit log).
    - Lưu vết User, thời gian, hành động, dữ liệu cũ/mới.

## 6. Yêu cầu phi chức năng (Technical Excellence)
- **Hiệu năng:** Phản hồi Chat < 1000ms, AI Chatbot < 5s.
- **Bảo mật:** Hash mật khẩu bằng bcryptjs, JWT Secret, Google API Keys in `.env`.
- **Phân tách Logic:** Sử dụng Controller - Service - Service pattern để quản lý logic.
- **ORM & Data Integrity:** Chuyển đổi hoàn toàn sang **Prisma ORM (v6.19.3)**. Sử dụng MongoDB Single-node Replica Set để hỗ trợ transactions.
- **Validation:** Sử dụng **Zod** làm thư viện validate tập trung cho toàn bộ dữ liệu đầu vào thông qua `validate.middleware.js`.
- **Error Handling:** Quản lý tập trung thông qua `ApiError` class và `ERROR_CODES` hằng số.
- **Role Management:** Quản lý tập trung thông qua bộ hằng số `ROLES`.
- **Documentation:** Tự động hóa tài liệu API chuyên nghiệp bằng **Swagger (OpenAPI 3.0)**, truy cập tại `/api-docs`.
- **Testing:** Đảm bảo tính ổn định bằng bộ test Jest/Supertest chạy trên Database test biệt lập.
