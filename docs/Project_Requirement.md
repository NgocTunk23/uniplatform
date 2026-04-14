# TÀI LIỆU ĐẶC TẢ YÊU CẦU DỰ ÁN: UNIPLATFORM

## 1. Tổng quan dự án (Project Overview)

**UniPlatform** là một ứng dụng web "All-in-One" hỗ trợ quản lý công việc và giao tiếp nhóm, tích hợp sâu Trí tuệ Nhân tạo (AI).

- **Mục tiêu cốt lõi:**
  - Tự động hóa xếp lịch: Đề xuất khung giờ họp trống chung dựa trên lịch cá nhân.
  - Tích hợp giao tiếp & quản lý: Gộp Chat nhóm, lưu trữ tài nguyên (Google Drive), tạo biên bản họp.
  - Trợ lý ảo AI: Bóc băng ghi âm (Speech-to-Text), tóm tắt biên bản, tra cứu thông minh bằng RAG (Retrieval-Augmented Generation) từ lịch sử chat/biên bản.

---

## 2. Tech Stack (Công nghệ sử dụng)

Yêu cầu AI IDE thiết lập project với các công nghệ sau:

### 2.1 Backend Framework & AI Integration

- **Node.js (Express):** Máy chủ trung tâm xử lý logic cốt lõi, xác thực JWT, định tuyến API, xử lý kết nối WebSockets/Socket.io (dành cho Chat Real-time).
- **Python (FastAPI) - Microservice:** Chuyên trách xử lý logic phức tạp: Thuật toán quét lịch rảnh chung, vận hành hệ thống RAG (Vector Search) cho Chatbot AI.
- **Gemini API:** Trợ lý ảo AI, LLM phân tích Intent người dùng, tổng hợp/tóm tắt nội dung họp.
- **Google Cloud Speech-to-Text:** Nhận file ghi âm cuộc họp từ Google Meet, bóc băng chuyển thành văn bản thô (Raw Transcript).

### 2.2 Database & Storage

- **MongoDB Atlas:** Cơ sở dữ liệu chính (NoSQL Document-oriented). Sử dụng tính năng **Vector Search** để lưu trữ mảng vector nhúng (vector embeddings) phục vụ tra cứu AI.
- **Google Drive API:** Nơi lưu trữ vật lý các file đính kèm, biên bản, file ghi âm để giảm tải cho Database.

### 2.3 Frontend Framework

- **React.js:** Xây dựng giao diện hướng thành phần (Component-based).
- **Tailwind CSS:** Styling giao diện linh hoạt, hỗ trợ Responsive (Desktop, Tablet, Mobile).

---

## 3. Yêu cầu Phi chức năng (Non-Functional Requirements)

Yêu cầu AI IDE thiết lập các cấu hình sau khi setup kiến trúc:

- **Performance:** Phản hồi Chat < 1000ms. Thuật toán phân tích lịch < 3-5 giây. AI Chatbot trả lời < 5 giây. Cơ chế xử lý ngầm (background job) cho tính năng bóc băng ghi âm.
- **Security:** Mã hóa mật khẩu (Hash + Salt). Quản lý phiên bằng JSON Web Token (JWT). Lưu trữ an toàn các Keys/Tokens trong biến môi trường `.env`.
- **Architecture:** Clean Architecture / Layered Architecture (Controller, Service, Repository) cho Node.js backend. Code phải chia Module rõ ràng.

---

## 4. Phân rã Chức năng chi tiết (Functional Requirements & Use Cases)

Hệ thống chia làm 3 Role chính: **Thành viên** (Member), **Trưởng nhóm** (Leader/Admin Workspace), **Quản trị viên hệ thống** (System Admin).

### MODULE 1: Quản lý Lịch & Lưu trữ Tài nguyên

- **Quản lý lịch cá nhân (Schedules):** CRUD sự kiện/khung giờ rảnh bận. Frontend hiển thị lưới Calendar. Chặn dữ liệu lỗi (endtime < starttime, trùng lịch cố định).
- **Tạo cuộc họp thông minh (Smart Scheduling):** Trưởng nhóm nhập thông tin (Tiêu đề, Thời lượng, Thành viên). Hệ thống gọi thuật toán đối chiếu lịch của tất cả thành viên và trả về danh sách khung giờ trống chung tối ưu.
- **Tạo & Quản lý Biên bản cuộc họp (Meeting Minutes):**
  - _AI Auto-generation:_ Trợ lý ảo chạy ngầm chuyển Speech-to-Text từ file record, sau đó LLM tóm tắt quyết định, phân công nhiệm vụ.
  - _Review & Save:_ Trưởng nhóm rà soát nội dung điền sẵn, chỉnh sửa, đính kèm file (Upload lên Google Drive lấy URL), bấm "Lưu".
  - Hệ thống tự động nhúng văn bản thành Vector (Vector Embedding) lưu vào MongoDB.
- **Quản lý Tài liệu cá nhân:** Tải tệp lên Google Drive thông qua API. Đồng bộ Metadata (tên, size, URL) vào MongoDB.

