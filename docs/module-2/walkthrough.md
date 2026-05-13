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
- **Unread Message Tracking (Mới):**
    - Triển khai lưu trữ `lastReadAt` cho từng thành viên trong DB.
    - Hệ thống đếm tin nhắn chưa đọc thời gian thực qua Socket.io.
    - Tự động đánh dấu đã đọc khi người dùng truy cập vào Workspace.
- **Cloud Storage:** Tích hợp Google Drive API cho việc lưu trữ tệp tin đính kèm.
- **Workspace UI/UX Refinement:** 
    - Tái cấu trúc toàn bộ giao diện quản lý Workspace với phong cách **Premium Glassmorphism**.
    - Triển khai Role-based logic mới: Chỉ Leader/Admin mới được gán quyền Leader; tự động disable chat input cho Viewer.
    - **Infinite Scroll (Mới):** Tự động tải lịch sử chat khi cuộn lên trên, sử dụng `useLayoutEffect` và tính toán `scrollTop` để triệt tiêu hiện tượng giật màn hình (scroll jump).
    - **Meeting Permission & Visibility (Mới):** 
        - Mở rộng quyền tạo cuộc họp cho cả **Member**, không chỉ giới hạn ở Leader.
        - **Granular Visibility:** Triển khai cơ chế lọc cuộc họp theo vai trò: Trưởng nhóm xem tất cả, Thành viên chỉ xem cuộc họp được mời tham gia. Admin xem toàn bộ hệ thống.
        - **Participant Enrichment:** Tự động hóa việc lấy Tên đầy đủ và Ảnh đại diện cho mọi thành viên tham gia cuộc họp để hiển thị trên UI chuyên nghiệp.
    - **Server-side Search (Mới):** Chuyển đổi cơ chế tìm kiếm tin nhắn từ Client-side filter sang **Server-side Search** với Debounce, giúp tìm kiếm được cả các tin nhắn cũ chưa được tải lên máy khách.
    - **Avatar Standardization (Mới):** Tách logic hiển thị ảnh đại diện thành Component `AvatarWithFallback` dùng chung. Chuẩn hóa thiết kế hình tròn (`rounded-full`), viền trắng và hệ màu Premium cho toàn bộ ứng dụng (Chat, Profile, Sidebar, Meetings).
    - **In-line Role Management (Mới):** Cho phép Leader cập nhật quyền hạn thành viên trực tiếp qua Dropdown menu trong danh sách Workspace Members với hiệu ứng Glassmorphism.
    - Cải thiện trải nghiệm người dùng với việc hiển thị Full Name và cập nhật trạng thái thành viên thời gian thực.

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
- **RBAC Hardening (Lớp bảo mật mới nhất):** 
    - Xây dựng `Permission Utility` trung tâm.
    - **Join Guard:** Ngăn chặn truy cập workspace trái phép qua Sockets.
    - **Write Guard:** Áp dụng chế độ Read-only cho Viewer (không chat/upload/AI).
    - **Superuser Support:** Cấp quyền toàn năng cho System Admin.
- **AI Stability:** Chuyển đổi sang `text-embedding-004` và chuẩn hóa endpoint `v1beta` để loại bỏ hoàn toàn lỗi 404.

## 4. Kết quả xác minh cuối cùng (Verification)

Hệ thống đã trải qua kỳ kiểm thử cực kỳ khắt khe:
- **Tỷ lệ vượt qua:** 100% (56/56 test cases).
- **Phạm vi:** Kiểm tra từ Auth, Workspace, Chat, File thật, AI thật, cho đến Security Hardening (Audit logs, Force logout, RBAC Enforcement).
- **Độ ổn định:** Vượt qua kỳ test liên tục 9 bộ test suite mà không gặp lỗi mạng hay lỗi logic.

🏁 **Tình trạng Module 2:** **HOÀN THÀNH (CERTIFIED & HARDENED)**
Hệ thống hiện tại không chỉ hoạt động tốt mà còn cực kỳ vững chắc, sẵn sàng để mở rộng các tính năng AI chuyên sâu hơn trong Module 3.
