import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, X } from 'lucide-react';
import { Outlet } from 'react-router';
import { ChatInterface } from './ChatInterface';
import { RightPanel } from './RightPanel';
import { TeamCoordination } from './TeamCoordination';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [groupView, setGroupView] = useState<'chat' | 'coordination'>('chat');

  // 1. Thêm state để lưu danh sách meetings
  const [meetings, setMeetings] = useState<any[]>([]);

  // 2. Gọi API để lấy danh sách meeting khi layout được load
  useEffect(() => {
    const token = localStorage.getItem('uniplatform_user_token') || '';
    fetch(`${apiUrl}/api/meetings`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setMeetings(Array.isArray(data) ? data : (data.data || []));
      })
      .catch(err => console.error('Fetch meetings error:', err));
  }, []);

  // 3. Biến đổi dữ liệu meetings thành format CalendarEvent mà RightPanel cần
  const allEvents = useMemo(() => {
    return meetings.map(meeting => ({
      id: meeting.meetingid,
      title: meeting.title,
      start: new Date(meeting.starttime), // Parse thành Object Date
      end: new Date(meeting.endtime),     // Parse thành Object Date
      status: 'meeting',
      source: 'meeting',
      // Lưu ý: activeGroup thường lưu ID của workspace. 
      // Ta lưu thẳng ID vào meta để RightPanel dễ dàng filter.
      meta: meeting.workspaceid || meeting.workspace?.id || meeting.workspace?.name || '',
    }));
  }, [meetings]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-gray-900 font-sans">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-100 bg-white absolute top-0 w-full z-20">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">UniPlatform</h1>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 -mr-2 text-gray-600 hover:bg-gray-50 rounded-lg"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Main Sidebar */}
      <div
        className={`
          fixed md:relative md:flex z-10 w-72 h-full flex-col bg-white border-r border-gray-100 transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="md:hidden h-[73px] flex-shrink-0" />
        <Sidebar
          onCloseMobile={() => setMobileMenuOpen(false)}
          activeGroup={activeGroup}
          onSelectGroup={(group) => {
            setActiveGroup(group);
            setGroupView('chat'); // Reset màn hình về chat mỗi khi đổi nhóm
          }}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:flex-row h-full overflow-hidden mt-[73px] md:mt-0 relative">
        {activeGroup ? (
          <div className="flex flex-1 w-full h-full">

            {/* Cột giữa hiển thị dựa theo state groupView */}
            <div className="flex-1 min-w-0 h-full relative flex flex-col bg-white">
              {groupView === 'chat' ? (
                <ChatInterface
                  workspaceId={activeGroup}
                  onDeleteSuccess={() => setActiveGroup(null)}
                />
              ) : (
                <TeamCoordination workspaceId={activeGroup} />
              )}
            </div>

            {/* Cột RightPanel bên phải */}
            <div className="hidden lg:block w-80 shrink-0 h-full border-l border-gray-100">
              <RightPanel
                groupName={activeGroup} // Cập nhật tên prop cho khớp với RightPanel
                allEvents={allEvents}   // Truyền danh sách sự kiện đã tính toán vào
                isCoordinationOpen={groupView === 'coordination'}
                onToggleCoordination={() => setGroupView(prev => prev === 'chat' ? 'coordination' : 'chat')}
              />
            </div>

          </div>
        ) : (
          <Outlet />
        )}
      </div>

      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-gray-900/20 z-0 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}