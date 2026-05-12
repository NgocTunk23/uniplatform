import React, { useEffect, useMemo, useState } from 'react';
import { getAvatarUrl } from '../utils/avatar';
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface TeamCoordinationProps {
  workspaceId?: string | null;
}

interface WorkspaceMember {
  username: string;
  fullname?: string;
  imageggid?: string;
  workspacerole?: string;
}

interface Workspace {
  workspaceid: string;
  id?: string;
  name: string;
  member?: WorkspaceMember[];
  members?: WorkspaceMember[];
}

interface SuggestedSlot {
  id: string;
  starttime: string;
  endtime: string;
  durationMinutes: number;
  score: number;
  quality: 'best' | 'good' | 'low';
  freeCount: number;
  conflicts: unknown[];
}

interface BusyEvent {
  source: 'schedule' | 'meeting';
  id: string;
  title: string;
  usernames: string[];
  starttime: string;
  endtime: string;
  type: 'busy' | 'tentative' | 'meeting';
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const MAX_SUGGEST_DAYS = 5;

function getWorkspaceId(workspace?: Workspace | null) {
  return workspace?.workspaceid || workspace?.id || '';
}

function getWorkspaceMembers(workspace?: Workspace | null) {
  return workspace?.members || workspace?.member || [];
}

function toLocalInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function getDefaultRange() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(18, 0, 0, 0);
  return {
    searchStart: toLocalInputValue(start),
    searchEnd: toLocalInputValue(end),
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatMember(member: WorkspaceMember) {
  return member.fullname || member.username;
}

function initials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function overlaps(event: BusyEvent, start: Date, end: Date) {
  return new Date(event.starttime) < end && new Date(event.endtime) > start;
}

function parseHour(value: string) {
  const hour = new Date(value).getHours();
  return Number.isFinite(hour) ? hour : 8;
}

function qualityLabel(slot: SuggestedSlot) {
  if (slot.quality === 'best') return 'Best match';
  if (slot.quality === 'good') return 'Good option';
  return 'Available';
}

function Card({ title, icon, children, action }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
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

export function TeamCoordination({ workspaceId }: TeamCoordinationProps) {
  const token = localStorage.getItem('uniplatform_user_token') || '';
  const currentUsername = localStorage.getItem('uniplatform_username') || '';
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [searchStart, setSearchStart] = useState(defaultRange.searchStart);
  const [searchEnd, setSearchEnd] = useState(defaultRange.searchEnd);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingPlace, setMeetingPlace] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [slots, setSlots] = useState<SuggestedSlot[]>([]);
  const [busyEvents, setBusyEvents] = useState<BusyEvent[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');

  const members = getWorkspaceMembers(workspace);
  const currentMembership = members.find(member => member.username === currentUsername);
  const canCoordinate = !currentMembership || currentMembership.workspacerole === 'Leader';
  const selectedSlot = slots.find(slot => slot.id === selectedSlotId) || slots[0];
  const workspaceName = workspace?.name || 'Workspace';

  const fetchJson = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || 'Request failed');
    }
    return data;
  };

  useEffect(() => {
    if (!workspaceId) return;

    const loadWorkspace = async () => {
      setLoading(true);
      try {
        const data = await fetchJson(`${apiUrl}/api/workspaces/${workspaceId}`);
        setWorkspace(data);
        const workspaceMembers = getWorkspaceMembers(data);
        setSelectedParticipants(workspaceMembers.map(member => member.username));
      } catch (error) {
        console.error('Load workspace coordination error', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load workspace');
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();
  }, [workspaceId]);

  useEffect(() => {
    setSelectedSlotId(slots[0]?.id || '');
  }, [slots]);

  const selectedMemberObjects = useMemo(() => {
    const selected = new Set(selectedParticipants);
    return members.filter(member => selected.has(member.username));
  }, [members, selectedParticipants]);

  const availabilityDays = useMemo(() => {
    const start = new Date(searchStart);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: MAX_SUGGEST_DAYS }, (_, index) => {
      const day = new Date(start);
      day.setDate(day.getDate() + index);
      return day;
    });
  }, [searchStart]);

  const availabilityHours = useMemo(() => {
    const startHour = parseHour(searchStart);
    const endHour = Math.max(startHour + 1, parseHour(searchEnd));
    return Array.from({ length: Math.min(16, endHour - startHour) }, (_, index) => startHour + index);
  }, [searchStart, searchEnd]);

  const handleParticipantToggle = (username: string) => {
    setSelectedParticipants(prev => {
      if (prev.includes(username)) return prev.filter(item => item !== username);
      return [...prev, username];
    });
  };

  const getCellState = (username: string, day: Date, hour: number) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    const event = busyEvents.find(item => item.usernames.includes(username) && overlaps(item, start, end));
    if (!event) return 'free';
    if (event.source === 'meeting') return 'meeting';
    return event.type;
  };

