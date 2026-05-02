import { Navigate, Outlet } from 'react-router';

export const ProtectedRoute = () => {
  // Kiểm tra trạng thái đăng nhập từ localStorage
  const isAuthenticated = localStorage.getItem('uniplatform_authenticated') === 'true';
  const token = localStorage.getItem('uniplatform_user_token');

  // Nếu không có token hoặc chưa xác thực, điều hướng về trang login
  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  // Nếu hợp lệ, cho phép hiển thị các trang con bên trong (Outlet)
  return <Outlet />;
};