import React, { Dispatch, SetStateAction } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { 
  // MessageSquare, 
  Calendar, 
  FolderOpen, 
  Bot,
  Hash,
  Settings,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';


interface SidebarProps {
  onCloseMobile?: () => void;
  activeGroup: string | null;
  onSelectGroup: Dispatch<SetStateAction<string | null>>;
}
const navItems = [
  // { icon: MessageSquare, label: 'Chat',              path: '/chat' },
  { icon: CalendarDays,  label: 'My Schedule',       path: '/schedule' },
  { icon: Calendar,      label: 'Meetings',          path: '/meetings' },
  
  // { icon: ShieldCheck,   label: 'Team Coordination', path: '/team-schedule' },
  { icon: FolderOpen,    label: 'Drive Files',       path: '/files' },
  { icon: Bot,           label: 'AI Assistant',      path: '/ai-assistant' },
];

const chatGroups = [
  { name: 'Software Eng Project', unread: 3 },
  { name: 'Marketing Team', unread: 0 },
  { name: 'Design Capstone', unread: 1 },
];

// 2. Cập nhật lại phần khai báo component Sidebar để sử dụng interface vừa tạo
export function Sidebar({ onCloseMobile, activeGroup, onSelectGroup }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavClick = (path: string) => {
    onSelectGroup(null);
    navigate(path);
    onCloseMobile?.();
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto w-full">
      {/* Brand area (hidden on mobile, visible on desktop) */}
      <div className="hidden md:flex h-[73px] items-center px-6 shrink-0 border-b border-gray-50/0">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-400 flex items-center justify-center text-white font-bold text-xs">U</div>
          UniPlatform
        </h1>
      </div>

      <div className="flex-1 px-4 py-4 space-y-8">
        {/* Main Navigation */}
        <nav className="space-y-1">
          {navItems.map((item, i) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={i}
                onClick={() => handleNavClick(item.path)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-purple-50 text-purple-600' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                <item.icon 
                  size={18} 
                  className={isActive ? 'text-purple-500' : 'text-gray-400'} 
                />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Groups */}
        <div>
          <h2 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Work Groups
          </h2>
          <div className="space-y-1">
            {chatGroups.map((group, i) => {
              const isGroupActive = activeGroup === group.name; // Kiểm tra xem group này có đang được chọn không
              
              return (
                <button
                  key={i}
                  // THÊM SỰ KIỆN CLICK Ở ĐÂY:
                  onClick={() => {
                    onSelectGroup(group.name); // Báo cho Dashboard biết group nào đang được chọn
                    onCloseMobile?.();
                  }}
                  // Cập nhật class để có màu nền khi được active
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl group transition-colors ${
                    isGroupActive ? 'bg-purple-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden text-sm">
                    <Hash 
                      size={16} 
                      className={`shrink-0 ${isGroupActive ? 'text-purple-500' : 'text-gray-300 group-hover:text-gray-400'}`} 
                    />
                    <span className={`truncate font-medium ${isGroupActive ? 'text-purple-700' : 'text-gray-700 group-hover:text-gray-900'}`}>
                      {group.name}
                    </span>
                  </div>
                  {group.unread > 0 && (
                    <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0">
                      {group.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* User profile / Settings */}
      <div className="p-4 mt-auto border-t border-gray-50">
        <button
          onClick={() => handleNavClick('/profile')}
          className={`flex items-center gap-3 w-full p-2 rounded-xl transition-colors ${
            location.pathname.startsWith('/profile') ? 'bg-purple-50' : 'hover:bg-gray-50'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-purple-200 border-2 border-white shadow-sm flex items-center justify-center text-purple-700 font-semibold text-xs shrink-0">
            JS
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Jane Smith</p>
            <p className="text-xs text-gray-500 truncate">Computer Science</p>
          </div>
          <Settings size={16} className="text-gray-400 shrink-0" />
        </button>
      </div>
    </div>
  );
}