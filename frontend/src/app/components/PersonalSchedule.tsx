import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell,
  Globe,
  Check,
  X,
  Edit3,
  Trash2,
  Users,
  CheckCircle,
  Settings,
  Loader2,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';

type AvailStatus = 'available' | 'busy' | 'tentative';
type CalView = 'day' | 'week' | 'month';

interface ScheduleItem {
  id?: string;
  scheduleid: string;
  title: string;
  description?: string;
  starttime: string;
  endtime: string;
  type: AvailStatus;
}

interface Meeting {
  meetingid: string;
  title: string;
  starttime: string;
  endtime: string;
  organizer: string;
  participants: string[];
  status: 'upcoming' | 'ongoing' | 'ended';
  workspace?: { name?: string };
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: AvailStatus | 'meeting';
  source: 'schedule' | 'meeting';
  meta?: string;
}

interface LaidOutEvent {
  event: CalendarEvent;
  lane: number;
  laneCount: number;
}

interface ScheduleForm {
  title: string;
  description: string;
  starttime: string;
  endtime: string;
  type: AvailStatus;
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_HOURS = Array.from({ length: 10 }, (_, i) => i + 8);

const statusStyle: Record<AvailStatus | 'meeting', { bg: string; text: string; dot: string; badge: string; label: string }> = {
  available: { bg: 'bg-green-100/80', text: 'text-green-700', dot: 'bg-green-400', badge: 'bg-green-50 text-green-600 border-green-100', label: 'Available' },
  busy: { bg: 'bg-red-100/70', text: 'text-red-700', dot: 'bg-red-400', badge: 'bg-red-50 text-red-600 border-red-100', label: 'Busy' },
  tentative: { bg: 'bg-amber-100/80', text: 'text-amber-700', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-600 border-amber-100', label: 'Tentative' },
  meeting: { bg: 'bg-purple-100/80', text: 'text-purple-700', dot: 'bg-purple-400', badge: 'bg-purple-50 text-purple-600 border-purple-100', label: 'Meeting' },
};

const emptyForm: ScheduleForm = {
  title: '',
  description: '',
  starttime: '',
  endtime: '',
  type: 'busy',
};

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatHourLabel(hour: number) {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

function parseHour(value: string) {
  const [hour] = value.split(':').map(Number);
  return Number.isFinite(hour) ? hour : null;
}

function formatDuration(start: Date, end: Date) {
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function toLocalInputValue(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function Card({ title, icon, children, action, className = '' }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">{icon}</div>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatusBadge({ status }: { status: AvailStatus | 'meeting' }) {
  const style = statusStyle[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

function getEventsForDay(events: CalendarEvent[], day: Date) {
  return events.filter(event => isSameDay(event.start, day)).sort((a, b) => a.start.getTime() - b.start.getTime());
}

function layoutOverlappingEvents(events: CalendarEvent[]): LaidOutEvent[] {
  const sorted = [...events].sort((a, b) => {
    const startDiff = a.start.getTime() - b.start.getTime();
    return startDiff || a.end.getTime() - b.end.getTime();
  });
  const groups: CalendarEvent[][] = [];
  let activeGroup: CalendarEvent[] = [];
  let activeEnd = 0;

  sorted.forEach(event => {
    const start = event.start.getTime();
    const end = event.end.getTime();
    if (activeGroup.length === 0 || start < activeEnd) {
      activeGroup.push(event);
      activeEnd = Math.max(activeEnd, end);
      return;
    }

    groups.push(activeGroup);
    activeGroup = [event];
    activeEnd = end;
  });

  if (activeGroup.length > 0) groups.push(activeGroup);

  return groups.flatMap(group => {
    const laneEnds: number[] = [];
    const assignments = group.map(event => {
      const start = event.start.getTime();
      let lane = laneEnds.findIndex(end => end <= start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = event.end.getTime();
      return { event, lane, laneCount: 1 };
    });

    const laneCount = Math.max(1, laneEnds.length);
    return assignments.map(item => ({ ...item, laneCount }));
  });
}

function WeekCalendar({ events, selectedDate, hours, onSelectDate, onSelectEvent }: {
  events: CalendarEvent[];
  selectedDate: Date;
  hours: number[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const weekStart = startOfWeek(selectedDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const startHourBoundary = hours[0] ?? 8;
  const gridHeight = hours.length * 48;
  const weekLayouts = days.flatMap((day, dayIndex) =>
    layoutOverlappingEvents(getEventsForDay(events, day)).map(layout => ({ ...layout, dayIndex }))
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] mb-1">
          <div />
          {days.map((date, i) => (
            <button key={date.toISOString()} onClick={() => onSelectDate(date)} className="text-center pb-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{WEEK_DAYS[i]}</p>
              <div className={`mx-auto mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                isSameDay(date, selectedDate) ? 'bg-purple-500 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}>
                {date.getDate()}
              </div>
            </button>
          ))}
        </div>

        <div className="relative">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-[56px_repeat(7,1fr)] h-12 border-t border-gray-50 group">
              <div className="flex items-start justify-end pr-3 pt-0 -mt-2">
                <span className="text-[10px] text-gray-300 font-medium">{formatHourLabel(hour)}</span>
              </div>
              {days.map(day => (
                <button
                  key={day.toISOString()}
                  onClick={() => onSelectDate(day)}
                  className="border-l border-gray-50 group-hover:bg-gray-50/30 transition-colors relative"
                />
              ))}
            </div>
          ))}

          {weekLayouts.map(({ event, dayIndex, lane, laneCount }) => {
            const startHour = event.start.getHours() + event.start.getMinutes() / 60;
            const endHour = event.end.getHours() + event.end.getMinutes() / 60;
            const top = Math.min(Math.max(0, (startHour - startHourBoundary) * 48 + 1), gridHeight - 28);
            const height = Math.max(28, Math.min((endHour - startHour) * 48 - 2, gridHeight - top));
            const style = statusStyle[event.status];

            return (
              <button
                type="button"
                key={`${event.source}-${event.id}`}
                onClick={() => onSelectEvent(event)}
                className={`absolute rounded-lg px-2 py-1 ${style.bg} ${style.text} overflow-hidden shadow-sm text-left hover:brightness-95 transition`}
                style={{
                  left: `calc(56px + ${dayIndex} * ((100% - 56px) / 7) + ${lane} * (((100% - 56px) / 7 - 4px) / ${laneCount}))`,
                  width: `calc((((100% - 56px) / 7 - 4px) / ${laneCount}) - 2px)`,
                  top,
                  height,
                }}
                title={`${event.title} - ${formatTime(event.start)}`}
              >
                <p className="text-[10px] font-semibold truncate">{event.title}</p>
                {height > 42 && <p className="text-[9px] opacity-70 mt-0.5">{formatTime(event.start)}</p>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayCalendar({ events, selectedDate, hours, onSelectEvent }: {
  events: CalendarEvent[];
  selectedDate: Date;
  hours: number[];
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const dayEvents = getEventsForDay(events, selectedDate);
  const dayLayouts = layoutOverlappingEvents(dayEvents);
  const startHourBoundary = hours[0] ?? 8;
  const gridHeight = hours.length * 48;

  return (
    <div className="overflow-y-auto max-h-[560px]">
      <div className="relative" style={{ minHeight: `${gridHeight}px` }}>
        {hours.map(hour => (
          <div key={hour} className="grid grid-cols-[56px_1fr] h-12 border-t border-gray-50">
            <div className="flex items-start pt-0 -mt-2 justify-end pr-3">
              <span className="text-[10px] text-gray-300 font-medium">{formatHourLabel(hour)}</span>
            </div>
            <div className="border-l border-gray-50" />
          </div>
        ))}
        {dayLayouts.map(({ event, lane, laneCount }) => {
          const style = statusStyle[event.status];
          const startHour = event.start.getHours() + event.start.getMinutes() / 60;
          const endHour = event.end.getHours() + event.end.getMinutes() / 60;
          const top = Math.min(Math.max(0, (startHour - startHourBoundary) * 48 + 1), gridHeight - 34);
          const height = Math.max(34, Math.min((endHour - startHour) * 48 - 2, gridHeight - top));

          return (
            <button
              type="button"
              key={`${event.source}-${event.id}`}
              onClick={() => onSelectEvent(event)}
              className={`absolute rounded-xl px-3 py-1.5 ${style.bg} ${style.text} shadow-sm text-left hover:brightness-95 transition`}
              style={{
                left: `calc(60px + ${lane} * ((100% - 60px) / ${laneCount}))`,
                width: `calc(((100% - 60px) / ${laneCount}) - 4px)`,
                top,
                height,
              }}
            >
              <p className="text-xs font-semibold truncate">{event.title}</p>
              <p className="text-[10px] opacity-70">{formatTime(event.start)} - {formatTime(event.end)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthCalendar({ events, selectedDate, onSelectDate }: {
  events: CalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}) {
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
          <div key={day} className="text-center text-[10px] font-semibold text-gray-400 py-1">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dayEvents = getEventsForDay(events, day);
          const isCurrentMonth = day.getMonth() === selectedDate.getMonth();

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={`aspect-square rounded-lg text-xs relative flex flex-col items-center justify-center gap-1 transition-colors ${
                isSameDay(day, selectedDate)
                  ? 'bg-purple-500 text-white font-bold'
                  : isCurrentMonth
                    ? 'hover:bg-gray-50 text-gray-600'
                    : 'text-gray-300'
              }`}
            >
              <span>{day.getDate()}</span>
              {dayEvents.length > 0 && (
                <span className="flex gap-0.5">
                  {dayEvents.slice(0, 3).map(event => (
                    <span key={`${event.source}-${event.id}`} className={`w-1.5 h-1.5 rounded-full ${statusStyle[event.status].dot}`} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PersonalSchedule() {
  const navigate = useNavigate();
  const [calView, setCalView] = useState<CalView>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const [timezone, setTimezone] = useState(() => localStorage.getItem('uniplatform_schedule_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh');
  const [workStart, setWorkStart] = useState(() => localStorage.getItem('uniplatform_schedule_work_start') || '08:00');
  const [workEnd, setWorkEnd] = useState(() => localStorage.getItem('uniplatform_schedule_work_end') || '18:00');

  const token = localStorage.getItem('uniplatform_user_token') || '';
  const initials = (localStorage.getItem('uniplatform_fullname') || 'User')
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [scheduleRes, meetingRes] = await Promise.all([
        fetch(`${apiUrl}/api/schedules`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/meetings`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!scheduleRes.ok) {
        const error = await scheduleRes.json().catch(() => null);
        throw new Error(error?.message || 'Failed to load schedules');
      }

      if (!meetingRes.ok) {
        const error = await meetingRes.json().catch(() => null);
        throw new Error(error?.message || 'Failed to load meetings');
      }

      const scheduleData = await scheduleRes.json();
      const meetingData = await meetingRes.json();
      setSchedules(scheduleData.data || []);
      setMeetings(meetingData || []);
    } catch (error) {
      console.error('Schedule fetch error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const events = useMemo<CalendarEvent[]>(() => {
    const scheduleEvents = schedules.map(item => ({
      id: item.scheduleid || item.id || '',
      title: item.title,
      start: new Date(item.starttime),
      end: new Date(item.endtime),
      status: item.type,
      source: 'schedule' as const,
      meta: item.description,
    }));

    const meetingEvents = meetings.map(meeting => ({
      id: meeting.meetingid,
      title: meeting.title,
      start: new Date(meeting.starttime),
      end: new Date(meeting.endtime),
      status: 'meeting' as const,
      source: 'meeting' as const,
      meta: meeting.workspace?.name,
    }));

    return [...scheduleEvents, ...meetingEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [schedules, meetings]);

  const upcomingMeetings = useMemo(() => {
    const now = new Date();
    return meetings
      .filter(meeting => new Date(meeting.endtime) >= now && meeting.status !== 'ended')
      .sort((a, b) => new Date(a.starttime).getTime() - new Date(b.starttime).getTime())
      .slice(0, 6);
  }, [meetings]);

  const notifications = upcomingMeetings
    .filter(meeting => !dismissedNotifications.has(meeting.meetingid))
    .slice(0, 5);
  const unreadCount = notifications.filter(meeting => !readNotifications.has(meeting.meetingid)).length;
  const selectedSchedule = selectedEvent?.source === 'schedule'
    ? schedules.find(item => (item.scheduleid || item.id) === selectedEvent.id)
    : null;
  const selectedMeeting = selectedEvent?.source === 'meeting'
    ? meetings.find(meeting => meeting.meetingid === selectedEvent.id)
    : null;

  const calendarHours = useMemo(() => {
    const start = parseHour(workStart);
    const end = parseHour(workEnd);
    const baseStart = start === null ? 8 : start;
    const baseEnd = end === null || end <= baseStart ? 18 : end;
    let minHour = baseStart;
    let maxHour = baseEnd;

    const visibleStart = calView === 'week' ? startOfWeek(selectedDate) : new Date(selectedDate);
    visibleStart.setHours(0, 0, 0, 0);
    const visibleEnd = calView === 'week' ? addDays(visibleStart, 7) : addDays(visibleStart, 1);
    const visibleEvents = calView === 'month'
      ? []
      : events.filter(event => event.start < visibleEnd && event.end > visibleStart);

    visibleEvents.forEach(event => {
      minHour = Math.min(minHour, Math.floor(event.start.getHours() + event.start.getMinutes() / 60));
      maxHour = Math.max(maxHour, Math.ceil(event.end.getHours() + event.end.getMinutes() / 60));
    });

    minHour = Math.max(0, minHour);
    maxHour = Math.min(24, Math.max(minHour + 1, maxHour));
    return Array.from({ length: Math.max(1, maxHour - minHour) }, (_, i) => minHour + i);
  }, [workStart, workEnd, calView, selectedDate, events]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const getDefaultForm = (date = selectedDate): ScheduleForm => {
    const [startHour, startMinute] = workStart.split(':').map(Number);
    const start = new Date(date);
    start.setHours(Number.isFinite(startHour) ? startHour : 8, Number.isFinite(startMinute) ? startMinute : 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    return {
      ...emptyForm,
      starttime: toLocalInputValue(start.toISOString()),
      endtime: toLocalInputValue(end.toISOString()),
    };
  };

  const openCreateForm = (date = selectedDate) => {
    setSelectedDate(date);
    setEditingId(null);
    setForm(getDefaultForm(date));
    setShowForm(true);
    setSelectedEvent(null);
  };

  const handleEdit = (item: ScheduleItem) => {
    setEditingId(item.scheduleid || item.id || null);
    setForm({
      title: item.title,
      description: item.description || '',
      starttime: toLocalInputValue(item.starttime),
      endtime: toLocalInputValue(item.endtime),
      type: item.type,
    });
    setShowForm(true);
    setSelectedEvent(null);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.starttime || !form.endtime) {
      toast.error('Please fill in title, start time, and end time');
      return;
    }

    const start = new Date(form.starttime);
    const end = new Date(form.endtime);
    if (end <= start) {
      toast.error('End time must be after start time');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/api/schedules${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          starttime: start.toISOString(),
          endtime: end.toISOString(),
          type: form.type,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const err = Object.assign(new Error(errBody?.message || 'Failed to save schedule'), {
          status: res.status,
          details: errBody?.details,
        });
        throw err;
      }

      const data = await res.json();
      setSchedules(prev => {
        if (editingId) {
          return prev.map(item => (item.scheduleid === editingId || item.id === editingId) ? data.data : item);
        }
        return [...prev, data.data].sort((a, b) => new Date(a.starttime).getTime() - new Date(b.starttime).getTime());
      });
      toast.success(editingId ? 'Schedule updated' : 'Schedule created');
      resetForm();
    } catch (error) {
      console.error('Schedule save error', error);
      const apiErr = error as Error & { status?: number; details?: { conflicts?: Array<{ title: string; starttime: string; endtime: string }> } };
      if (apiErr.status === 409 && apiErr.details?.conflicts?.length) {
        const first = apiErr.details.conflicts[0];
        const startStr = new Date(first.starttime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const endStr = new Date(first.endtime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        toast.error(`Trùng lịch: "${first.title}" (${startStr} – ${endStr})`);
      } else {
        toast.error(apiErr.message || 'Failed to save schedule');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this schedule entry?')) return;

    try {
      const res = await fetch(`${apiUrl}/api/schedules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.message || 'Failed to delete schedule');
      }

      setSchedules(prev => prev.filter(item => item.scheduleid !== id && item.id !== id));
      setSelectedEvent(null);
      toast.success('Schedule deleted');
    } catch (error) {
      console.error('Schedule delete error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete schedule');
    }
  };

  const moveCalendar = (direction: -1 | 1) => {
    if (calView === 'day') setSelectedDate(prev => addDays(prev, direction));
    if (calView === 'week') setSelectedDate(prev => addDays(prev, direction * 7));
    if (calView === 'month') setSelectedDate(prev => addMonths(prev, direction));
  };

  const openMeeting = (meeting: Meeting) => {
    setReadNotifications(prev => new Set(prev).add(meeting.meetingid));
    navigate(meeting.status === 'ended' ? `/meetings/${meeting.meetingid}/review` : `/meetings/${meeting.meetingid}`);
  };

  const savePreferences = () => {
    const start = parseHour(workStart);
    const end = parseHour(workEnd);
    if (start !== null && end !== null && end <= start) {
      toast.error('Working end time must be after start time');
      return;
    }

    localStorage.setItem('uniplatform_schedule_timezone', timezone);
    localStorage.setItem('uniplatform_schedule_work_start', workStart);
    localStorage.setItem('uniplatform_schedule_work_end', workEnd);
    toast.success('Preferences saved');
  };

  const title = calView === 'day'
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    : calView === 'week'
      ? `${formatShortDate(startOfWeek(selectedDate))} - ${formatShortDate(addDays(startOfWeek(selectedDate), 6))}, ${selectedDate.getFullYear()}`
      : selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/40 min-h-full">
      <div className="max-w-6xl mx-auto px-6 py-8 pb-20 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Personal Schedule</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage your availability and upcoming meetings</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setReadNotifications(new Set(notifications.map(item => item.meetingid)))}
                className="p-1 rounded-lg hover:bg-white transition-colors"
                title="Mark meeting notifications as read"
              >
                <Bell size={18} className="text-gray-400" />
              </button>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-bold text-xs border-2 border-white shadow-sm">{initials}</div>
            <button
              onClick={() => openCreateForm()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors shadow-sm"
            >
              <Plus size={14} />
              Add Availability
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {(['available', 'busy', 'tentative'] as AvailStatus[]).map(status => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm ${statusStyle[status].dot}`} />
              <span className="text-xs text-gray-500 capitalize font-medium">{status}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${statusStyle.meeting.dot}`} />
            <span className="text-xs text-gray-500 font-medium">Meeting</span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-6">
            <Card
              title="Calendar Overview"
              icon={<Calendar size={14} />}
              action={
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                  {(['day', 'week', 'month'] as CalView[]).map(view => (
                    <button
                      key={view}
                      onClick={() => setCalView(view)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                        calView === view ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {view}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => moveCalendar(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronLeft size={15} /></button>
                <span className="text-sm font-semibold text-gray-700">{title}</span>
                <button onClick={() => moveCalendar(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronRight size={15} /></button>
              </div>

              {loading ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                  <Loader2 size={24} className="animate-spin mb-3" />
                  <p className="text-sm">Loading schedule...</p>
                </div>
              ) : (
                <>
                  {calView === 'week' && (
                    <WeekCalendar
                      events={events}
                      selectedDate={selectedDate}
                      hours={calendarHours}
                      onSelectDate={setSelectedDate}
                      onSelectEvent={setSelectedEvent}
                    />
                  )}
                  {calView === 'month' && (
                    <MonthCalendar
                      events={events}
                      selectedDate={selectedDate}
                      onSelectDate={(date) => {
                        setSelectedDate(date);
                        setCalView('day');
                      }}
                    />
                  )}
                  {calView === 'day' && (
                    <DayCalendar
                      events={events}
                      selectedDate={selectedDate}
                      hours={calendarHours}
                      onSelectEvent={setSelectedEvent}
                    />
                  )}
                </>
              )}
            </Card>

            <Card
              title="Availability Management"
              icon={<Clock size={14} />}
              action={
                <button
                  onClick={() => openCreateForm()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 text-xs font-semibold hover:bg-purple-100 transition-colors"
                >
                  <Plus size={12} />
                  Add Slot
                </button>
              }
            >
              {showForm && (
                <div className="mb-4 p-4 rounded-xl bg-purple-50/60 border border-purple-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">{editingId ? 'Edit Schedule' : 'New Time Slot'}</p>
                    <button onClick={resetForm} className="p-1 rounded-lg text-purple-300 hover:text-purple-600 hover:bg-white"><X size={14} /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">Title</label>
                      <input
                        value={form.title}
                        onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g. Deep work"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">Status</label>
                      <select
                        value={form.type}
                        onChange={e => setForm(prev => ({ ...prev, type: e.target.value as AvailStatus }))}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                      >
                        <option value="available">Available</option>
                        <option value="busy">Busy</option>
                        <option value="tentative">Tentative</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">Start</label>
                      <input
                        type="datetime-local"
                        value={form.starttime}
                        onChange={e => setForm(prev => ({ ...prev, starttime: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">End</label>
                      <input
                        type="datetime-local"
                        value={form.endtime}
                        onChange={e => setForm(prev => ({ ...prev, endtime: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">Description</label>
                      <textarea
                        value={form.description}
                        onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        placeholder="Optional notes"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSubmit}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-500 text-white text-xs font-semibold hover:bg-purple-600 transition-colors disabled:opacity-60"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      {editingId ? 'Save Changes' : 'Save Slot'}
                    </button>
                    <button onClick={resetForm} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {schedules.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No personal availability entries yet</div>
                ) : (
                  schedules.map(slot => {
                    const id = slot.scheduleid || slot.id || '';
                    const start = new Date(slot.starttime);
                    const end = new Date(slot.endtime);
                    return (
                      <div key={id} className={`flex items-center gap-3 p-3 rounded-xl border ${statusStyle[slot.type].badge} group hover:shadow-sm transition-all`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusStyle[slot.type].dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{slot.title}</p>
                          <p className="text-[10px] text-gray-400">
                            {formatShortDate(start)} - {formatTime(start)} to {formatTime(end)} - {formatDuration(start, end)}
                          </p>
                        </div>
                        <StatusBadge status={slot.type} />
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(slot)} className="p-1 rounded-lg hover:bg-white transition-colors text-gray-400 hover:text-purple-500"><Edit3 size={12} /></button>
                          <button onClick={() => handleDelete(id)} className="p-1 rounded-lg hover:bg-white transition-colors text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            <Card title="Upcoming Meetings" icon={<CheckCircle size={14} />}>
              <div className="space-y-3">
                {upcomingMeetings.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No upcoming meetings</p>
                ) : (
                  upcomingMeetings.map(meeting => {
                    const start = new Date(meeting.starttime);
                    const end = new Date(meeting.endtime);
                    return (
                      <div key={meeting.meetingid} className="p-3 rounded-xl border border-gray-100 hover:border-purple-100 hover:bg-purple-50/20 transition-all">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-xs font-semibold text-gray-800 leading-snug">{meeting.title}</p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-purple-50 text-purple-600">{meeting.status}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-400">
                          <span className="flex items-center gap-1"><Calendar size={9} />{formatShortDate(start)}</span>
                          <span className="flex items-center gap-1"><Clock size={9} />{formatTime(start)} - {formatDuration(start, end)}</span>
                          <span className="flex items-center gap-1"><Users size={9} />{meeting.participants.length}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 text-[9px] font-semibold truncate">{meeting.workspace?.name || meeting.organizer}</span>
                          <button
                            onClick={() => openMeeting(meeting)}
                            className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600 text-[10px] font-semibold hover:bg-purple-100 transition-colors"
                          >
                            {meeting.status === 'ended' ? 'Review' : 'Join'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <Card
              title={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
              icon={<Bell size={14} />}
              action={
                <button onClick={() => setReadNotifications(new Set(notifications.map(item => item.meetingid)))} className="text-[10px] text-purple-500 font-semibold hover:text-purple-700">
                  Mark all read
                </button>
              }
            >
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No meeting notifications</p>
                ) : (
                  notifications.map(meeting => {
                    const unread = !readNotifications.has(meeting.meetingid);
                    const start = new Date(meeting.starttime);
                    return (
                      <div key={meeting.meetingid} className={`flex gap-3 p-3 rounded-xl border transition-all ${unread ? 'border-purple-100 bg-purple-50/30' : 'border-gray-50 bg-white'}`}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-purple-50 text-purple-500"><Video size={11} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-bold text-gray-700">{meeting.organizer}</span>
                            <span className="text-[9px] text-purple-500 font-semibold bg-purple-50 px-1.5 py-0.5 rounded-full">{meeting.workspace?.name || 'Meeting'}</span>
                            {unread && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 ml-auto" />}
                          </div>
                          <p className="text-[10px] text-gray-500 leading-relaxed">{meeting.title} at {formatTime(start)} on {formatShortDate(start)}</p>
                          <button
                            onClick={() => openMeeting(meeting)}
                            className="mt-1 text-[10px] text-purple-500 font-semibold hover:text-purple-700"
                          >
                            Open meeting
                          </button>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {unread && <button onClick={() => setReadNotifications(prev => new Set(prev).add(meeting.meetingid))} className="p-1 rounded-lg hover:bg-white text-gray-300 hover:text-green-400 transition-colors"><Check size={10} /></button>}
                          <button onClick={() => setDismissedNotifications(prev => new Set(prev).add(meeting.meetingid))} className="p-1 rounded-lg hover:bg-white text-gray-200 hover:text-red-400 transition-colors"><X size={10} /></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <Card title="Preferences" icon={<Settings size={14} />}>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1.5"><Globe size={10} />Timezone</label>
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    <option>Asia/Ho_Chi_Minh</option>
                    <option>Asia/Singapore</option>
                    <option>America/New_York</option>
                    <option>Europe/London</option>
                    <option>Asia/Tokyo</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1.5"><Clock size={10} />Working Hours</label>
                  <div className="flex items-center gap-2">
                    <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300" />
                    <span className="text-xs text-gray-300">to</span>
                    <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300" />
                  </div>
                </div>

                <button onClick={savePreferences} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-500 text-white text-xs font-semibold hover:bg-purple-600 transition-colors">
                  <Check size={12} />
                  Save Preferences
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 max-w-sm w-full"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{selectedEvent.title}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {formatShortDate(selectedEvent.start)} · {formatTime(selectedEvent.start)} - {formatTime(selectedEvent.end)}
                </p>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <StatusBadge status={selectedEvent.status} />
              {selectedEvent.meta && (
                <p className="text-sm text-gray-500 leading-relaxed">{selectedEvent.meta}</p>
              )}
              {selectedMeeting && (
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Organizer: <span className="font-semibold text-gray-700">{selectedMeeting.organizer}</span></p>
                  <p>Participants: <span className="font-semibold text-gray-700">{selectedMeeting.participants.length}</span></p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {selectedSchedule && (
                <>
                  <button
                    onClick={() => handleEdit(selectedSchedule)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
                  >
                    <Edit3 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(selectedSchedule.scheduleid || selectedSchedule.id || '')}
                    className="px-4 py-2.5 rounded-lg bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              {selectedMeeting && (
                <button
                  onClick={() => openMeeting(selectedMeeting)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
                >
                  <Video size={14} />
                  {selectedMeeting.status === 'ended' ? 'Review Meeting' : 'Join Meeting'}
                </button>
              )}
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
