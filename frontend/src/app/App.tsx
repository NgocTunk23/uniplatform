import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes'; // Import đúng biến router từ file routes.tsx

function App() {
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('uniplatform_user_token');
      if (token) {
        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
          const response = await fetch(`${apiUrl}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!response.ok) {
            // Nếu API /me báo lỗi (token fake/hết hạn), xóa dữ liệu cũ
            localStorage.removeItem('uniplatform_authenticated');
            localStorage.removeItem('uniplatform_user_token');
          }
        } catch (error) {
          console.error("Auth check failed", error);
        }
      }
    };
    checkAuth();
  }, []);

  // Sử dụng RouterProvider với biến router đã cấu hình
  return <RouterProvider router={router} />;
}

export default App;