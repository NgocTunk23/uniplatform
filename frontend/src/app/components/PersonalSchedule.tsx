import React, { useState } from 'react';
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
  AlertCircle,
  Info,
  Settings,
  Zap,
  ToggleLeft,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type AvailStatus = 'available' | 'busy' | 'tentative';
type CalView = 'day' | 'week' | 'month';

interface TimeSlot {
  id: string;
  label: string;
  day: string;
  start: string;
  end: string;
  status: AvailStatus;
  recurring: boolean;
}

interface ConfirmedMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  organizer: string;
  status: 'confirmed' | 'pending' | 'declined';
  group: string;
}

interface Notification {
  id: string;
  from: string;
  role: string;
  message: string;
  time: string;
  type: 'new' | 'update' | 'cancel';
  read: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DATES = [13, 14, 15, 16, 17, 18, 19];
const HOURS = ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];

// [day index (0=Mon), start hour slot (0=8AM), span hours]
const weekEvents: { day: number; start: number; span: number; label: string; status: AvailStatus }[] = [
  { day: 0, start: 0, span: 2, label: 'Available', status: 'available' },
  { day: 0, start: 4, span: 1, label: 'Team Lunch', status: 'busy' },
  { day: 1, start: 2, span: 3, label: 'Deep Work', status: 'busy' },
  { day: 2, start: 0, span: 4, label: 'Available', status: 'available' },
  { day: 2, start: 6, span: 2, label: 'Sprint Review', status: 'busy' },
  { day: 3, start: 1, span: 2, label: 'Available', status: 'available' },
  { day: 3, start: 4, span: 1, label: 'Maybe free', status: 'tentative' },
  { day: 4, start: 0, span: 2, label: 'Morning Standup', status: 'busy' },
  { day: 4, start: 3, span: 3, label: 'Available', status: 'available' },
  { day: 5, start: 1, span: 2, label: 'Available', status: 'available' },
];

const mockSlots: TimeSlot[] = [
  { id: '1', label: 'Morning Block', day: 'Monday', start: '08:00', end: '10:00', status: 'available', recurring: true },
  { id: '2', label: 'Deep Work', day: 'Tuesday', start: '10:00', end: '13:00', status: 'busy', recurring: false },
  { id: '3', label: 'Open Hours', day: 'Wednesday', start: '08:00', end: '12:00', status: 'available', recurring: true },
  { id: '4', label: 'Flex Time', day: 'Thursday', start: '14:00', end: '15:00', status: 'tentative', recurring: false },
  { id: '5', label: 'Sprint Review', day: 'Wednesday', start: '14:00', end: '16:00', status: 'busy', recurring: false },
];

const mockMeetings: ConfirmedMeeting[] = [
  { id: '1', title: 'Software Engineering Sprint Planning', date: 'Apr 13, Mon', time: '2:00 PM', duration: '60 min', organizer: 'Alex Chen', status: 'confirmed', group: 'Software Eng' },
  { id: '2', title: 'Design Review – Mobile App', date: 'Apr 14, Tue', time: '4:30 PM', duration: '45 min', organizer: 'Jane Smith', status: 'confirmed', group: 'Design Capstone' },
  { id: '3', title: 'Marketing Campaign Brainstorm', date: 'Apr 16, Thu', time: '10:00 AM', duration: '90 min', organizer: 'Alex Chen', status: 'pending', group: 'Marketing' },
  { id: '4', title: 'Client Presentation Prep', date: 'Apr 18, Sat', time: '1:00 PM', duration: '60 min', organizer: 'Sarah Lee', status: 'declined', group: 'Design Capstone' },
];

