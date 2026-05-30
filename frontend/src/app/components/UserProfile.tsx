import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router'; // Thêm useNavigate để chuyển hướng nếu lỗi token
import {
  User, Mail, Building2, Shield, Smartphone, Clock, Bell, Globe,
  AlertTriangle, CheckCircle, ChevronRight, Camera, LogIn, LogOut, Key,
  Monitor, Edit3, X, Check, BookOpen, Loader2
} from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';
import { AvatarWithFallback } from './AvatarWithFallback';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon, children, className = '' }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-100/80 overflow-hidden ${className}`}>
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
        <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">
          {icon}
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function InputField({
  label, value, onChange, type = 'text', placeholder, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition-all disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  );
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
        enabled ? 'bg-purple-400' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
          enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function UserProfile() {
  const navigate = useNavigate();

  // Trạng thái load dữ liệu
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile data từ API
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [address, setAddress]   = useState('');
  const [dob, setDob]           = useState(''); // Format: YYYY-MM-DD
  const [role, setRole]         = useState('');
  const [status, setStatus]     = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  // Account / Security
  const [isLoggedIn, setIsLoggedIn]                     = useState(true);
  const [twoFAEnabled, setTwoFAEnabled]                 = useState(true);
  const [showChangePassword, setShowChangePassword]     = useState(false);
  const [showDeactivateModal, setShowDeactivateModal]   = useState(false);
  const [currentPassword, setCurrentPassword]           = useState('');
  const [newPassword, setNewPassword]                   = useState('');
  const [confirmPassword, setConfirmPassword]           = useState('');

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 1. Fetch User Data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('uniplatform_user_token'); 
        
        if (!token) {
          navigate('/login');
          return;
        }

        // CHÚ Ý: Đã đổi thành port 5001 hoặc dùng biến môi trường
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        
        const response = await fetch(`${apiUrl}/api/users/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          localStorage.clear();
          navigate('/login');
          return;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to load profile: ${response.status}`);
        }

        const result = await response.json();
        const userData = result.data || result; // Phòng hờ cấu trúc backend trả về

        // Ánh xạ dữ liệu từ API vào State
        setUserId(userData._id || '');
        setFullName(userData.fullname || '');
        setEmail(userData.email || '');
        setPhone(userData.phone || '');
        setAddress(userData.address || '');



        const finalAvatarUrl = getAvatarUrl(userData.imageggid);

        console.log("LINK ẢNH ĐÃ ĐƯỢC LỌC LẠI:", finalAvatarUrl); 
        setAvatarUrl(finalAvatarUrl);

        
        setUsername(userData.username || '');
        setRole(userData.role || 'user');
        setStatus(userData.status || 'active');
        setCreatedAt(userData.createdAt || '');

        if (userData.dateofbirth) {
          setDob(userData.dateofbirth.split('T')[0]);
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  // 2. Cập nhật Profile
  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('uniplatform_user_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

      const response = await fetch(`${apiUrl}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullname: fullName,
          email: email,
          phone: phone,
          address: address,
          dateofbirth: dob
        })
      });

      if (!response.ok) throw new Error('Failed to update profile');
      
      setSuccessMsg('Profile updated successfully');
      setEditingProfile(false);
      setTimeout(() => setSuccessMsg(''), 3000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Đổi mật khẩu
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    try {
      const token = localStorage.getItem('uniplatform_user_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

      const response = await fetch(`${apiUrl}/api/users/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (!response.ok) throw new Error('Failed to change password. Please check your current password.');
      
      setSuccessMsg('Password changed successfully. You will be signed out to log in again.');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      localStorage.clear();
      localStorage.setItem('uniplatform_logout', Date.now().toString());
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 4. Đăng xuất
  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    navigate('/login');
  };

  // 5. Upload avatar (save base64 directly to MongoDB)
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
      setError('Image file size must not exceed 5MB');
      return;
    }

    try {
      setUploadingAvatar(true);
      const token = localStorage.getItem('uniplatform_user_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64String = e.target?.result as string;

          // Update user profile with base64 avatar directly
          const updateResponse = await fetch(`${apiUrl}/api/users/profile`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              imageggid: base64String
            })
          });

          if (!updateResponse.ok) throw new Error('Failed to update avatar');


          const updateResult = await updateResponse.json();
          let newAvatarId = updateResult.data?.imageggid;

          if (newAvatarId && !newAvatarId.startsWith('http') && !newAvatarId.startsWith('data:')) {
            const newLink = `https://lh3.googleusercontent.com/d/${newAvatarId}`;
            
            // IN RA ĐỂ KIỂM TRA
            console.log("LINK ẢNH SAU KHI UPLOAD:", newLink);
            
            setAvatarUrl(newLink);
          } else {
            setAvatarUrl(newAvatarId || base64String);
          }

          // Reload page để workspace cập nhật avatar mới
          setTimeout(() => window.location.reload(), 1000);


          setSuccessMsg('Avatar updated successfully');
          setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setUploadingAvatar(false);
        }
      };
      reader.readAsDataURL(file);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message);
      setUploadingAvatar(false);
    }
  };

  // 6. Trigger file input
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (loading && !userId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50 min-h-screen">
        <Loader2 className="animate-spin text-purple-500 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 min-h-full relative">
      
      {/* Thông báo (Success/Error Toast) */}
      {(successMsg || error) && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${successMsg ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
           {successMsg ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
           <span className="text-sm font-medium">{successMsg || error}</span>
           <button onClick={() => { setSuccessMsg(''); setError(''); }} className="ml-4 opacity-70 hover:opacity-100">
             <X size={16} />
           </button>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 pb-20">

        {/* ── 1. Profile Header ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-100/80 overflow-hidden">
          <div className="h-28 bg-gradient-to-br from-purple-100 via-fuchsia-50 to-violet-100 relative">
            <div
              className="absolute inset-0 opacity-30"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #c084fc 0%, transparent 50%), radial-gradient(circle at 80% 20%, #f0abfc 0%, transparent 40%)' }}
            />
          </div>

          <div className="px-8 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 mb-4">
              <div className="relative w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-purple-200 shrink-0">
                <AvatarWithFallback 
                  url={avatarUrl} 
                  name={fullName} 
                  size="w-full h-full"
                  textSize="text-2xl"
                />
                <button 
                  onClick={triggerFileInput}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-xl disabled:opacity-50"
                >
                  {uploadingAvatar ? (
                    <Loader2 size={18} className="text-white animate-spin" />
                  ) : (
                    <Camera size={18} className="text-white" />
                  )}
                </button>
              </div>
              <div className="sm:mb-1">
                <button
                  onClick={() => setEditingProfile(!editingProfile)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 text-purple-600 text-sm font-semibold hover:bg-purple-100 transition-colors"
                >
                  <Edit3 size={14} />
                  {editingProfile ? 'Editing...' : 'Edit Profile'}
                </button>
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
            <p className="text-sm text-gray-500 mt-0.5">@{username} • {email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold capitalize">
                <User size={11} />{role}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold capitalize ${status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <CheckCircle size={11} />{status}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                <Building2 size={11} />{address || 'No address added'}
              </span>
            </div>
          </div>
        </div>

        {/* ── 2-column grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── 2. Personal Information ───────────────────────────── */}
          <SectionCard title="Personal Information" icon={<User size={15} />} className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Full Name"             value={fullName} onChange={setFullName} placeholder="Alex Nguyen"            disabled={!editingProfile} />
              {/* <InputField label="Email Address"         value={email}    onChange={setEmail}    type="email" placeholder="email@example.com" disabled={!editingProfile} /> */}
              <InputField label="Phone Number"          value={phone}    onChange={setPhone}    placeholder="0912345678"         disabled={!editingProfile} />
              <InputField label="Date of Birth"         value={dob}      onChange={setDob}      type="date"                      disabled={!editingProfile} />
              <InputField label="Address"            value={address}  onChange={setAddress}  placeholder="Ho Chi Minh City"    disabled={!editingProfile} />
              <InputField label="Account Created"    value={createdAt} onChange={() => {}}   disabled={true} />
            </div>
            
            {editingProfile && (
              <div className="flex items-center gap-3 mt-5 pt-5 border-t border-gray-50">
                <button 
                  onClick={handleSaveProfile} 
                  disabled={loading}
                  className="flex items-center justify-center px-5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors disabled:opacity-70"
                >
                  {loading && <Loader2 size={14} className="animate-spin mr-2" />}
                  Save Changes
                </button>
                <button onClick={() => setEditingProfile(false)} className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </SectionCard>

          {/* ── 3. Account Management ─────────────────────────────── */}
          <SectionCard title="Account Management" icon={<LogIn size={15} />}>
            <div className="space-y-4">
              {/* Login Status */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${isLoggedIn ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium text-gray-700">
                    {isLoggedIn ? 'Currently Logged In' : 'Logged Out'}
                  </span>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isLoggedIn ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  {isLoggedIn ? 'Active' : 'Inactive'}
                </span>
              </div>

              {!isLoggedIn ? (
                <button onClick={() => navigate('/login')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
                  <LogIn size={15} />Log In
                </button>
              ) : (
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors">
                  <LogOut size={15} />Secure Log Out
                </button>
              )}

              <div className="h-px bg-gray-100" />

              {/* Change Password */}
              <button
                onClick={() => setShowChangePassword(!showChangePassword)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Key size={15} className="text-purple-400" />
                  <span className="text-sm font-medium text-gray-700">Change Password</span>
                </div>
                <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
              </button>

              {showChangePassword && (
                <div className="space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <InputField label="Current Password"     value={currentPassword} onChange={setCurrentPassword} type="password" placeholder="••••••••" />
                  <InputField label="New Password"         value={newPassword}     onChange={setNewPassword}     type="password" placeholder="••••••••" />
                  <InputField label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="••••••••" />
                  <button 
                    onClick={handleChangePassword}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors mt-1"
                  >
                    <Check size={14} />Update Password
                  </button>
                </div>
              )}
            </div>
          </SectionCard>

          
          
        </div>
      </div>

      {/* ── Deactivate Confirm Modal ──────────────────────────── */}
      {showDeactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8 max-w-sm w-full">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 mb-4">
              <AlertTriangle size={22} />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Deactivate Account?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Your account will be deactivated. You can reactivate it anytime by logging in again.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeactivateModal(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => { 
                  // Logic gọi API deactivate account ở đây (nếu có)
                  setIsLoggedIn(false); 
                  setShowDeactivateModal(false); 
                  handleLogout();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
      />
    </div>
  );
}
