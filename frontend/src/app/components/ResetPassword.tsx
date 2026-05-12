import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token') || '';
    setToken(tokenFromUrl);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Token đặt lại mật khẩu không hợp lệ. Vui lòng kiểm tra lại liên kết.');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ mật khẩu mới và xác nhận mật khẩu.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu và xác nhận mật khẩu không khớp.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Không thể đặt lại mật khẩu.');
      }

      setSuccess('Đặt lại mật khẩu thành công. Bạn đang được chuyển về trang đăng nhập...');
      localStorage.setItem('uniplatform_logout', Date.now().toString());
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft size={18} /> Quay lại đăng nhập
        </button>

        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Đặt lại mật khẩu</h1>
        <p className="text-sm text-slate-500 mb-6">
          Nhập mật khẩu mới của bạn để hoàn tất quá trình đặt lại. Nếu link đã hết hạn, hãy yêu cầu lại.
        </p>

        {!token && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-rose-700 mb-6">
            Token không hợp lệ hoặc liên kết đã bị thay đổi.
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-rose-700 mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-700 mb-6">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Mật khẩu mới</label>
            <div className="mt-2 relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none"
                placeholder="Nhập mật khẩu mới"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600">Xác nhận mật khẩu</label>
            <div className="mt-2 relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none"
                placeholder="Nhập lại mật khẩu mới"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !token}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}