  const handleAnalyze = async () => {
    const workspaceid = getWorkspaceId(workspace);
    if (!workspaceid || selectedParticipants.length === 0) {
      toast.error('Select a workspace and at least one participant');
      return;
    }

    if (new Date(searchEnd) <= new Date(searchStart)) {
      toast.error('Search end must be after search start');
      return;
    }

    setAnalyzing(true);
    try {
      const data = await fetchJson(`${apiUrl}/api/meetings/suggest-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceid,
          participants: selectedParticipants,
          durationMinutes,
          searchStart: new Date(searchStart).toISOString(),
          searchEnd: new Date(searchEnd).toISOString(),
        }),
      });

      setSlots(data.data?.slots || []);
      setBusyEvents(data.data?.busyEvents || []);
      if ((data.data?.slots || []).length === 0) {
        toast.error('No free slot found. Try a wider date range, shorter duration, or fewer participants.');
      } else {
        toast.success('Free slots found');
      }
    } catch (error) {
      console.error('Analyze schedules error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze schedules');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateMeeting = async () => {
    if (!selectedSlot) {
      toast.error('Choose a suggested slot first');
      return;
    }

    if (!meetingTitle.trim()) {
      toast.error('Meeting title is required');
      return;
    }

    setCreating(true);
    try {
      await fetchJson(`${apiUrl}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceid: getWorkspaceId(workspace),
          title: meetingTitle.trim(),
          starttime: new Date(selectedSlot.starttime).toISOString(),
          endtime: new Date(selectedSlot.endtime).toISOString(),
          participants: selectedParticipants,
          place: meetingPlace.trim() || undefined,
          link: meetingLink.trim() || undefined,
        }),
      });

      toast.success('Meeting created and added to calendars');
      setMeetingTitle('');
      setMeetingPlace('');
      setMeetingLink('');
      await handleAnalyze();
    } catch (error) {
      console.error('Create coordinated meeting error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create meeting');
    } finally {
      setCreating(false);
    }
  };

  if (!workspaceId) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50/40 min-h-full p-8">
        <div className="max-w-3xl mx-auto bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-500">
          Select a workspace first to coordinate a meeting.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/40 min-h-full">
      <div className="max-w-6xl mx-auto px-6 py-8 pb-20 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-md bg-purple-500 flex items-center justify-center">
                <Shield size={11} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Team Leader</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Meeting Coordination</h1>
            <p className="text-sm text-gray-400 mt-0.5">Analyze real schedules in {workspaceName} and create conflict-free meetings</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-100 shadow-sm">
              <Users size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-gray-700">{members.length} members</span>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || analyzing || !canCoordinate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-purple-200 bg-white text-purple-600 text-sm font-semibold hover:bg-purple-50 transition-colors disabled:opacity-60"
            >
              {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <BarChart2 size={14} />}
              {analyzing ? 'Analyzing...' : 'Analyze Schedules'}
            </button>
          </div>
        </div>

        {!canCoordinate && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertTriangle size={16} />
            Only workspace leaders can create coordinated meetings.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Selected', value: selectedParticipants.length, icon: <Users size={15} />, color: 'text-purple-500', bg: 'bg-purple-50' },
            { label: 'Busy blocks', value: busyEvents.filter(event => event.source === 'schedule').length, icon: <XCircle size={15} />, color: 'text-red-500', bg: 'bg-red-50' },
            { label: 'Meetings', value: busyEvents.filter(event => event.source === 'meeting').length, icon: <Calendar size={15} />, color: 'text-amber-500', bg: 'bg-amber-50' },
            { label: 'Free slots', value: slots.length, icon: <CheckCircle size={15} />, color: 'text-green-500', bg: 'bg-green-50' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0`}>{stat.icon}</div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            <Card title="Search Settings" icon={<Clock size={14} />}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">From</label>
                  <input
                    type="datetime-local"
                    value={searchStart}
                    onChange={event => setSearchStart(event.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">To</label>
                  <input
                    type="datetime-local"
                    value={searchEnd}
                    onChange={event => setSearchEnd(event.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Duration</label>
                  <select
                    value={durationMinutes}
                    onChange={event => setDurationMinutes(Number(event.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card title="Team Availability Dashboard" icon={<Calendar size={14} />}>
              {loading ? (
                <div className="py-12 flex flex-col items-center text-gray-400">
                  <Loader2 size={24} className="animate-spin mb-3" />
                  <p className="text-sm">Loading workspace members...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {members.map(member => {
                      const checked = selectedParticipants.includes(member.username);
                      return (
                        <label key={member.username} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer ${checked ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-gray-100 bg-white text-gray-500'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleParticipantToggle(member.username)}
                            className="accent-purple-500"
                          />
                          {getAvatarUrl(member.imageggid) ? (
                            <img
                              src={getAvatarUrl(member.imageggid) || ''}
                              alt={`${formatMember(member)} avatar`}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold">
                              {initials(formatMember(member))}
                            </div>
                          )}
                          <span>{formatMember(member)}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-[700px]">
                      <div className="grid grid-cols-[140px_repeat(5,1fr)] gap-1 mb-2">
                        <div />
                        {availabilityDays.map(day => (
                          <div key={day.toISOString()} className="text-center text-[10px] font-semibold text-gray-500 uppercase">
                            {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                        ))}
                      </div>

                      {selectedMemberObjects.map(member => (
                        <div key={member.username} className="grid grid-cols-[140px_repeat(5,1fr)] gap-1 mb-2 items-center">
                          <div className="flex items-center gap-2 min-w-0">
                            {getAvatarUrl(member.imageggid) ? (
                              <img
                                src={getAvatarUrl(member.imageggid) || ''}
                                alt={`${formatMember(member)} avatar`}
                                className="w-7 h-7 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {initials(formatMember(member))}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-700 truncate">{formatMember(member)}</p>
                              <p className="text-[9px] text-gray-400">{member.workspacerole || 'Member'}</p>
                            </div>
                          </div>
                          {availabilityDays.map(day => (
                            <div key={day.toISOString()} className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${availabilityHours.length}, minmax(0, 1fr))` }}>
                              {availabilityHours.map(hour => {
                                const state = getCellState(member.username, day, hour);
                                const cls = state === 'free'
                                  ? 'bg-green-100'
                                  : state === 'meeting'
                                    ? 'bg-purple-200'
                                    : state === 'tentative'
                                      ? 'bg-amber-200'
                                      : 'bg-red-200';
                                return <span key={hour} title={`${hour}:00 ${state}`} className={`h-5 rounded-sm ${cls}`} />;
                              })}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-gray-400">
                    {[
                      ['bg-green-100', 'Free'],
                      ['bg-red-200', 'Busy'],
                      ['bg-amber-200', 'Tentative'],
                      ['bg-purple-200', 'Meeting'],
                    ].map(([cls, label]) => (
                      <span key={label} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-sm ${cls}`} />{label}</span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-5">
            <Card title="Suggested Meeting Slots" icon={<Sparkles size={14} />}>
              {analyzing ? (
                <div className="py-10 flex flex-col items-center text-gray-400">
                  <RefreshCw size={24} className="animate-spin mb-3" />
                  <p className="text-sm">Finding shared free slots...</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <BarChart2 size={28} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-xs font-medium">Analyze schedules to find conflict-free slots</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {slots.map(slot => {
                    const selected = (selectedSlot?.id || '') === slot.id;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${selected ? 'border-purple-200 bg-purple-50/50 ring-2 ring-purple-100' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xs font-bold shrink-0">{slot.score}</div>
                          <div className="flex-1 min-w-0">
                            <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 mb-1">{qualityLabel(slot)}</span>
                            <p className="text-xs font-semibold text-gray-800">{formatDateTime(slot.starttime)}</p>
                            <p className="text-[10px] text-gray-400">{formatTime(slot.starttime)} - {formatTime(slot.endtime)} · {slot.durationMinutes} min</p>
                            <p className="text-[9px] text-gray-400 mt-1">{slot.freeCount}/{selectedParticipants.length} selected members free</p>
                          </div>
                          {selected && <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center shrink-0"><Check size={9} className="text-white" /></div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Create Meeting" icon={<Plus size={14} />}>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Title</label>
                  <input
                    value={meetingTitle}
                    onChange={event => setMeetingTitle(event.target.value)}
                    placeholder="e.g. Sprint Planning"
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Place</label>
                    <input
                      value={meetingPlace}
                      onChange={event => setMeetingPlace(event.target.value)}
                      placeholder="Room A"
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Link</label>
                    <input
                      value={meetingLink}
                      onChange={event => setMeetingLink(event.target.value)}
                      placeholder="https://..."
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                  <p className="text-xs font-bold text-purple-700">{selectedSlot ? formatDateTime(selectedSlot.starttime) : 'No slot selected'}</p>
                  {selectedSlot && <p className="text-[10px] text-purple-600 mt-0.5">{formatTime(selectedSlot.starttime)} - {formatTime(selectedSlot.endtime)}</p>}
                </div>
                <button
                  onClick={handleCreateMeeting}
                  disabled={creating || !selectedSlot || !canCoordinate}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-500 text-white text-xs font-semibold hover:bg-purple-600 transition-colors disabled:opacity-60"
                >
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {creating ? 'Creating...' : 'Confirm Slot'}
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
