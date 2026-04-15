# MODULE 2: Giao tiếp & Truy cập (Chat & Auth) - Requirements

Tài liệu này xác định các yêu cầu chức năng và phi chức năng cho Module 2, bao gồm hệ thống xác thực, quản lý không gian làm việc và giao tiếp thời gian thực.

## 1. Xác thực (Auth)
- **Mặc định:** Tạo sẵn 3 tài khoản Admin trong CSDL (bỏ qua bước đăng ký/đăng nhập tự do tạm thời).
- **Quản lý hồ sơ:**
    - Cập nhật ảnh đại diện (Upload REAL Google Drive).
    - Đổi mật khẩu.
    - Cập nhật thông tin cá nhân (Họ tên, ngày sinh, địa chỉ, số điện thoại).

## 2. Quản lý Không gian làm việc (Workspace)
- **Tạo Workspace:** Trưởng nhóm (Leader) tạo nhóm làm việc mới.
- **Quản lý thành viên:**
    - Mời thành viên vào Workspace.
    - Xóa thành viên khỏi Workspace.
    - Phân quyền nghiêm ngặt trong Workspace: `Leader`, `Member`, `Viewer`.
    - **Viewer Role:** Chỉ có quyền xem tin nhắn và tài liệu, không có quyền xóa tệp tin hoặc thay đổi cấu hình nhóm.

## 3. Nhắn tin nhóm (Real-time Chat)
- **Kết nối Real-time:** Sử dụng Socket.io với xác thực JWT bắt buộc cho mọi kết nối.
- **Chức năng nhắn tin:**
    - Gửi/Nhận tin nhắn văn bản tức thì.
    - Gửi tệp đính kèm (Lưu trữ Google Drive API thật).
    - Trả lời tin nhắn theo luồng (`Threaded Reply`).
    - Tag/Mention thành viên trong nhóm.
- **Lịch sử Chat:**
    - Lưu vào MongoDB với vector embedding.
    - Phân trang (Pagination) dựa trên limit/skip để tối ưu hiệu suất.

## 4. Tra cứu thông minh bằng AI (Smart Search/Chatbot)
- **Phân loại Intent:** Phân biệt yêu cầu hỏi đáp thông thường và tra cứu văn bản chuyên sâu.
- **RAG (Retrieval-Augmented Generation):**
    - Sử dụng Vector Search trên MongoDB để tìm kiếm ngữ cảnh liên quan.
    - Kết hợp ngữ cảnh từ lịch sử Chat để đưa vào Prompt cho LLM.
    - Trả lời thông qua Gemini AI API.

## 5. Quản lý Hệ thống (Admin System)
- **Dashboard:** Theo dõi tài nguyên hệ thống (CPU, RAM, DB Storage, Google Drive Quota).
- **Quản lý User:** Admin có quyền Khóa/Mở khóa tài khoản toàn cục.
- **Hệ thống Log (System Logs):** 
    - Ghi lại các thao tác thay đổi dữ liệu (**Audit log**).
    - Lưu vết User, hành động, thời gian và sự thay đổi dữ liệu (Old/New values).

## 6. Yêu cầu phi chức năng (Technical Excellence)
- **Hiệu năng:** Phản hồi Chat < 1000ms, AI Chatbot < 10s (tùy thuộc vào tốc độ API ngoài).
- **Bảo mật & Phân quyền nâng cao:**
    - Hash mật khẩu bằng bcryptjs, bảo mật JWT.
    - **Ownership Check:** Chỉ người tải lên (uploader) mới có quyền xóa file khỏi Drive và hệ thống, đảm bảo tính chống phá hoại dữ liệu.
- **Phân tách Logic:** Tuân thủ Controller - Service pattern.
- **ORM & Data Integrity:** Sử dụng **Prisma ORM (v6.19.3)** với MongoDB Replica Set để đảm bảo tính nhất quán dữ liệu qua Transactions.
- **Validation:** Sử dụng **Zod** làm thư viện validate tập trung.
- **Testing:** Đảm bảo độ tin cậy bằng bộ test tích hợp thực tế (Production-grade integration tests) phủ mọi kịch bản quan trọng.
- **Documentation:** Tự động hóa tài liệu API chuyên nghiệp bằng **Swagger (OpenAPI 3.0)**.
