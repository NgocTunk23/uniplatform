import React, { useState } from 'react';
import {
  Users,
  Calendar,
  Clock,
  Zap,
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Plus,
  Send,
  Star,
  Sparkles,
  Check,
  X,
  RefreshCw,
  BarChart2,
  UserCheck,
  Info,
  Shield,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type ResponseStatus = 'accepted' | 'pending' | 'declined';

interface Member {
  id: string;
  name: string;
  initials: string;
  role: string;
  color: string;
  // [day 0-4, hour slot 0-9] => 'free' | 'busy' | 'tentative'
  schedule: Record<string, 'free' | 'busy' | 'tentative'>;
}

interface SuggestedSlot {
  id: string;
  date: string;
  day: string;
  time: string;
  duration: string;
  score: number;
  quality: 'best' | 'good' | 'low';
  freeCount: number;
  conflicts: string[];
  label: string;
}

interface ParticipantResponse {
  memberId: string;
  name: string;
  initials: string;
  color: string;
  status: ResponseStatus;
  responseTime?: string;
  note?: string;
}

interface NotifHistory {
  id: string;
  title: string;
  sentAt: string;
  recipients: number;
  type: 'meeting_invite' | 'reminder' | 'update' | 'cancel';
  deliveredPct: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const TEAM_DAYS = ['Mon 13', 'Tue 14', 'Wed 15', 'Thu 16', 'Fri 17'];
const TEAM_HOURS = ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM'];

const makeSchedule = (pattern: (string)[]) => {
  const s: Record<string, 'free' | 'busy' | 'tentative'> = {};
  TEAM_DAYS.forEach((_, d) => {
    TEAM_HOURS.forEach((_, h) => {
      s[`${d}-${h}`] = (pattern[d * TEAM_HOURS.length + h] as any) || 'free';
    });
  });
  return s;
};

const b = 'busy', f = 'free', t = 'tentative';
const mockMembers: Member[] = [
  { id: '1', name: 'Alex Chen',   initials: 'AC', role: 'Team Leader',    color: 'bg-purple-200 text-purple-700',
    schedule: makeSchedule([f,f,b,b,f,b,b,f,f,f, f,b,b,f,f,b,f,f,f,f, f,f,f,f,b,f,f,b,b,f, b,b,f,f,f,f,f,b,f,f, f,f,f,b,b,f,f,f,f,f]) },
  { id: '2', name: 'Jane Smith',  initials: 'JS', role: 'Developer',      color: 'bg-fuchsia-200 text-fuchsia-700',
    schedule: makeSchedule([f,f,f,b,b,f,f,b,f,f, b,b,f,f,f,f,t,t,f,f, f,f,b,b,f,f,f,f,b,b, f,f,f,b,f,b,b,f,f,f, f,b,b,f,f,f,f,t,t,f]) },
  { id: '3', name: 'Marcus Lee',  initials: 'ML', role: 'Designer',       color: 'bg-violet-200 text-violet-700',
    schedule: makeSchedule([b,b,f,f,f,f,b,b,f,f, f,f,b,b,b,f,f,f,b,f, f,b,b,f,f,b,b,f,f,f, f,f,b,b,f,f,f,b,b,f, b,f,f,f,t,t,f,f,f,b]) },
  { id: '4', name: 'Sarah Lim',   initials: 'SL', role: 'PM',             color: 'bg-indigo-200 text-indigo-700',
    schedule: makeSchedule([f,b,b,f,f,f,f,b,b,f, f,f,f,b,b,b,f,f,f,f, b,b,f,f,f,f,b,b,f,f, f,f,f,f,b,b,f,f,t,t, f,f,b,b,f,f,f,f,b,f]) },
  { id: '5', name: 'Ryan Park',   initials: 'RP', role: 'QA Engineer',    color: 'bg-sky-200 text-sky-700',
    schedule: makeSchedule([f,f,b,b,b,f,f,f,b,f, f,b,b,f,f,f,b,b,f,f, f,f,f,b,b,f,f,f,f,b, b,f,f,f,f,b,b,f,f,f, f,b,b,b,f,f,f,b,f,f]) },
  { id: '6', name: 'Priya Nair',  initials: 'PN', role: 'Data Analyst',   color: 'bg-rose-200 text-rose-700',
    schedule: makeSchedule([f,f,f,f,b,b,f,f,f,t, b,b,f,f,f,b,b,f,f,f, f,f,b,b,b,f,f,b,b,f, f,f,f,b,b,f,f,f,b,b, f,f,f,f,b,b,b,f,f,f]) },
  { id: '7', name: 'Tom Wu',      initials: 'TW', role: 'Backend Dev',    color: 'bg-teal-200 text-teal-700',
    schedule: makeSchedule([b,b,f,f,f,b,b,b,f,f, f,f,f,b,b,f,f,f,b,b, f,b,b,f,f,f,b,b,f,f, f,f,b,b,f,f,f,f,b,b, b,b,f,f,f,f,t,t,f,f]) },
];

const suggestedSlots: SuggestedSlot[] = [
  { id: '1', date: 'Apr 14', day: 'Tuesday', time: '9:00 – 10:00 AM', duration: '60 min', score: 97, quality: 'best',
    freeCount: 7, conflicts: [], label: 'Best Match' },
  { id: '2', date: 'Apr 13', day: 'Monday',  time: '3:00 – 4:00 PM',  duration: '60 min', score: 84, quality: 'good',
    freeCount: 6, conflicts: ['Ryan Park'], label: 'Good Alternative' },
  { id: '3', date: 'Apr 15', day: 'Wednesday', time: '11:00 AM – 12:00 PM', duration: '60 min', score: 71, quality: 'low',
    freeCount: 5, conflicts: ['Ryan Park', 'Tom Wu'], label: 'Low Conflict Slot' },
];

const participantResponses: ParticipantResponse[] = [
  { memberId: '1', name: 'Alex Chen',  initials: 'AC', color: 'bg-purple-200 text-purple-700',  status: 'accepted',  responseTime: '2 min ago',  note: 'See you all there!' },
  { memberId: '2', name: 'Jane Smith', initials: 'JS', color: 'bg-fuchsia-200 text-fuchsia-700', status: 'accepted',  responseTime: '5 min ago' },
  { memberId: '3', name: 'Marcus Lee', initials: 'ML', color: 'bg-violet-200 text-violet-700',   status: 'pending',   responseTime: undefined },
  { memberId: '4', name: 'Sarah Lim',  initials: 'SL', color: 'bg-indigo-200 text-indigo-700',   status: 'accepted',  responseTime: '12 min ago' },
  { memberId: '5', name: 'Ryan Park',  initials: 'RP', color: 'bg-sky-200 text-sky-700',         status: 'declined',  responseTime: '1 hr ago',   note: 'Conflict with uni class' },
  { memberId: '6', name: 'Priya Nair', initials: 'PN', color: 'bg-rose-200 text-rose-700',       status: 'pending',   responseTime: undefined },
  { memberId: '7', name: 'Tom Wu',     initials: 'TW', color: 'bg-teal-200 text-teal-700',       status: 'accepted',  responseTime: '30 min ago' },
];

const notifHistory: NotifHistory[] = [
  { id: '1', title: 'Sprint Planning – Apr 14 9 AM',   sentAt: '2 hours ago',  recipients: 7, type: 'meeting_invite', deliveredPct: 100 },
  { id: '2', title: 'Design Review reminder',          sentAt: '5 hours ago',  recipients: 5, type: 'reminder',       deliveredPct: 100 },
  { id: '3', title: 'Marketing Brainstorm rescheduled',sentAt: '1 day ago',    recipients: 6, type: 'update',         deliveredPct: 83 },
  { id: '4', title: 'Weekly sync cancelled',           sentAt: '3 days ago',   recipients: 8, type: 'cancel',         deliveredPct: 100 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const slotQualityStyle: Record<SuggestedSlot['quality'], { badge: string; bg: string; border: string; ring: string }> = {
  best: { badge: 'bg-green-50 text-green-700',   bg: 'bg-green-50/30',   border: 'border-green-200',  ring: 'ring-green-100' },
  good: { badge: 'bg-purple-50 text-purple-700', bg: 'bg-purple-50/20',  border: 'border-purple-200', ring: 'ring-purple-100' },
  low:  { badge: 'bg-amber-50 text-amber-700',   bg: 'bg-amber-50/20',   border: 'border-amber-200',  ring: 'ring-amber-100' },
};

const responseStyle: Record<ResponseStatus, { icon: React.ReactNode; cls: string; label: string }> = {
  accepted: { icon: <CheckCircle size={13} />, cls: 'text-green-500 bg-green-50',  label: 'Accepted' },
  pending:  { icon: <Clock size={13} />,       cls: 'text-amber-500 bg-amber-50',  label: 'Pending' },
  declined: { icon: <XCircle size={13} />,     cls: 'text-red-500 bg-red-50',      label: 'Declined' },
};

const notifTypeStyle: Record<NotifHistory['type'], { label: string; cls: string }> = {
  meeting_invite: { label: 'Invite',    cls: 'bg-purple-50 text-purple-600' },
  reminder:       { label: 'Reminder',  cls: 'bg-blue-50 text-blue-600' },
  update:         { label: 'Update',    cls: 'bg-amber-50 text-amber-600' },
  cancel:         { label: 'Cancelled', cls: 'bg-red-50 text-red-500' },
};

// Cell coloring for team grid
function getCellClass(val: 'free' | 'busy' | 'tentative') {
  if (val === 'free') return 'bg-green-100/70';
  if (val === 'busy') return 'bg-red-100/60';
  return 'bg-amber-100/70';
}

// Compute per-column (day+hour) free ratio across all members
function getColumnFreeness(di: number, hi: number): number {
  const free = mockMembers.filter(m => m.schedule[`${di}-${hi}`] === 'free').length;
  return free / mockMembers.length;
}

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

// Score ring visual
function ScoreRing({ score, quality }: { score: number; quality: SuggestedSlot['quality'] }) {
  const color = quality === 'best' ? '#22c55e' : quality === 'good' ? '#a855f7' : '#f59e0b';
  const r = 18, c = 22, circumf = 2 * Math.PI * r;
  return (
    <div className="relative w-11 h-11 shrink-0">
      <svg width="44" height="44" className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumf} strokeDashoffset={circumf * (1 - score / 100)}
          strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">{score}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function TeamCoordination() {
  const [selectedSlot, setSelectedSlot] = useState<string>('1');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(true);
  const [participants, setParticipants] = useState(participantResponses);
  const [responses, setResponses] = useState(participantResponses);

  // Meeting form
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDesc, setMeetingDesc] = useState('');
  const [meetingDuration, setMeetingDuration] = useState('60');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [notifSent, setNotifSent] = useState(false);

  const accepted = responses.filter(r => r.status === 'accepted').length;
  const pending  = responses.filter(r => r.status === 'pending').length;
  const declined = responses.filter(r => r.status === 'declined').length;

  const selectedSlotData = suggestedSlots.find(s => s.id === selectedSlot)!;

  const handleAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => { setAnalyzing(false); setAnalyzed(true); }, 1500);
  };

  const handleSendNotif = () => {
    setNotifSent(true);
    setTimeout(() => setNotifSent(false), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/40 min-h-full">
      <div className="max-w-6xl mx-auto px-6 py-8 pb-20 space-y-6">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md bg-purple-500 flex items-center justify-center">
                <Shield size={11} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Team Leader</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Meeting Coordination</h1>
            <p className="text-sm text-gray-400 mt-0.5">Analyze team schedules, find optimal slots, and notify your team</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-100 shadow-sm">
              <Users size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-gray-700">{mockMembers.length} members</span>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-purple-200 bg-white text-purple-600 text-sm font-semibold hover:bg-purple-50 transition-colors"
            >
              {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <BarChart2 size={14} />}
              {analyzing ? 'Analyzing…' : 'Analyze Schedules'}
            </button>
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors shadow-sm"
            >
              <Plus size={14} />
              Create Meeting
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Team Members',    value: mockMembers.length, icon: <Users size={15} />,      color: 'text-purple-500', bg: 'bg-purple-50' },
            { label: 'Accepted',        value: accepted,           icon: <CheckCircle size={15} />, color: 'text-green-500',  bg: 'bg-green-50'  },
            { label: 'Pending Reply',   value: pending,            icon: <Clock size={15} />,       color: 'text-amber-500',  bg: 'bg-amber-50'  },
            { label: 'Declined',        value: declined,           icon: <XCircle size={15} />,     color: 'text-red-400',    bg: 'bg-red-50'    },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0`}>{stat.icon}</div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">

          {/* LEFT */}
          <div className="space-y-6">

            {/* Team Availability Dashboard */}
            <Card title="Team Availability Dashboard" icon={<Calendar size={14} />}
              action={
                <div className="flex items-center gap-3 text-[10px] font-semibold">
                  {[{ color: 'bg-green-200', label: 'Free' }, { color: 'bg-red-200', label: 'Busy' }, { color: 'bg-amber-200', label: 'Tentative' }].map(l => (
                    <div key={l.label} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-sm ${l.color}`} /><span className="text-gray-400">{l.label}</span></div>
                  ))}
                </div>
              }
            >
              <div className="overflow-x-auto">
                <div className="min-w-[520px]">
                  {/* Column headers */}
                  <div className="flex mb-2">
                    <div className="w-28 shrink-0" />
                    {TEAM_DAYS.map(d => (
                      <div key={d} className="flex-1 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide py-1">{d}</div>
                    ))}
                  </div>

                  {/* Hour rows */}
                  {TEAM_HOURS.map((h, hi) => (
                    <div key={h} className="flex items-stretch mb-0.5">
                      <div className="w-28 shrink-0 flex items-center">
                        <span className="text-[10px] text-gray-300 font-medium">{h}</span>
                      </div>
                      {TEAM_DAYS.map((_, di) => {
                        const freeness = getColumnFreeness(di, hi);
                        const allFree = freeness === 1;
                        const mostFree = freeness >= 0.85;
                        return (
                          <div
                            key={di}
                            className={`flex-1 mx-px h-6 rounded-sm flex items-center justify-center transition-all relative group cursor-pointer ${
                              allFree ? 'bg-green-200/80 ring-1 ring-green-300/50' :
                              mostFree ? 'bg-green-100/70' :
                              freeness >= 0.5 ? 'bg-amber-100/60' : 'bg-red-100/50'
                            }`}
                          >
                            <div className="absolute z-10 bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-gray-900 text-white text-[9px] rounded-lg px-2 py-1.5 whitespace-nowrap shadow-xl gap-0.5">
                              <span className="font-semibold">{TEAM_DAYS[di]} · {h}</span>
                              <span className="text-gray-300">{Math.round(freeness * mockMembers.length)}/{mockMembers.length} free</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Member rows detail */}
                  <div className="mt-4 space-y-1">
                    {mockMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${m.color}`}>{m.initials}</div>
                        <div className="w-20 text-[10px] text-gray-500 font-medium truncate">{m.name.split(' ')[0]}</div>
                        <div className="flex flex-1 gap-px">
                          {TEAM_DAYS.map((_, di) =>
                            TEAM_HOURS.map((_, hi) => (
                              <div
                                key={`${di}-${hi}`}
                                className={`h-3 rounded-[2px] flex-1 ${getCellClass(m.schedule[`${di}-${hi}`])}`}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Conflict Handling */}
            <Card title="Conflict Analysis" icon={<AlertTriangle size={14} />}>
              <div className="space-y-3">
                {selectedSlotData.conflicts.length === 0 ? (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-50 border border-green-100">
                    <CheckCircle size={16} className="text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-700">No conflicts detected</p>
                      <p className="text-xs text-green-600 mt-0.5">All 7 members are available for the selected slot.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-100">
                      <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-700">{selectedSlotData.conflicts.length} conflict{selectedSlotData.conflicts.length > 1 ? 's' : ''} found</p>
                        <p className="text-xs text-amber-600 mt-0.5">{selectedSlotData.conflicts.join(', ')} {selectedSlotData.conflicts.length === 1 ? 'has' : 'have'} a scheduling conflict.</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {selectedSlotData.conflicts.map((name, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-sky-200 text-sky-700 flex items-center justify-center text-[9px] font-bold">
                              {name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-700">{name}</p>
                              <p className="text-[10px] text-gray-400">Has existing commitment at this time</p>
                            </div>
                          </div>
                          <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-semibold border border-amber-100">Conflict</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="pt-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Info size={10} />Alternative suggestions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['Apr 14, 9–10 AM', 'Apr 15, 2–3 PM', 'Apr 16, 10–11 AM', 'Apr 17, 1–2 PM'].map((alt, i) => (
                      <button key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 transition-all text-left group">
                        <Calendar size={12} className="text-gray-300 group-hover:text-purple-400 shrink-0" />
                        <span className="text-[10px] text-gray-600 font-medium">{alt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

          </div>

          {/* RIGHT */}
          <div className="space-y-5">

            {/* Suggested Slots */}
            <Card title="Suggested Meeting Slots" icon={<Sparkles size={14} />}
              action={<span className="text-[10px] text-purple-500 font-semibold bg-purple-50 px-2 py-1 rounded-full">AI-powered</span>}
            >
              {!analyzed ? (
                <div className="py-8 text-center text-gray-400">
                  <BarChart2 size={28} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-xs font-medium">Click "Analyze Schedules" to find optimal slots</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestedSlots.map(slot => {
                    const qs = slotQualityStyle[slot.quality];
                    const isSelected = selectedSlot === slot.id;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot(slot.id)}
                        className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                          isSelected ? `${qs.border} ${qs.bg} ring-2 ${qs.ring}` : 'border-gray-100 hover:border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <ScoreRing score={slot.score} quality={slot.quality} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${qs.badge}`}>{slot.label}</span>
                              {slot.quality === 'best' && <Star size={10} className="text-green-400" fill="currentColor" />}
                            </div>
                            <p className="text-xs font-semibold text-gray-800">{slot.day}, {slot.date}</p>
                            <p className="text-[10px] text-gray-400">{slot.time} · {slot.duration}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Users size={9} className="text-gray-300" />
                              <span className="text-[9px] text-gray-400">{slot.freeCount}/{mockMembers.length} free</span>
                              {slot.conflicts.length > 0 && (
                                <span className="text-[9px] text-amber-500 font-medium ml-1">· {slot.conflicts.length} conflict</span>
                              )}
                            </div>
                          </div>
                          {isSelected && <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center shrink-0"><Check size={9} className="text-white" /></div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Create / Confirm Meeting */}
            <Card title="Meeting Coordination Panel" icon={<Calendar size={14} />}>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Meeting Title</label>
                  <input
                    value={meetingTitle}
                    onChange={e => setMeetingTitle(e.target.value)}
                    placeholder="e.g. Sprint Planning Session"
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Description</label>
                  <textarea
                    value={meetingDesc}
                    onChange={e => setMeetingDesc(e.target.value)}
                    rows={2}
                    placeholder="Brief meeting description…"
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Duration</label>
                    <select value={meetingDuration} onChange={e => setMeetingDuration(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300">
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                      <option value="90">90 min</option>
                      <option value="120">2 hours</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Selected Slot</label>
                    <div className="mt-1 px-3 py-2 rounded-xl border border-purple-200 bg-purple-50/40 text-[10px] text-purple-700 font-semibold">
                      {selectedSlotData ? `${selectedSlotData.day}, ${selectedSlotData.date}` : 'None selected'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-500 text-white text-xs font-semibold hover:bg-purple-600 transition-colors"
                  >
                    <Check size={12} />
                    Confirm Slot
                  </button>
                  <button
                    onClick={handleSendNotif}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      notifSent ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {notifSent ? <><Check size={12} />Sent!</> : <><Send size={12} />Notify Team</>}
                  </button>
                </div>
              </div>
            </Card>

            {/* Participant Responses */}
            <Card title="Participant Responses" icon={<UserCheck size={14} />}
              action={
                <div className="flex items-center gap-2 text-[10px] font-semibold">
                  <span className="text-green-600">{accepted} ✓</span>
                  <span className="text-amber-500">{pending} ⏳</span>
                  <span className="text-red-400">{declined} ✗</span>
                </div>
              }
            >
              {/* Progress bar */}
              <div className="flex h-2 rounded-full overflow-hidden mb-4 gap-0.5">
                <div className="bg-green-300 rounded-full transition-all" style={{ flex: accepted }} />
                <div className="bg-amber-200 rounded-full transition-all" style={{ flex: pending }} />
                <div className="bg-red-200 rounded-full transition-all" style={{ flex: declined }} />
              </div>

              <div className="space-y-2">
                {responses.map(r => {
                  const rs = responseStyle[r.status];
                  return (
                    <div key={r.memberId} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${r.color}`}>{r.initials}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{r.name}</p>
                        {r.note && <p className="text-[9px] text-gray-400 truncate">"{r.note}"</p>}
                        {r.responseTime && <p className="text-[9px] text-gray-300">{r.responseTime}</p>}
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold ${rs.cls}`}>
                        {rs.icon}
                        <span>{rs.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Notification History */}
            <Card title="Notification History" icon={<Bell size={14} />}>
              <div className="space-y-2.5">
                {notifHistory.map(n => {
                  const ns = notifTypeStyle[n.type];
                  return (
                    <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 hover:border-gray-100 transition-all">
                      <div className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold mt-0.5 ${ns.cls}`}>{ns.label}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{n.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-gray-400">
                          <span>{n.sentAt}</span>
                          <span>·</span>
                          <span>{n.recipients} recipients</span>
                          <span>·</span>
                          <span className={n.deliveredPct === 100 ? 'text-green-500 font-semibold' : 'text-amber-500 font-semibold'}>{n.deliveredPct}% delivered</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

          </div>
        </div>
      </div>

      {/* ── Confirm Modal ─────────────────────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8 max-w-sm w-full">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 mb-4">
              <Calendar size={22} />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Confirm Meeting Slot?</h3>
            <p className="text-sm text-gray-500 mb-2">
              You're about to confirm the following slot for your team:
            </p>
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 mb-5">
              <p className="text-sm font-bold text-purple-700">{selectedSlotData?.label}</p>
              <p className="text-xs text-purple-600 mt-0.5">{selectedSlotData?.day}, {selectedSlotData?.date} · {selectedSlotData?.time}</p>
              <p className="text-xs text-gray-400 mt-1">{selectedSlotData?.freeCount}/{mockMembers.length} members available</p>
            </div>
            <p className="text-xs text-gray-400 mb-5">All team members will be notified immediately after confirmation.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors">Cancel</button>
              <button
                onClick={() => { setShowConfirmModal(false); handleSendNotif(); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
              >
                Confirm & Notify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
