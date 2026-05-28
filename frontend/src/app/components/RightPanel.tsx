import React, { useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  FileText,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  Video
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: 'available' | 'busy' | 'tentative' | 'meeting';
  source: 'schedule' | 'meeting';
  meta?: string; // Mình sẽ dùng trường này để chứa tên Workspace (groupName)
}

interface RightPanelProps {
  groupName?: string;
  isCoordinationOpen?: boolean;
  onToggleCoordination?: () => void;
  allEvents?: CalendarEvent[];
}

const statusStyle: Record<string, { badge: string; label: string; dot: string }> = {
  busy: { badge: 'bg-red-50 text-red-600 border-red-100', label: 'Busy', dot: 'bg-red-400' },
  tentative: { badge: 'bg-amber-50 text-amber-600 border-amber-100', label: 'Tentative', dot: 'bg-amber-400' },
  meeting: { badge: 'bg-purple-50 text-purple-600 border-purple-100', label: 'Meeting', dot: 'bg-purple-400' },
};

// Helper formats
const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const formatShortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const formatDuration = (start: Date, end: Date) => {
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`;
};

export function RightPanel({
  groupName = "General",
  isCoordinationOpen = false,
  onToggleCoordination = () => { },
  allEvents = []
}: RightPanelProps) {

  // LỌC SỰ KIỆN TẠI ĐÂY
  const upcomingEvents = useMemo(() => {
    const now = new Date();

    return allEvents
      .filter(event => {
        const eventEnd = event.end instanceof Date ? event.end : new Date(event.end);
        const isFuture = eventEnd > now;

        const isMeeting = event.source === 'meeting';

        // LỌC THEO WORKSPACE:
        const safeMeta = (event.meta || '').toString().trim().toLowerCase();
        const safeGroupName = (groupName || '').toString().trim().toLowerCase();

        const isBelongToCurrentGroup = !safeGroupName || safeGroupName === 'general' || safeMeta === safeGroupName;

        return isFuture && isMeeting && isBelongToCurrentGroup;
      })
      .sort((a, b) => {
        const timeA = a.start instanceof Date ? a.start.getTime() : new Date(a.start).getTime();
        const timeB = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
        return timeA - timeB;
      })
      .slice(0, 5);
  }, [allEvents, groupName]);

  return (
    <div className="flex flex-col h-full bg-white p-6 overflow-y-auto w-full border-l border-gray-100">

      <div className="mb-8 pb-6 border-b border-gray-100">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Current Workspace</h2>
        <p className="text-xl font-bold text-gray-900 truncate">{groupName}</p>

        <button
          onClick={onToggleCoordination}
          className={`w-full mt-4 py-3 border text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 ${isCoordinationOpen ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-purple-200 text-purple-600 hover:bg-purple-50'
            }`}
        >
          <ShieldCheck size={18} />
          {isCoordinationOpen ? 'Back to Group Chat' : 'Open Team Coordination'}
        </button>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle size={16} className="text-purple-400" />
            Upcoming Events
          </h3>
        </div>

        <div className="space-y-3">
          {upcomingEvents.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-gray-50 rounded-2xl">
              <p className="text-xs text-gray-400">No upcoming meetings in this chat</p>
            </div>
          ) : (
            upcomingEvents.map(event => {
              const style = statusStyle[event.status];

              return (
                <div key={event.id} className="p-3 rounded-xl border border-gray-100 hover:border-purple-100 hover:bg-purple-50/20 transition-all group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-bold text-gray-800 leading-tight">{event.title}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                      <span className="flex items-center gap-1"><CalendarIcon size={10} />{formatShortDate(event.start)}</span>
                      <span className="flex items-center gap-1"><Clock size={10} />{formatTime(event.start)} ({formatDuration(event.start, event.end)})</span>
                    </div>

                    <div className="flex items-center justify-end mt-1">
                      <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500 text-white text-[9px] font-bold hover:bg-purple-600 transition-colors">
                        <Video size={10} /> Join
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Latest Minutes Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            Latest Minutes
          </h3>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-purple-200 transition-all cursor-pointer shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500"><FileText size={16} /></div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">Sprint Planning UI</h4>
              <p className="text-[10px] text-gray-400">Today, 09:30 AM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}