const mockNotifications: Notification[] = [
  { id: '1', from: 'Alex Chen', role: 'Team Leader', message: 'New meeting scheduled: Sprint Planning on Apr 13 at 2 PM. Please confirm attendance.', time: '2 hours ago', type: 'new', read: false },
  { id: '2', from: 'Alex Chen', role: 'Team Leader', message: 'Reminder: Design Review tomorrow at 4:30 PM. Agenda has been updated.', time: '5 hours ago', type: 'update', read: false },
  { id: '3', from: 'Sarah Lee', role: 'Team Leader', message: 'Client Presentation Prep on Apr 18 has been rescheduled. Check your calendar.', time: '1 day ago', type: 'update', read: true },
  { id: '4', from: 'Alex Chen', role: 'Team Leader', message: 'Weekly sync on Apr 10 has been cancelled. Sorry for the late notice.', time: '2 days ago', type: 'cancel', read: true },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const statusStyle: Record<AvailStatus, { bg: string; text: string; dot: string; badge: string; badgeText: string }> = {
  available: { bg: 'bg-green-100/80', text: 'text-green-700', dot: 'bg-green-400', badge: 'bg-green-50 text-green-600 border-green-100', badgeText: 'Available' },
  busy:      { bg: 'bg-red-100/70',   text: 'text-red-700',   dot: 'bg-red-400',   badge: 'bg-red-50 text-red-600 border-red-100',     badgeText: 'Busy' },
  tentative: { bg: 'bg-amber-100/80', text: 'text-amber-700', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-600 border-amber-100', badgeText: 'Tentative' },
};

const notifStyle: Record<Notification['type'], { icon: React.ReactNode; color: string }> = {
  new:    { icon: <Plus size={11} />,        color: 'bg-purple-50 text-purple-500' },
  update: { icon: <Info size={11} />,        color: 'bg-blue-50 text-blue-500' },
  cancel: { icon: <X size={11} />,           color: 'bg-red-50 text-red-500' },
};

const meetingStatusStyle: Record<ConfirmedMeeting['status'], { label: string; cls: string }> = {
  confirmed: { label: 'Confirmed', cls: 'bg-green-50 text-green-600' },
  pending:   { label: 'Pending',   cls: 'bg-amber-50 text-amber-600' },
  declined:  { label: 'Declined',  cls: 'bg-red-50 text-red-500' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function Card({ title, icon, children, className = '', action }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; className?: string; action?: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">{icon}</div>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: AvailStatus }) {
  const s = statusStyle[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.badgeText}
    </span>
  );
}

// ─── Week Calendar ────────────────────────────────────────────────────────────
function WeekCalendar() {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[580px]">
        {/* Day headers */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] mb-1">
          <div />
          {DAYS.map((d, i) => (
            <div key={d} className="text-center pb-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{d}</p>
              <div className={`mx-auto mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                DATES[i] === 13 ? 'bg-purple-500 text-white' : 'text-gray-600'
              }`}>{DATES[i]}</div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="relative">
          {HOURS.map((h, hi) => (
            <div key={h} className="grid grid-cols-[56px_repeat(7,1fr)] h-10 border-t border-gray-50 group">
              <div className="flex items-start justify-end pr-3 pt-0 -mt-2">
                <span className="text-[10px] text-gray-300 font-medium">{h}</span>
              </div>
              {DAYS.map((_, di) => (
                <div key={di} className="border-l border-gray-50 group-hover:bg-gray-50/30 transition-colors relative" />
              ))}
            </div>
          ))}

          {/* Events overlay */}
          {weekEvents.map((ev, i) => {
            const s = statusStyle[ev.status];
            const left = `calc(56px + ${ev.day} * ((100% - 56px) / 7))`;
            const width = `calc((100% - 56px) / 7 - 2px)`;
            const top = `${ev.start * 40 + 1}px`;
            const height = `${ev.span * 40 - 2}px`;
            return (
              <div
                key={i}
                className={`absolute rounded-lg px-2 py-1 ${s.bg} ${s.text} cursor-pointer hover:brightness-95 transition-all overflow-hidden`}
                style={{ left, width, top, height }}
              >
                <p className="text-[10px] font-semibold truncate">{ev.label}</p>
                {ev.span >= 2 && <p className="text-[9px] opacity-60 mt-0.5">{HOURS[ev.start]}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Month Mini Grid ──────────────────────────────────────────────────────────
function MonthCalendar() {
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const today = 13;
  const busyDays = new Set([13, 14, 16, 17, 21, 22, 24]);
  const availDays = new Set([13, 15, 18, 20, 23, 25]);
  const cells = [...Array(5)].fill(null), offset = 2; // April 2026 starts on Wed
  const dates = Array.from({ length: 30 }, (_, i) => i + 1);
  const paddedDates = [...Array(offset).fill(null), ...dates];

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {days.map(d => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {paddedDates.slice(0, 35).map((d, i) => (
          <div key={i} className={`aspect-square flex items-center justify-center rounded-lg text-xs relative ${
            d === today ? 'bg-purple-500 text-white font-bold' :
            d ? 'hover:bg-gray-50 cursor-pointer text-gray-600' : ''
          }`}>
            {d}
            {d && busyDays.has(d) && d !== today && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-300" />
            )}
            {d && availDays.has(d) && !busyDays.has(d) && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-300" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────
function DayCalendar() {
  const dayEvents = weekEvents.filter(e => e.day === 0);
  return (
    <div className="overflow-y-auto max-h-64">
      <div className="relative">
        {HOURS.map((h, hi) => (
          <div key={h} className="grid grid-cols-[56px_1fr] h-12 border-t border-gray-50">
            <div className="flex items-start pt-0 -mt-2 justify-end pr-3">
              <span className="text-[10px] text-gray-300 font-medium">{h}</span>
            </div>
            <div className="border-l border-gray-50" />
          </div>
        ))}
        {dayEvents.map((ev, i) => {
          const s = statusStyle[ev.status];
          return (
            <div
              key={i}
              className={`absolute rounded-xl px-3 py-1.5 ${s.bg} ${s.text} cursor-pointer`}
              style={{ left: '60px', right: '0', top: `${ev.start * 48 + 1}px`, height: `${ev.span * 48 - 2}px` }}
            >
              <p className="text-xs font-semibold">{ev.label}</p>
              <p className="text-[10px] opacity-60">{HOURS[ev.start]} – {HOURS[Math.min(ev.start + ev.span, HOURS.length - 1)]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function PersonalSchedule() {
  const [calView, setCalView] = useState<CalView>('week');
  const [slots, setSlots] = useState<TimeSlot[]>(mockSlots);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlot, setNewSlot] = useState<Partial<TimeSlot>>({ status: 'available', recurring: false });
  const [timezone, setTimezone] = useState('Asia/Singapore (GMT+8)');
  const [workStart, setWorkStart] = useState('08:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const handleDismiss = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  const handleDeleteSlot = (id: string) => setSlots(prev => prev.filter(s => s.id !== id));

  const handleAddSlot = () => {
    if (!newSlot.day || !newSlot.start || !newSlot.end) return;
    setSlots(prev => [...prev, {
      id: Date.now().toString(),
      label: newSlot.label || `${newSlot.day} block`,
      day: newSlot.day!,
      start: newSlot.start!,
      end: newSlot.end!,
      status: newSlot.status as AvailStatus,
      recurring: newSlot.recurring || false,
    }]);
    setShowAddSlot(false);
    setNewSlot({ status: 'available', recurring: false });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/40 min-h-full">
      <div className="max-w-6xl mx-auto px-6 py-8 pb-20 space-y-6">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Personal Schedule</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage your availability and upcoming meetings</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell size={18} className="text-gray-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-bold text-xs border-2 border-white shadow-sm">JS</div>
            <button
              onClick={() => setShowAddSlot(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors shadow-sm"
            >
              <Zap size={14} />
              Update Availability
            </button>
          </div>
        </div>

        {/* ── Legend ───────────────────────────────────────────── */}
        <div className="flex items-center gap-4 flex-wrap">
          {(['available', 'busy', 'tentative'] as AvailStatus[]).map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm ${statusStyle[s].bg} border ${statusStyle[s].badge.split(' ')[2] || ''}`} />
              <span className="text-xs text-gray-500 capitalize font-medium">{s}</span>
            </div>
          ))}
        </div>

        {/* ── Two-column grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

          {/* LEFT COLUMN */}
          <div className="space-y-6">

            {/* Calendar Overview */}
            <Card
              title="Calendar Overview"
              icon={<Calendar size={14} />}
              action={
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                  {(['day', 'week', 'month'] as CalView[]).map(v => (
                    <button
                      key={v}
                      onClick={() => setCalView(v)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                        calView === v ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >{v}</button>
                  ))}
                </div>
              }
            >
              {/* Week nav */}
              {calView === 'week' && (
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronLeft size={15} /></button>
                  <span className="text-sm font-semibold text-gray-700">Apr 13 – Apr 19, 2026</span>
                  <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronRight size={15} /></button>
                </div>
              )}
              {calView === 'month' && (
                <div className="flex items-center justify-between mb-4">
                  <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronLeft size={15} /></button>
                  <span className="text-sm font-semibold text-gray-700">April 2026</span>
                  <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronRight size={15} /></button>
                </div>
              )}
              {calView === 'day' && (
                <div className="flex items-center justify-between mb-4">
                  <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronLeft size={15} /></button>
                  <span className="text-sm font-semibold text-gray-700">Monday, Apr 13, 2026</span>
                  <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronRight size={15} /></button>
                </div>
              )}

              {calView === 'week' && <WeekCalendar />}
              {calView === 'month' && <MonthCalendar />}
              {calView === 'day' && <DayCalendar />}
            </Card>

            {/* Availability Management */}
            <Card
              title="Availability Management"
              icon={<Clock size={14} />}
              action={
                <button
                  onClick={() => setShowAddSlot(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-600 text-xs font-semibold hover:bg-purple-100 transition-colors"
                >
                  <Plus size={12} />
                  Add Slot
                </button>
              }
            >
              {/* Add Slot Form */}
              {showAddSlot && (
                <div className="mb-4 p-4 rounded-xl bg-purple-50/60 border border-purple-100 space-y-3">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">New Time Slot</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">Label</label>
                      <input
                        value={newSlot.label || ''}
                        onChange={e => setNewSlot(p => ({ ...p, label: e.target.value }))}
                        placeholder="e.g. Morning Block"
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">Day</label>
                      <select
                        value={newSlot.day || ''}
                        onChange={e => setNewSlot(p => ({ ...p, day: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                      >
                        <option value="">Select day</option>
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">Start</label>
                      <input type="time" value={newSlot.start || ''} onChange={e => setNewSlot(p => ({ ...p, start: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">End</label>
                      <input type="time" value={newSlot.end || ''} onChange={e => setNewSlot(p => ({ ...p, end: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase">Status</label>
                      <select
                        value={newSlot.status}
                        onChange={e => setNewSlot(p => ({ ...p, status: e.target.value as AvailStatus }))}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                      >
                        <option value="available">Available</option>
                        <option value="busy">Busy</option>
                        <option value="tentative">Tentative</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 self-end pb-1">
                      <input type="checkbox" id="recurring" checked={newSlot.recurring} onChange={e => setNewSlot(p => ({ ...p, recurring: e.target.checked }))} className="accent-purple-500" />
                      <label htmlFor="recurring" className="text-xs text-gray-600">Recurring weekly</label>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleAddSlot} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500 text-white text-xs font-semibold hover:bg-purple-600 transition-colors">
                      <Check size={12} /> Save Slot
                    </button>
                    <button onClick={() => setShowAddSlot(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {slots.map(slot => (
                  <div key={slot.id} className={`flex items-center gap-3 p-3 rounded-xl border ${statusStyle[slot.status].badge} group hover:shadow-sm transition-all`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusStyle[slot.status].dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{slot.label}</p>
                      <p className="text-[10px] text-gray-400">{slot.day} · {slot.start} – {slot.end}{slot.recurring ? ' · Recurring' : ''}</p>
                    </div>
                    <StatusBadge status={slot.status} />
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 rounded-lg hover:bg-white transition-colors text-gray-400 hover:text-purple-500"><Edit3 size={11} /></button>
                      <button onClick={() => handleDeleteSlot(slot.id)} className="p-1 rounded-lg hover:bg-white transition-colors text-gray-300 hover:text-red-400"><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">

            {/* Confirmed Meetings */}
            <Card title="Confirmed Meetings" icon={<CheckCircle size={14} />}>
              <div className="space-y-3">
                {mockMeetings.map(m => {
                  const ms = meetingStatusStyle[m.status];
                  return (
                    <div key={m.id} className="p-3 rounded-xl border border-gray-100 hover:border-purple-100 hover:bg-purple-50/20 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-xs font-semibold text-gray-800 leading-snug">{m.title}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${ms.cls}`}>{ms.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-400">
                        <span className="flex items-center gap-1"><Calendar size={9} />{m.date}</span>
                        <span className="flex items-center gap-1"><Clock size={9} />{m.time} · {m.duration}</span>
                        <span className="flex items-center gap-1"><Users size={9} />{m.organizer}</span>
                      </div>
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[9px] font-semibold">{m.group}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Notifications */}
            <Card
              title={`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
              icon={<Bell size={14} />}
              action={
                <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} className="text-[10px] text-purple-500 font-semibold hover:text-purple-700">
                  Mark all read
                </button>
              }
            >
              <div className="space-y-3">
                {notifications.map(n => {
                  const ns = notifStyle[n.type];
                  return (
                    <div key={n.id} className={`flex gap-3 p-3 rounded-xl border transition-all ${n.read ? 'border-gray-50 bg-white' : 'border-purple-100 bg-purple-50/30'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${ns.color}`}>{ns.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-gray-700">{n.from}</span>
                          <span className="text-[9px] text-purple-500 font-semibold bg-purple-50 px-1.5 py-0.5 rounded-full">{n.role}</span>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 ml-auto" />}
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed">{n.message}</p>
                        <p className="text-[9px] text-gray-300 mt-1">{n.time}</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {!n.read && <button onClick={() => handleMarkRead(n.id)} className="p-1 rounded-lg hover:bg-white text-gray-300 hover:text-green-400 transition-colors"><Check size={10} /></button>}
                        <button onClick={() => handleDismiss(n.id)} className="p-1 rounded-lg hover:bg-white text-gray-200 hover:text-red-400 transition-colors"><X size={10} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Preferences */}
            <Card title="Preferences" icon={<Settings size={14} />}>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1.5"><Globe size={10} />Timezone</label>
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    <option>Asia/Singapore (GMT+8)</option>
                    <option>Asia/Kuala_Lumpur (GMT+8)</option>
                    <option>America/New_York (GMT-4)</option>
                    <option>Europe/London (GMT+1)</option>
                    <option>Asia/Tokyo (GMT+9)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 mb-1.5"><Clock size={10} />Working Hours</label>
                  <div className="flex items-center gap-2">
                    <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300" />
                    <span className="text-xs text-gray-300">to</span>
                    <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300" />
                  </div>
                </div>

                <div className="h-px bg-gray-50" />

                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Bell size={10} />Notifications</p>
                  {[
                    { label: 'Email notifications', val: notifEmail, set: setNotifEmail },
                    { label: 'Push notifications', val: notifPush, set: setNotifPush },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50">
                      <span className="text-xs text-gray-600">{item.label}</span>
                      <button
                        onClick={() => item.set(!item.val)}
                        className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors ${item.val ? 'bg-purple-400' : 'bg-gray-200'}`}
                        style={{ height: '18px', width: '32px' }}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${item.val ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>

                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-500 text-white text-xs font-semibold hover:bg-purple-600 transition-colors">
                  <Check size={12} />
                  Save Preferences
                </button>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
