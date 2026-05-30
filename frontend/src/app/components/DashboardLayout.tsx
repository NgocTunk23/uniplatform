import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, X } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { ChatInterface } from './ChatInterface';
import { RightPanel } from './RightPanel';
import { TeamCoordination } from './TeamCoordination';

const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5001';

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [groupView, setGroupView] = useState<'chat' | 'coordination'>('chat');

  // A meeting sub-route (e.g. /meetings/:id/review) is rendered via <Outlet/>.
  // Don't let a selected workspace mask it, otherwise navigating from the
  // workspace right panel (Latest Minutes) would silently keep the chat view.
  const isMeetingSubRoute = /^\/meetings\/.+/.test(location.pathname);

  const [meetings, setMeetings] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('uniplatform_user_token') || '';

    const fetchJson = async (path: string) => {
      const res = await fetch(`${apiUrl}${path}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Request failed: ${path}`);
      return res.json();
    };

    Promise.all([fetchJson('/api/meetings'), fetchJson('/api/workspaces')])
      .then(([meetingsData, workspacesData]) => {
        setMeetings(Array.isArray(meetingsData) ? meetingsData : (meetingsData.data || []));
        setWorkspaces(Array.isArray(workspacesData) ? workspacesData : (workspacesData.data || []));
      })
      .catch(err => console.error('Fetch dashboard data error:', err));
  }, []);

  const activeWorkspace = useMemo(() => (
    workspaces.find(workspace => (workspace.workspaceid || workspace.id || workspace._id) === activeGroup)
  ), [workspaces, activeGroup]);

  const allEvents = useMemo(() => {
    return meetings.map(meeting => ({
      id: meeting.meetingid,
      title: meeting.title,
      start: new Date(meeting.starttime),
      end: new Date(meeting.endtime),
      status: 'meeting' as const,
      source: 'meeting' as const,
      meta: meeting.workspaceid || meeting.workspace?.id || meeting.workspace?.name || '',
      meetingMinute: meeting.meetingMinute,
    }));
  }, [meetings]);

  return (
    <div className="flex min-h-screen w-full bg-white text-gray-900 font-sans">
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
          fixed md:relative md:flex z-10 w-72 h-full max-h-screen top-0 bottom-0 left-0 flex-col bg-white border-r border-gray-100 overflow-y-auto transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="md:hidden h-[73px] flex-shrink-0" />
        <Sidebar
          onCloseMobile={() => setMobileMenuOpen(false)}
          activeGroup={activeGroup}
          onSelectGroup={(group) => {
            if (group) {
              navigate('/chat');
            }
            setActiveGroup(group);
            setGroupView('chat'); // Reset màn hình về chat mỗi khi đổi nhóm
          }}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-hidden mt-[73px] md:mt-0 relative">
        {activeGroup && !isMeetingSubRoute ? (
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
                groupName={activeWorkspace?.name || activeGroup}
                workspaceId={activeGroup}
                allEvents={allEvents}
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
