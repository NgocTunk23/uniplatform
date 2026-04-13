import React, { useState } from 'react';
import {
  User,
  Mail,
  Building2,
  Shield,
  Smartphone,
  Clock,
  Bell,
  Globe,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Camera,
  LogIn,
  LogOut,
  Key,
  Monitor,
  Edit3,
  X,
  Check,
  BookOpen,
} from 'lucide-react';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const recentLogins = [
  { device: 'MacBook Pro (Chrome)',   location: 'Singapore, SG',   time: '2 hours ago', current: true  },
  { device: 'iPhone 15 Pro (Safari)', location: 'Singapore, SG',   time: '1 day ago',   current: false },
  { device: 'Windows PC (Firefox)',   location: 'Johor Bahru, MY', time: '3 days ago',  current: false },
];

const managedDevices = [
  { name: 'MacBook Pro',   type: 'Desktop', lastActive: 'Now',        trusted: true  },
  { name: 'iPhone 15 Pro', type: 'Mobile',  lastActive: '1 day ago',  trusted: true  },
  { name: 'iPad Air',      type: 'Tablet',  lastActive: '1 week ago', trusted: false },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon, children, className = '' }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
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
  // Profile
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState('Jane Smith');
  const [email, setEmail]       = useState('jane.smith@university.edu');
  const [phone, setPhone]       = useState('+65 9123 4567');
  const [org, setOrg]           = useState('School of Computing');
  const [bio, setBio]           = useState('Final-year CS student focused on full-stack development and AI. Team lead for the Software Engineering capstone project.');
  const [avatarUrl]             = useState('https://images.unsplash.com/photo-1770922809545-edc679cdf6d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBzdHVkZW50JTIwcG9ydHJhaXR8ZW58MXx8fHwxNzc1OTQ5ODg2fDA&ixlib=rb-4.1.0&q=80&w=1080');

  // Account / Security
  const [isLoggedIn, setIsLoggedIn]                     = useState(true);
  const [twoFAEnabled, setTwoFAEnabled]                 = useState(true);
  const [showChangePassword, setShowChangePassword]     = useState(false);
  const [currentPassword, setCurrentPassword]           = useState('');
  const [newPassword, setNewPassword]                   = useState('');
  const [confirmPassword, setConfirmPassword]           = useState('');

  // Settings
  const [language, setLanguage]                         = useState('English');
  const [emailNotifications, setEmailNotifications]     = useState(true);
  const [meetingReminders, setMeetingReminders]         = useState(true);
  const [profilePublic, setProfilePublic]               = useState(false);
  const [showDeactivateModal, setShowDeactivateModal]   = useState(false);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 min-h-full">
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
              <div className="relative w-24 h-24 rounded-2xl border-4 border-white shadow-md overflow-hidden bg-purple-200 shrink-0">
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                <button className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-xl">
                  <Camera size={18} className="text-white" />
                </button>
              </div>
              <div className="sm:mb-1">
                <button
                  onClick={() => setEditingProfile(!editingProfile)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 text-purple-600 text-sm font-semibold hover:bg-purple-100 transition-colors"
                >
                  <Edit3 size={14} />
                  Edit Profile
                </button>
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold">
                <BookOpen size={11} />Team Leader
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                <CheckCircle size={11} />Active Account
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                <Building2 size={11} />{org}
              </span>
            </div>
          </div>
        </div>

        {/* ── 2-column grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── 2. Personal Information ───────────────────────────── */}
          <SectionCard title="Personal Information" icon={<User size={15} />} className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Full Name"             value={fullName} onChange={setFullName} placeholder="Jane Smith"            disabled={!editingProfile} />
              <InputField label="Email Address"         value={email}    onChange={setEmail}    type="email" placeholder="jane@university.edu" disabled={!editingProfile} />
              <InputField label="Phone Number"          value={phone}    onChange={setPhone}    placeholder="+65 9123 4567"         disabled={!editingProfile} />
              <InputField label="Organization / Faculty" value={org}    onChange={setOrg}      placeholder="School of Computing"   disabled={!editingProfile} />
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Short Bio</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  disabled={!editingProfile}
                  rows={3}
                  placeholder="Tell your team a bit about yourself…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition-all resize-none disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>
            {editingProfile && (
              <div className="flex items-center gap-3 mt-5 pt-5 border-t border-gray-50">
                <button onClick={() => setEditingProfile(false)} className="px-5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
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
                <button onClick={() => setIsLoggedIn(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
                  <LogIn size={15} />Log In
                </button>
              ) : (
                <button onClick={() => setIsLoggedIn(false)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors">
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
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors mt-1">
                    <Check size={14} />Update Password
                  </button>
                </div>
              )}

              {/* Update Login Email */}
              <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <Mail size={15} className="text-purple-400" />
                  <span className="text-sm font-medium text-gray-700">Update Login Email</span>
                </div>
                <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
              </button>
            </div>
          </SectionCard>

          {/* ── 4. Account Security ───────────────────────────────── */}
          <SectionCard title="Account Security" icon={<Shield size={15} />}>
            <div className="space-y-4">
              {/* Security Status */}
              <div className="p-3.5 rounded-xl bg-green-50 border border-green-100 flex items-center gap-3">
                <CheckCircle size={16} className="text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-700">Account is Secure</p>
                  <p className="text-xs text-green-600 mt-0.5">2FA enabled · No suspicious activity</p>
                </div>
              </div>

              {/* 2FA */}
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <Smartphone size={15} className="text-purple-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Two-Factor Authentication</p>
                    <p className="text-xs text-gray-400 mt-0.5">{twoFAEnabled ? 'Enabled via authenticator app' : 'Not enabled'}</p>
                  </div>
                </div>
                <Toggle enabled={twoFAEnabled} onToggle={() => setTwoFAEnabled(!twoFAEnabled)} />
              </div>

              <div className="h-px bg-gray-100" />

              {/* Managed Devices */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Monitor size={12} />Managed Devices
                </p>
                <div className="space-y-2">
                  {managedDevices.map((device, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${device.trusted ? 'bg-purple-50 text-purple-500' : 'bg-gray-100 text-gray-400'}`}>
                          {device.type === 'Mobile' ? <Smartphone size={13} /> : device.type === 'Tablet' ? <BookOpen size={13} /> : <Monitor size={13} />}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{device.name}</p>
                          <p className="text-[10px] text-gray-400">{device.lastActive}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {device.trusted && <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full">Trusted</span>}
                        <button className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px bg-gray-100" />

              {/* Recent Login History */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock size={12} />Recent Login History
                </p>
                <div className="space-y-2">
                  {recentLogins.map((login, i) => (
                    <div key={i} className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${login.current ? 'bg-green-400' : 'bg-gray-300'}`} />
                        <div>
                          <p className="text-xs font-medium text-gray-700">{login.device}</p>
                          <p className="text-[10px] text-gray-400">{login.location} · {login.time}</p>
                        </div>
                      </div>
                      {login.current && (
                        <span className="text-[10px] text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full shrink-0">Current</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── 5. Account Settings ───────────────────────────────── */}
          <SectionCard title="Account Settings" icon={<Bell size={15} />} className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              {/* Language */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={11} />Language
                </label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition-all"
                >
                  <option>English</option>
                  <option>Bahasa Melayu</option>
                  <option>中文 (Simplified)</option>
                  <option>日本語</option>
                  <option>한국어</option>
                </select>
              </div>

              {/* Profile Privacy */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={11} />Profile Privacy
                </label>
                <select
                  value={profilePublic ? 'public' : 'team'}
                  onChange={e => setProfilePublic(e.target.value === 'public')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent transition-all"
                >
                  <option value="team">Team Members Only</option>
                  <option value="public">Public (University)</option>
                  <option value="private">Private</option>
                </select>
              </div>

              {/* Notifications */}
              <div className="sm:col-span-2 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Bell size={11} />Notifications
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: 'Email Notifications', sub: 'Receive platform updates via email', val: emailNotifications, set: setEmailNotifications },
                    { label: 'Meeting Reminders',   sub: 'Get notified before meetings start',  val: meetingReminders,   set: setMeetingReminders   },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{item.label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{item.sub}</p>
                      </div>
                      <Toggle enabled={item.val} onToggle={() => item.set(!item.val)} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="sm:col-span-2 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={11} />Danger Zone
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowDeactivateModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-600 text-sm font-semibold hover:bg-orange-100 transition-colors"
                  >
                    <AlertTriangle size={14} />Deactivate Account
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors">
                    <X size={14} />Delete Account
                  </button>
                </div>
              </div>
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
              Your account will be temporarily disabled. You can reactivate it at any time by logging back in.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeactivateModal(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => { setIsLoggedIn(false); setShowDeactivateModal(false); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
