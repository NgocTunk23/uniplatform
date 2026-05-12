import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes'; // Import đúng biến router từ file routes.tsx
import { Toaster } from 'sonner';

function App() {
  useEffect(() => {
    const logoutAndRedirect = () => {
      localStorage.removeItem('uniplatform_authenticated');
      localStorage.removeItem('uniplatform_user_token');
      localStorage.removeItem('uniplatform_user_email');
      localStorage.removeItem('uniplatform_username');
      localStorage.removeItem('uniplatform_fullname');
      localStorage.setItem('uniplatform_logout', Date.now().toString());

      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    };

    const originalFetch = window.fetch.bind(window);
    const patchFetch = async (...args: Parameters<typeof window.fetch>) => {
      const response = await originalFetch(...args);
      const token = localStorage.getItem('uniplatform_user_token');
      if (token && response && (response.status === 401 || response.status === 403)) {
        logoutAndRedirect();
      }
      return response;
    };

    (window as any).fetch = patchFetch;

    const checkAuth = async () => {
      const token = localStorage.getItem('uniplatform_user_token');
      if (!token) {
        return;
      }

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        const response = await fetch(`${apiUrl}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok && (response.status === 401 || response.status === 403)) {
          logoutAndRedirect();
        }
      } catch (error) {
        console.error('Auth check failed', error);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (!event.key) {
        return;
      }

      if (event.key === 'uniplatform_logout') {
        logoutAndRedirect();
      }

      if (event.key === 'uniplatform_authenticated' && event.newValue !== 'true') {
        logoutAndRedirect();
      }

      if (event.key === 'uniplatform_user_token' && !event.newValue) {
        logoutAndRedirect();
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    checkAuth();

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      (window as any).fetch = originalFetch;
    };
  }, []);

  // Sử dụng RouterProvider với biến router đã cấu hình
  return (
    <>
      <Toaster position="top-right" richColors />
      <RouterProvider router={router} />
    </>
  );
}

export default App;