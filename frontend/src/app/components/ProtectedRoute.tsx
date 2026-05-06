import { Navigate, Outlet, useSearchParams } from 'react-router';
import { useEffect } from 'react';

export const ProtectedRoute = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Kiểm tra token từ URL (cho OAuth callback)
  useEffect(() => {
    const token = searchParams.get('token');
    const username = searchParams.get('username');
    const email = searchParams.get('email');
    const fullname = searchParams.get('fullname');

    if (token) {
      // Lưu thông tin từ OAuth vào localStorage
      localStorage.setItem('uniplatform_authenticated', 'true');
      localStorage.setItem('uniplatform_user_token', token);
      if (username) localStorage.setItem('uniplatform_username', username);
      if (email) localStorage.setItem('uniplatform_email', email);
      if (fullname) localStorage.setItem('uniplatform_fullname', decodeURIComponent(fullname));

      // Xóa params khỏi URL
      searchParams.delete('token');
      searchParams.delete('username');
      searchParams.delete('email');
      searchParams.delete('fullname');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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