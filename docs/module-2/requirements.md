# MODULE 2: Giao tiếp & Truy cập (Chat & Auth) - Requirements

Tài liệu này xác định các yêu cầu chức năng và phi chức năng cho Module 2, bao gồm hệ thống xác thực, quản lý không gian làm việc và giao tiếp thời gian thực.

## 1. Xác thực (Auth)
- **Mặc định:** Tạo sẵn 3 tài khoản Admin trong CSDL (bỏ qua bước đăng ký/đăng nhập tự do tạm thời).
- **Quản lý hồ sơ:**
    - Cập nhật ảnh đại diện (Upload REAL Google Drive).
    - Đổi mật khẩu.
    - Cập nhật thông tin cá nhân (Họ tên, ngày sinh, địa chỉ, số điện thoại).
- **Đăng xuất & Cưỡng chế đăng xuất (Force Logout):**
   - **Đăng xuất tự nguyện:** Client xóa Token.
   - **Force Logout (Admin):** 
     - Admin tăng giá trị `tokenVersion` trong Database của User.
     - Middleware `protect` so sánh `tokenVersion` trong JWT với DB. Nếu version trong JWT thấp hơn -> Token bị coi là hết hạn.
     - Cơ chế này hoạt động cho cả API (HTTP) và kết nối Real-time (Socket.io).

## 2. Quản lý Không gian làm việc (Workspace)
- **Tạo Workspace:** Trưởng nhóm (Leader) tạo nhóm làm việc mới.
- **Quản lý thành viên:**
    - Mời thành viên vào Workspace: Cho phép **mọi thành viên** (ngoại trừ Viewer) có thể mời người mới vào nhóm để tăng tính cộng tác.
    - Xóa thành viên khỏi Workspace: Chỉ có **Leader** hoặc **System Admin** mới có quyền trục xuất thành viên.
    - Hiển thị danh sách: Ưu tiên hiển thị **Họ và tên (Full Name)** của thành viên để tăng tính chuyên nghiệp, username được hiển thị phụ trợ.
    - Phân quyền nghiêm ngặt trong Workspace: `Leader`, `Member`, `Viewer`.
    - **Bảo mật phân quyền (Role Assignment Security):** Chỉ có **Leader** hoặc **System Admin** mới có quyền chỉ định người khác làm `Leader`. Thành viên bình thường khi mời người mới chỉ được chọn role `Member` hoặc `Viewer`.
    - **Viewer Role:** Chế độ **Read-only**. Hệ thống tự động vô hiệu hóa (disable) toàn bộ khung nhập chat, nút đính kèm tệp và các tính năng tương tác (AI Summarize) đối với người dùng có vai trò này.
- **Quyền Quản trị tối cao (System Admin):** Vai trò `Admin` hệ thống được cấp quyền Superuser, có thể truy cập mọi Workspace và xóa bất kỳ tệp tin nào để hỗ trợ quản trị và bảo trì.

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
    - **Infinite Scroll:** Hỗ trợ cuộn ngược để tự động tải thêm tin nhắn cũ trên giao diện Frontend (sử dụng `useLayoutEffect` để chống nhảy màn hình).
    - **Server-side Search (Mới):** Triển khai tìm kiếm tin nhắn trực tiếp từ cơ sở dữ liệu với cơ chế **Debounce** (500ms). Cho phép tìm kiếm xuyên suốt toàn bộ lịch sử trò chuyện thay vì chỉ lọc trên các tin nhắn đã tải về trình duyệt.

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
    - Ghi lại bản ghi chi tiếp các thao tác thay đổi dữ liệu (**Audit log**).
    - Lưu vết User, hành động, thời gian và sự thay đổi dữ liệu (So sánh giá trị **Old/New values**).
- **Cưỡng chế đăng xuất (Force Logout):** Admin có quyền vô hiệu hóa phiên làm việc của bất kỳ người dùng nào ngay lập tức (Real-time).

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
- **Avatar Normalization (Mới):** Xây dựng hàm tiện ích `getAvatarUrl` tập trung để xử lý các loại định dạng ảnh từ Google Drive (Link Drive, ID nguyên chất), tự động chuyển đổi sang link trực tiếp thông qua `lh3.googleusercontent.com` để đảm bảo hiển thị ổn định trên toàn hệ thống.

