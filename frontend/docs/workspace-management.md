# Workspace & Member Management (Frontend)

Tài liệu này hướng dẫn về các thành phần UI và logic nghiệp vụ liên quan đến quản lý Workspace trong Frontend.

## 1. Thành phần UI chính
- **`Sidebar.tsx`**: 
    - Chứa danh sách các Workspace (Work Groups).
    - Modal **"Create Workspace"** với thiết kế Glassmorphism cao cấp.
    - Logic tự động gán người tạo làm **Leader**.
- **`ChatInterface.tsx`**:
    - **Header**: Hiển thị tên Workspace và số lượng thành viên thực tế.
    - **Manage Members Modal**: Danh sách thành viên chi tiết với các hành động (Xóa/Phân quyền).
    - **Add Team Member Modal**: Form mời thành viên mới với dropdown phân quyền được thiết kế lại theo chuẩn Premium.

## 2. Logic Phân quyền & Bảo mật (RBAC)
Hệ thống áp dụng logic phân quyền ngay tại giao diện để tối ưu UX:

### Leader / System Admin
- Có quyền tạo Workspace mới.
- Có quyền mời thành viên mới và gán bất kỳ Role nào (`Leader`, `Member`, `Viewer`).
- Có quyền xóa thành viên khỏi nhóm.
- Toàn quyền chat và sử dụng AI.

### Member (Thành viên thường)
- Có quyền mời thành viên mới nhưng **chỉ được chọn** role `Member` hoặc `Viewer`.
- Không thấy nút "Xóa thành viên" trong danh sách quản lý.
- Toàn quyền chat và sử dụng AI.

### Viewer (Người xem)
- Chế độ **Read-only**.
- Khung nhập chat, nút đính kèm file và tính năng AI Summarize bị **disable**.
- Hiển thị thông báo: *"You have read-only access to this workspace"*.

## 3. Trải nghiệm người dùng (UX)
- **Định danh chuyên nghiệp**: Danh sách thành viên ưu tiên hiển thị **Full Name** từ CSDL. Username chỉ hiển thị phụ trợ trong ngoặc đơn.
- **Phản hồi tức thì**: Sử dụng `sonner` để hiển thị thông báo thành công/lỗi cho mọi thao tác quản trị.
- **Cập nhật thời gian thực**: Member count và member list được cập nhật ngay lập tức sau khi thêm thành viên thành công mà không cần load lại trang.
