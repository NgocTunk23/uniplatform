import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Mail, Lock, Eye, EyeOff, LogIn, GraduationCap, Github, User, ArrowLeft, Send } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot_password';

export function Login() {
  const navigate = useNavigate();
  
  // State quản lý chế độ hiển thị
  const [mode, setMode] = useState<AuthMode>('login');

  // States cho Form
  const [identifier, setIdentifier] = useState(''); // Dùng cho login
  const [username, setUsername] = useState(''); // Dùng cho register
  const [email, setEmail] = useState(''); // Dùng cho register & forgot password
  const [password, setPassword] = useState('');
  const [fullname, setFullname] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

  // ================= 1. XỬ LÝ ĐĂNG NHẬP =================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!identifier || !password) {
      setError('Vui lòng nhập Email hoặc Username và mật khẩu');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Đăng nhập thất bại.');

      // Lưu trữ trạng thái và thông tin
      const token = data.token || data.data?.token;
      localStorage.setItem('uniplatform_authenticated', 'true');
      localStorage.setItem('uniplatform_user_token', token);
      localStorage.setItem('uniplatform_username', data.username || '');
      localStorage.setItem('uniplatform_fullname', data.fullname || 'User');
      
      navigate('/chat');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ================= 2. XỬ LÝ ĐĂNG KÝ =================
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!username || !email || !password || !fullname) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, fullname }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Đăng ký thất bại.');

      // Tự động đăng nhập sau khi đăng ký thành công
      localStorage.setItem('uniplatform_authenticated', 'true');
      localStorage.setItem('uniplatform_user_token', data.token);
      localStorage.setItem('uniplatform_username', data.username);
      localStorage.setItem('uniplatform_fullname', data.fullname);
      
      navigate('/chat');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ================= 3. XỬ LÝ QUÊN MẬT KHẨU =================
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email) {
      setError('Vui lòng nhập email của bạn');
      return;
    }

    setIsLoading(true);
    try {
      // Thay đổi endpoint này theo API thực tế của bạn
      const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) throw new Error('Không thể gửi yêu cầu đặt lại mật khẩu.');
      
      setSuccessMsg('Liên kết đặt lại mật khẩu đã được gửi đến email của bạn!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ================= 4. XỬ LÝ OAUTH (GOOGLE / GITHUB) =================
  const handleOAuthLogin = (provider: 'google' | 'github') => {
    // Chuyển hướng người dùng đến endpoint OAuth của backend
    // Backend sẽ xử lý xác thực và redirect lại frontend kèm theo token
    window.location.href = `${apiUrl}/api/auth/${provider}`;
  };

  // ================= HÀM CHUYỂN ĐỔI CHẾ ĐỘ =================
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-400 to-fuchsia-300 rounded-2xl mb-4 shadow-lg shadow-purple-200/50">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            {mode === 'login' && 'Welcome to UniPlatform'}
            {mode === 'register' && 'Create an Account'}
            {mode === 'forgot_password' && 'Reset Password'}
          </h1>
          <p className="text-gray-500">
            {mode === 'login' && 'Sign in to access your student collaboration workspace'}
            {mode === 'register' && 'Join our platform to start collaborating'}
            {mode === 'forgot_password' && 'Enter your email to receive a reset link'}
          </p>
        </div>

        {/* Auth Form Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-100/80 overflow-hidden">
          <div className="p-8">
            
            {/* Error & Success Messages */}
            {error && (
              <div className="mb-5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="mb-5 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700">
                {successMsg}
              </div>
            )}

            {/* FORM ĐĂNG NHẬP */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email / Username</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail className="w-5 h-5" /></div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                      placeholder="student@university.edu hoặc username"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Lock className="w-5 h-5" /></div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="w-full pl-11 pr-12 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all"
                      disabled={isLoading}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-purple-400 focus:ring-purple-400/30" />
                    <span className="text-gray-600">Remember me</span>
                  </label>
                  <button type="button" onClick={() => switchMode('forgot_password')} className="text-purple-400 hover:text-purple-500 transition-colors">
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-purple-400 to-fuchsia-300 text-white rounded-xl px-6 py-3 font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50">
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn className="w-5 h-5" /> Sign In</>}
                </button>
              </form>
            )}

            {/* FORM ĐĂNG KÝ */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Họ và Tên</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><User className="w-5 h-5" /></div>
                    <input type="text" value={fullname} onChange={(e) => setFullname(e.target.value)} placeholder="Nguyễn Văn A" className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all" disabled={isLoading} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><User className="w-5 h-5" /></div>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="nguyenvana" className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all" disabled={isLoading} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail className="w-5 h-5" /></div>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@university.edu" className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all" disabled={isLoading} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Lock className="w-5 h-5" /></div>
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" className="w-full pl-11 pr-12 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all" disabled={isLoading} />
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full mt-2 bg-gradient-to-r from-purple-400 to-fuchsia-300 text-white rounded-xl px-6 py-3 font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50">
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Account'}
                </button>
              </form>
            )}

            {/* FORM QUÊN MẬT KHẨU */}
            {mode === 'forgot_password' && (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Registered Email</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail className="w-5 h-5" /></div>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all" disabled={isLoading} />
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-purple-400 to-fuchsia-300 text-white rounded-xl px-6 py-3 font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50">
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Send Reset Link</>}
                </button>
              </form>
            )}
          </div>

          {/* Social Login Options (Chỉ hiện ở mode Login & Register) */}
          {(mode === 'login' || mode === 'register') && (
            <>
              <div className="relative px-8">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
                <div className="relative flex justify-center"><span className="px-4 text-sm text-gray-400 bg-white">or continue with</span></div>
              </div>

              <div className="p-8 pt-6">
                <div className="grid grid-cols-2 gap-3">
                  {/* GOOGLE BUTTON */}
                  <button type="button" onClick={() => handleOAuthLogin('google')} className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="text-sm font-medium text-gray-700">Google</span>
                  </button>

                  {/* GITHUB BUTTON */}
                  <button type="button" onClick={() => handleOAuthLogin('github')} className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all">
                    <Github className="w-5 h-5 text-gray-800" />
                    <span className="text-sm font-medium text-gray-700">GitHub</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Chuyển đổi giữa Login & Register */}
        <div className="text-center mt-6">
          {mode === 'login' ? (
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <button type="button" onClick={() => switchMode('register')} className="text-purple-400 hover:text-purple-500 font-medium transition-colors">
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              <button type="button" onClick={() => switchMode('login')} className="flex items-center justify-center gap-1 mx-auto text-purple-400 hover:text-purple-500 font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Sign in
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}