## 7. Frontend Architecture & Implementation (React + Vite)
- **State Management & Auth:**
    - Sử dụng `localStorage` để lưu trữ token (`uniplatform_user_token`) và thông tin người dùng.
    - Component `App.tsx` tự động kiểm tra token hợp lệ khi khởi tạo ứng dụng thông qua `/api/auth/me`. Xử lý log out an toàn khi nhận `401/403` từ API, ngăn chặn lỗi mất phiên làm việc do network error.
    - Sử dụng `ProtectedRoute` để bảo vệ các route yêu cầu xác thực.
- **Quản lý Workspace (Sidebar):**
    - Component `Sidebar.tsx` gọi API `/api/workspaces` để load danh sách Work Groups động.
    - Workspace ID được truyền qua context/props sang `ChatInterface` và `RightPanel`.
- **Real-time Chat (`ChatInterface.tsx`):**
    - Sử dụng `socket.io-client` để kết nối với server.
    - Cấu trúc tin nhắn hỗ trợ văn bản, tệp đính kèm (UI Drive mockup), và trả lời theo luồng.
    - Tự động fetch lịch sử tin nhắn từ `/api/messages/:workspaceId`.
    - Lắng nghe event `receive_message` và `receive_message_confirmed` để cập nhật UI mượt mà.
- **Tích hợp AI Chatbot (`UniBot`):**
    - Hỗ trợ command `/ai [câu hỏi]` trực tiếp trong input box.
    - Nút "Sparkles" dùng để gọi lệnh tóm tắt toàn bộ nội dung chat hiện tại thông qua event `ASK_AI`.
    - Phân tách giao diện tin nhắn của `UniBot` (màu gradient) để dễ phân biệt với người dùng.

## 8. Quản lý Cuộc họp (Meeting System)
### Backend Requirements:
- **Quản lý lịch họp:** Hỗ trợ tạo, cập nhật trạng thái (`upcoming`, `ongoing`, `ended`) cho các cuộc họp trong Workspace.
- **Biên bản cuộc họp (Meeting Minutes):** Lưu trữ nội dung tóm tắt, quyết định và nhiệm vụ từ cuộc họp (hỗ trợ lưu trữ dữ liệu do Bot tạo ra).
- **API Endpoints:**
    - `GET /api/meetings`: Lấy danh sách tất cả cuộc họp của người dùng.
    - `POST /api/meetings`: Lập lịch cuộc họp mới.
    - `GET /api/meetings/:id`: Chi tiết cuộc họp.
    - `PUT /api/meetings/:id/status`: Cập nhật trạng thái cuộc họp.
    - **Meeting Permission & Visibility (Mới):** 
        - Mở rộng quyền tạo cuộc họp cho cả **Member**, không chỉ giới hạn ở Leader.
        - **Granular Visibility:** Triển khai cơ chế lọc cuộc họp theo vai trò: Trưởng nhóm xem tất cả, Thành viên chỉ xem cuộc họp được mời tham gia. Admin xem toàn bộ hệ thống.
        - **Participant Enrichment:** Tự động hóa việc lấy Tên đầy đủ và Ảnh đại diện cho mọi thành viên tham gia cuộc họp để hiển thị trên UI.
    - **Search Optimization (Mới):** Chuyển đổi cơ chế tìm kiếm tin nhắn từ Client-side filter sang **Server-side Search**, giúp tìm kiếm được cả các tin nhắn cũ chưa được tải lên máy khách.
    - Cải thiện trải nghiệm người dùng với việc hiển thị Full Name và cập nhật trạng thái thành viên thời gian thực.

### Frontend Implementation:
- **Lịch biểu cuộc họp (`MeetingsSchedule.tsx`):**
    - Hiển thị danh sách cuộc họp theo tab: Tất cả, Sắp tới, Đã diễn ra.
    - Chức năng "Schedule Meeting" cho phép Thành viên hoặc Leader tạo cuộc họp mới thông qua Modal.
- **Phòng họp (`MeetingRoom.tsx`):**
    - Giao diện Video Grid mockup với điều khiển Mic/Camera.
    - **Tích hợp Chat Workspace:** Nhúng trực tiếp `ChatInterface` vào phòng họp để người dùng trao đổi trong lúc thảo luận, đảm bảo tính đồng bộ dữ liệu với Workspace chính.
- **Enriched Participant Data (Mới):** Tất cả các API lấy thông tin cuộc họp tự động trả về thông tin chi tiết của người tham gia (Full Name, Avatar) để hiển thị giao diện chuyên nghiệp thay vì chỉ dùng Username.