### MODULE 2: Giao tiếp & Truy cập (Chat & Auth)

- **Xác thực (Auth):** Đăng nhập, Đăng xuất, Quên mật khẩu (OTP/Link), Quản lý hồ sơ (Đổi avatar, đổi mật khẩu).
- **Quản lý Không gian làm việc (Workspace):** Trưởng nhóm tạo Nhóm chat mới, Thêm/Xóa thành viên.
- **Nhắn tin nhóm (Real-time Chat):** \* Sử dụng Socket.io truyền tin nhắn, có hỗ trợ gửi file đính kèm.
  - Cơ chế cuộn để tải thêm tin nhắn cũ (Pagination/Infinite Scroll).
- **Tra cứu thông minh bằng AI (Smart Search/Chatbot):** \* Thành viên chat với Bot. Hệ thống phân loại Intent (Hỏi lịch trình vs Tra cứu văn bản).
  - Sử dụng Vector Search lấy ngữ cảnh từ lịch sử Chat và Biên bản họp để AI trả lời tự nhiên.
- **Quản lý Hệ thống (Dành riêng cho Admin System):** \* Dashboard theo dõi tài nguyên (CPU/RAM, DB Storage, Google Drive API Quota limits).
  - Quản lý User: Khóa/Mở khóa tài khoản (Force logout nếu đang online).
  - Lưu vết (System Logs): Ghi lại các thao tác quan trọng (thời gian, user, hành động thay đổi, field dữ liệu cũ/mới).

---

## 5. Thiết kế Cơ sở Dữ liệu (Database Schema)

Yêu cầu AI IDE thiết lập các Models trong Mongoose (Node.js) hoặc Pydantic/Motor (FastAPI) theo đúng cấu trúc sau. Cần tích hợp cấu hình Vector Index cho các mảng `vectorembedding`.

**1. Bảng `User`**

- `username`: string (Primary Key)
- `password`: string (Hashed)
- `fullname`: string
- `role`: string (Member, Leader, Admin)
- `dateofbirth`: date
- `address`: string
- `email`: string (Unique)
- `phone`: string
- `status`: string (active, locked)
- `createdat`: timestamp
- `imageuser`: string (URL)

**2. Bảng `Workspace`**

- `workspaceid`: string (PK)
- `name`: string
- `admin`: string (Ref to User.username)
- `member`: Array of Objects `[{ username: string, workspacerole: string, joinedat: timestamp }]`
- `createdat`: timestamp

**3. Bảng `Schedules` (Lịch trình cá nhân)**

- `scheduleid`: string (PK)
- `username`: string (Ref to User)
- `title`: string
- `description`: string
- `starttime`: timestamp
- `endtime`: timestamp
- `type`: string (Rảnh / Bận)
- `createat`: timestamp

**4. Bảng `Messages` (Lịch sử Chat)**

- `messageid`: string (PK)
- `workspaceid`: string (Ref to Workspace)
- `senderusername`: string
- `content`: string
- `createat`: timestamp
- `reply`: string (Self-ref messageid nếu có)
- `userid`: Array of strings (Danh sách tag/mention)
- `vectorembedding`: Array of numbers (Phục vụ AI Vector Search)

**5. Bảng `Meeting` (Cuộc họp)**

- `meetingid`: string (PK)
- `workspaceid`: string
- `title`: string
- `starttime`: timestamp
- `endtime`: timestamp
- `organizer`: string (Ref to User)
- `participants`: Array of strings (usernames)
- `status`: string
- `createat`: timestamp
- `lmk` (Link/Location): string
- `place`: string
- `bot_status`: string
- `recording_file`: string (Google Drive URL/ID)

**6. Bảng `MeetingMinutes` (Biên bản cuộc họp)**

- `meetingminuteid`: string (PK)
- `meetingid`: string (Ref to Meeting)
- `createby`: string
- `content`: string
- `task`: Array (Chứa phân công công việc)
- `createat`: timestamp
- `updateat`: timestamp
- `raw_transcript`: string (Nội dung bóc băng thô từ AI)
- `summary`: string (Tóm tắt từ AI)
- `decisions`: Array of strings
- `isbotgenerated`: boolean
- `vectorembedding`: Array of numbers (Phục vụ AI Vector Search)

**7. Bảng `Files` (Quản lý File Google Drive)**

- `fileid`: string (PK)
- `uploader`: string (Ref to User)
- `messageid`: string (Optional, ref to Messages)
- `meetingminuteid`: string (Optional, ref to MeetingMinutes)
- `filename`: string
- `ggid`: string (Google Drive File ID)
- `typefile`: string
- `sizefile`: string
- `createat`: timestamp

**8. Bảng `SystemLog` (Nhật ký Hệ thống)**

- `logid`: string (PK)
- `actorusername`: string
- `targetresource`: string (Tên bảng bị tác động)
- `targetid`: string (ID của bản ghi)
- `changes`: Array of Objects `[{ field: string, new: any, old: any }]`
- `createat`: timestamp
