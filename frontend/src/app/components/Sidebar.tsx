import React, { useState, useEffect, Dispatch, SetStateAction } from 'react'; // Thêm useState, useEffect
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
  Plus,
  PlusCircle,
  Loader2
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';


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

export function Sidebar({ onCloseMobile, activeGroup, onSelectGroup }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [chatGroups, setChatGroups] = useState<{ id: string; name: string; unread: number }[]>([]);
  const [userInfo, setUserInfo] = useState({
    fullname: 'Loading...',
    username: '',
    initials: 'U'
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchWorkspaces = async () => {
    const token = localStorage.getItem('uniplatform_user_token');
    if (!token) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/workspaces`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const formattedGroups = data.map((ws: any) => ({
          id: ws.workspaceid || ws.id || ws._id,
          name: ws.name,
          unread: 0 
        }));
        setChatGroups(formattedGroups);
      }
    } catch (error) {
      console.error("Failed to fetch workspaces error:", error);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    setIsCreating(true);
    try {
      const token = localStorage.getItem('uniplatform_user_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      
      const response = await fetch(`${apiUrl}/api/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: newWorkspaceName.trim(),
          admin: userInfo.username
        })
      });

      if (response.ok) {
        toast.success('Workspace created successfully!');
        setNewWorkspaceName('');
        setIsCreateModalOpen(false);
        fetchWorkspaces(); // Refresh list
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create workspace');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    // Lấy dữ liệu từ localStorage
    const storedName = localStorage.getItem('uniplatform_fullname') || 'User';
    const storedUsername = localStorage.getItem('uniplatform_username') || '';
    
    // Tạo initials (chữ cái đầu) từ tên
    const initials = storedName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    setUserInfo({
      fullname: storedName,
      username: storedUsername,
      initials: initials
    });
  }, []);

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
          <div className="flex items-center justify-between px-3 mb-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Work Groups
            </h2>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="p-1 hover:bg-purple-50 rounded-lg text-gray-400 hover:text-purple-500 transition-colors"
              title="Create Workspace"
            >
              <PlusCircle size={16} />
            </button>
          </div>
          <div className="space-y-1">
            {chatGroups.length === 0 ? (
               <div className="px-3 py-2 text-sm text-gray-400 italic">No workspaces found</div>
            ) : chatGroups.map((group, i) => {
              const isGroupActive = activeGroup === group.id; // Thay bằng id thay vì name để chắc chắn unique
              
              return (
                <button
                  key={i}
                  onClick={() => {
                    onSelectGroup(group.id); // Trả về ID thay vì name
                    onCloseMobile?.();
                  }}
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
          {/* Hiển thị initials thay cho "JS" */}
          <div className="w-8 h-8 rounded-full bg-purple-200 border-2 border-white shadow-sm flex items-center justify-center text-purple-700 font-semibold text-xs shrink-0">
            {userInfo.initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            {/* Hiển thị fullname thực tế */}
            <p className="text-sm font-semibold text-gray-900 truncate">
              {userInfo.fullname}
            </p>
            {/* Hiển thị username hoặc email phía dưới */}
            <p className="text-xs text-gray-500 truncate">
              @{userInfo.username}
            </p>
          </div>
          <Settings size={16} className="text-gray-400 shrink-0" />
        </button>
      </div>
      {/* Create Workspace Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl border-none shadow-2xl shadow-purple-500/10 bg-white/98 backdrop-blur-xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-2xl font-bold tracking-tight">Create Workspace</DialogTitle>
              <DialogDescription className="text-purple-100/80 mt-1.5 text-sm leading-relaxed">
                Build a new collaborative space for your team's projects and communications.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleCreateWorkspace} className="p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-gray-700 ml-1">Workspace Name</Label>
              <Input
                id="name"
                placeholder="e.g. AI Innovation Hub"
                className="h-12 px-4 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                disabled={isCreating}
                required
                autoFocus
              />
            </div>

            <DialogFooter className="flex flex-row gap-3 pt-2">
              <Button 
                type="button" 
                variant="ghost" 
                className="flex-1 h-12 rounded-2xl font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-[1.5] h-12 rounded-2xl font-semibold bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50"
                disabled={isCreating || !newWorkspaceName.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Workspace'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}