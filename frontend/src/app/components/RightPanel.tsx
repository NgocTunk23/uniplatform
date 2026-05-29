import React, { useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar as CalendarIcon,
  Clock,
  FileText,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  Video
} from 'lucide-react';
import { canJoinMeeting, JOIN_WINDOW_MINUTES } from '../utils/meeting';

interface MeetingMinute {
  summary?: string | null;
  content?: string | null;
  summary_draft?: string | null;
  createdat?: string | Date | null;
  updatedat?: string | Date | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: 'busy' | 'tentative' | 'meeting';
  source: 'schedule' | 'meeting';
  meta?: string;
  meetingMinute?: MeetingMinute | null;
}

interface RightPanelProps {
  groupName?: string;
  workspaceId?: string | null;
  isCoordinationOpen?: boolean;
  onToggleCoordination?: () => void;
  allEvents?: CalendarEvent[];
}

const statusStyle: Record<string, { badge: string; label: string; dot: string }> = {
  busy: { badge: 'bg-red-50 text-red-600 border-red-100', label: 'Busy', dot: 'bg-red-400' },
  tentative: { badge: 'bg-amber-50 text-amber-600 border-amber-100', label: 'Tentative', dot: 'bg-amber-400' },
  meeting: { badge: 'bg-purple-50 text-purple-600 border-purple-100', label: 'Meeting', dot: 'bg-purple-400' },
};

const getStatusStyle = (status: string) => statusStyle[status] || statusStyle.tentative;

// Helper formats
const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const formatShortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const formatDuration = (start: Date, end: Date) => {
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}`;
};
const toDate = (value?: string | Date | null) => value ? new Date(value) : null;
const formatMinuteDate = (value: Date) => value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function RightPanel({
  groupName = "General",
  workspaceId,
  isCoordinationOpen = false,
  onToggleCoordination = () => { },
  allEvents = []
}: RightPanelProps) {
  const navigate = useNavigate();
  const workspaceKey = (workspaceId || groupName || '').toString().trim().toLowerCase();

  const belongsToCurrentWorkspace = (event: CalendarEvent) => {
    const safeMeta = (event.meta || '').toString().trim().toLowerCase();
    return !workspaceKey || workspaceKey === 'general' || safeMeta === workspaceKey;
  };

  const upcomingEvents = useMemo(() => {
    const now = new Date();

    return allEvents
      .filter(event => {
        const eventEnd = event.end instanceof Date ? event.end : new Date(event.end);
        const isFuture = eventEnd > now;
        const isMeeting = event.source === 'meeting';
        return isFuture && isMeeting && belongsToCurrentWorkspace(event);
      })
      .sort((a, b) => {
        const timeA = a.start instanceof Date ? a.start.getTime() : new Date(a.start).getTime();
        const timeB = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
        return timeA - timeB;
      })
      .slice(0, 5);
  }, [allEvents, workspaceKey]);

  const latestMinutes = useMemo(() => {
    return allEvents
      .filter(event => (
        event.source === 'meeting' &&
        belongsToCurrentWorkspace(event) &&
        event.meetingMinute &&
        (event.meetingMinute.summary || event.meetingMinute.content || event.meetingMinute.summary_draft)
      ))
      .sort((a, b) => {
        const aDate = toDate(a.meetingMinute?.updatedat) || toDate(a.meetingMinute?.createdat) || a.end;
        const bDate = toDate(b.meetingMinute?.updatedat) || toDate(b.meetingMinute?.createdat) || b.end;
        return bDate.getTime() - aDate.getTime();
      })
      .slice(0, 3);
  }, [allEvents, workspaceKey]);

  const openMeeting = (event: CalendarEvent) => {
    navigate(`/meetings/${event.id}`);
  };

  const openMinutes = (event: CalendarEvent) => {
    navigate(`/meetings/${event.id}/review`);
  };

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
              const style = getStatusStyle(event.status);
              const joinable = canJoinMeeting({ starttime: event.start, endtime: event.end });

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => joinable && openMeeting(event)}
                  disabled={!joinable}
                  title={joinable ? undefined : `Join opens ${JOIN_WINDOW_MINUTES} minutes before the meeting starts`}
                  className={`w-full text-left p-3 rounded-xl border border-gray-100 transition-all group focus:outline-none focus:ring-2 focus:ring-purple-200 ${joinable ? 'hover:border-purple-100 hover:bg-purple-50/20 cursor-pointer' : 'cursor-not-allowed'}`}
                >
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
                      {joinable ? (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500 text-white text-[9px] font-bold group-hover:bg-purple-600 transition-colors">
                          <Video size={10} /> Join
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-400 text-[9px] font-bold">
                          <Video size={10} /> Join
                        </span>
                      )}
                    </div>
                  </div>
                </button>
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
        {latestMinutes.length === 0 ? (
          <div className="py-8 text-center border-2 border-dashed border-gray-50 rounded-2xl">
            <p className="text-xs text-gray-400">No meeting minutes yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {latestMinutes.map(event => {
              const minuteDate = toDate(event.meetingMinute?.updatedat) || toDate(event.meetingMinute?.createdat) || event.end;
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => openMinutes(event)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 hover:border-purple-200 hover:bg-purple-50/20 transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500"><FileText size={16} /></div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-gray-900 truncate">{event.title}</h4>
                      <p className="text-[10px] text-gray-400">{formatMinuteDate(minuteDate)}, {formatTime(minuteDate)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
