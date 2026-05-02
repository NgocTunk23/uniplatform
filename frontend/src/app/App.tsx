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
            // Chỉ xóa token khi server trả về 401 (Unauthorized) hoặc 403 (Forbidden)
            // Không xóa nếu lỗi mạng (500) hoặc các lỗi khác
            if (response.status === 401 || response.status === 403) {
              localStorage.removeItem('uniplatform_authenticated');
              localStorage.removeItem('uniplatform_user_token');
              localStorage.removeItem('uniplatform_user_email');
              localStorage.removeItem('uniplatform_username');
              localStorage.removeItem('uniplatform_fullname');
              
              // Force reload or redirect if needed, but currently ProtectedRoute handles it if state changes
              // window.location.href = '/login'; 
            }
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