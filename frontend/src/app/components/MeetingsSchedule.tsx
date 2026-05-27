import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Users,
  Video,
  X,
  Edit3,
} from 'lucide-react';
import { toast } from 'sonner';

interface Meeting {
  meetingid: string;
  id?: string;
  title: string;
  starttime: string;
  endtime: string;
  organizer: string;
  participants: string[];
  activeParticipantsCount?: number;
  status: 'upcoming' | 'ongoing' | 'ended';
  workspace?: { name?: string };
  place?: string | null;
  link?: string | null;
  participantDetails?: { username: string; fullname?: string; imageggid?: string }[];
  organizerDetails?: { username: string; fullname?: string; imageggid?: string };
  rsvpStatus?: Record<string, 'pending' | 'accepted' | 'declined'>;
  rsvpDetails?: Record<string, { reason?: string; attachment?: string }>;
}

interface WorkspaceMember {
  username: string;
  fullname?: string;
  workspacerole?: string;
}

interface Workspace {
  workspaceid: string;
  id?: string;
  name: string;
  members?: WorkspaceMember[];
  member?: WorkspaceMember[];
}

interface CreateMeetingForm {
  title: string;
  workspaceid: string;
  starttime: string;
  endtime: string;
  place: string;
  link: string;
  participants: string[];
}

interface ConflictEvent {
  source: 'schedule' | 'meeting';
  title: string;
  usernames: string[];
  starttime: string;
  endtime: string;
  type: string;
}

interface ConflictInfo {
  conflicts: ConflictEvent[];
  pendingBody: Record<string, unknown>;
}

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const emptyForm: CreateMeetingForm = {
  title: '',
  workspaceid: '',
  starttime: '',
  endtime: '',
  place: '',
  link: '',
  participants: [],
};

function getMeetingId(meeting: Meeting) {
  return meeting.meetingid || meeting.id || '';
}

function getWorkspaceId(workspace: Workspace) {
  return workspace.workspaceid || workspace.id || '';
}

function getWorkspaceMembers(workspace?: Workspace) {
  return workspace?.members || workspace?.member || [];
}

function computeStatus(meeting: Meeting): Meeting['status'] {
  if (meeting.status === 'ended') return 'ended';
  if (meeting.status === 'ongoing') return 'ongoing';

  const now = Date.now();
  const start = new Date(meeting.starttime).getTime();
  const end = new Date(meeting.endtime).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return meeting.status || 'upcoming';
  if (now > end) return 'ended';
  if (now >= start && now <= end) return 'ongoing';
  return 'upcoming';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(starttime: string, endtime: string) {
  const minutes = Math.max(0, Math.round((new Date(endtime).getTime() - new Date(starttime).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function toLocalInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function getDefaultTimes() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    starttime: toLocalInputValue(start),
    endtime: toLocalInputValue(end),
  };
}

function StatusBadge({ status }: { status: Meeting['status'] }) {
  if (status === 'ongoing') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
        Live Now
      </span>
    );
  }

  if (status === 'ended') {
    return <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">Ended</span>;
  }

  return <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-xs font-semibold">Scheduled</span>;
}

export function MeetingsSchedule() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'ended'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [declineModal, setDeclineModal] = useState({ isOpen: false, meetingId: '', reason: '', fileName: '' });
  const [form, setForm] = useState<CreateMeetingForm>(emptyForm);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);

  const token = localStorage.getItem('uniplatform_user_token') || '';

  // 1. GIẢI MÃ TOKEN ĐỂ BIẾT USER ĐANG ĐĂNG NHẬP LÀ AI
  const currentUser = useMemo(() => {
    let user = localStorage.getItem('uniplatform_username') || '';
    if (!user && token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        user = payload.username || payload.id || payload.sub || '';
      } catch (e) { }
    }
    return user || 'me';
  }, [token]);

  const selectedWorkspace = workspaces.find(workspace => getWorkspaceId(workspace) === form.workspaceid);
  const selectedMembers = getWorkspaceMembers(selectedWorkspace);

  const fetchJson = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      const err = new Error(errorBody?.message || 'Request failed') as Error & {
        status: number;
        details?: { conflicts?: ConflictEvent[] };
      };
      err.status = res.status;
      err.details = errorBody?.details;
      throw err;
    }

    return res.json();
  };

  const fetchMeetings = async () => {
    try {
      const data = await fetchJson(`${apiUrl}/api/meetings`);
      setMeetings((Array.isArray(data) ? data : []).map(meeting => ({
        ...meeting,
        status: computeStatus(meeting),
      })));
    } catch (error) {
      console.error('Fetch meetings error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load meetings');
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const data = await fetchJson(`${apiUrl}/api/workspaces`);
      const workspaceList = Array.isArray(data) ? data : [];
      setWorkspaces(workspaceList);

      if (workspaceList.length > 0) {
        const firstWorkspace = workspaceList[0];
        const times = getDefaultTimes();
        setForm(prev => ({
          ...prev,
          ...times,
          workspaceid: prev.workspaceid || getWorkspaceId(firstWorkspace),
          participants: prev.participants.length > 0
            ? prev.participants
            : getWorkspaceMembers(firstWorkspace).map(member => member.username),
        }));
      }
    } catch (error) {
      console.error('Fetch workspaces error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load workspaces');
    }
  };

  const loadPageData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchMeetings(), fetchWorkspaces()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const openCreateModal = () => {
    const workspace = workspaces[0];
    const times = getDefaultTimes();
    setForm({
      ...emptyForm,
      ...times,
      workspaceid: workspace ? getWorkspaceId(workspace) : '',
      participants: workspace ? getWorkspaceMembers(workspace).map(member => member.username) : [],
    });
    setEditingId(null);
    setShowCreate(true);
  };

  const openEditModal = (meeting: Meeting) => {
    const ws = workspaces.find(w => w.name === meeting.workspace?.name) || workspaces[0];

    setForm({
      title: meeting.title,
      workspaceid: ws ? getWorkspaceId(ws) : '',
      starttime: toLocalInputValue(new Date(meeting.starttime)),
      endtime: toLocalInputValue(new Date(meeting.endtime)),
      place: meeting.place || '',
      link: meeting.link || '',
      participants: meeting.participants || [],
    });
    setEditingId(getMeetingId(meeting)); // Bật chế độ SỬA
    setShowCreate(true);
  };

  const handleWorkspaceChange = (workspaceid: string) => {
    const workspace = workspaces.find(item => getWorkspaceId(item) === workspaceid);
    setForm(prev => ({
      ...prev,
      workspaceid,
      participants: getWorkspaceMembers(workspace).map(member => member.username),
    }));
  };

  const handleParticipantToggle = (username: string) => {
    setForm(prev => {
      const exists = prev.participants.includes(username);
      return {
        ...prev,
        participants: exists
          ? prev.participants.filter(item => item !== username)
          : [...prev.participants, username],
      };
    });
  };

  const buildMeetingBody = (force = false): Record<string, unknown> => {
    const start = new Date(form.starttime);
    const end = new Date(form.endtime);
    return {
      workspaceid: form.workspaceid,
      title: form.title.trim(),
      starttime: start.toISOString(),
      endtime: end.toISOString(),
      participants: form.participants,
      link: form.link.trim() || undefined,
      place: form.place.trim() || undefined,
      ...(force ? { force: true } : {}),
    };
  };

  const submitCreateMeeting = async (body: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      // Nếu có editingId thì dùng method PUT/PATCH và url có id
      const url = editingId ? `${apiUrl}/api/meetings/${editingId}` : `${apiUrl}/api/meetings`;
      const method = editingId ? 'PUT' : 'POST';

      await fetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      toast.success(editingId ? 'Đã cập nhật cuộc họp!' : 'Đã tạo cuộc họp!');
      setShowCreate(false);
      setEditingId(null);
      setConflictInfo(null);
      await fetchMeetings();
    } catch (error) {
      const apiError = error as Error & { status?: number; details?: { conflicts?: ConflictEvent[] } };
      if (apiError.status === 409 && apiError.details?.conflicts?.length) {
        setConflictInfo({ conflicts: apiError.details.conflicts, pendingBody: body });
      } else {
        toast.error(apiError.message || 'Thao tác thất bại');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.title.trim() || !form.workspaceid || !form.starttime || !form.endtime) {
      toast.error('Please fill in workspace, title, start time, and end time');
      return;
    }

    if (form.participants.length === 0) {
      toast.error('Please select at least one participant');
      return;
    }

    const start = new Date(form.starttime);
    const end = new Date(form.endtime);

    if (end <= start) {
      toast.error('End time must be after start time');
      return;
    }

    await submitCreateMeeting(buildMeetingBody(false));
  };

  const handleForceCreate = () => {
    if (!conflictInfo) return;
    submitCreateMeeting({ ...conflictInfo.pendingBody, force: true });
  };

  const handleDelete = async (meetingId: string) => {
    if (!window.confirm('Delete this meeting?')) return;

    try {
      await fetchJson(`${apiUrl}/api/meetings/${meetingId}`, { method: 'DELETE' });
      setMeetings(prev => prev.filter(meeting => getMeetingId(meeting) !== meetingId));
      toast.success('Meeting deleted');
    } catch (error) {
      console.error('Delete meeting error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete meeting');
    }
  };

  const handleRSVP = async (meetingId: string, status: 'accepted' | 'declined', reason?: string, attachment?: string) => {
    try {
      await fetchJson(`${apiUrl}/api/meetings/${meetingId}/rsvp`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason, attachment })
      });
      toast.success(status === 'accepted' ? 'Đã chấp nhận tham gia!' : 'Đã từ chối cuộc họp!');
      setDeclineModal({ isOpen: false, meetingId: '', reason: '', fileName: '' }); // Đóng modal nếu có
      await fetchMeetings(); // Load lại danh sách
    } catch (error) {
      toast.error('Lỗi khi phản hồi');
    }
  };

  const submitDecline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineModal.reason.trim()) return toast.error('Vui lòng nhập lý do từ chối');
    handleRSVP(declineModal.meetingId, 'declined', declineModal.reason, declineModal.fileName);
  };

  const filteredMeetings = useMemo(() => {
    return meetings.filter(meeting => {
      const status = computeStatus(meeting);
      if (filter === 'all') return true;
      if (filter === 'upcoming') return status === 'upcoming' || status === 'ongoing';
      return status === 'ended';
    });
  }, [meetings, filter]);

  const counts = useMemo(() => ({
    all: meetings.length,
    upcoming: meetings.filter(meeting => ['upcoming', 'ongoing'].includes(computeStatus(meeting))).length,
    ended: meetings.filter(meeting => computeStatus(meeting) === 'ended').length,
  }), [meetings]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-8 py-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Meetings</h1>
            <p className="text-sm text-gray-500">Manage meeting schedules across your workspaces</p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus size={18} />
            Schedule Meeting
          </button>
        </div>

        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All Meetings', count: counts.all },
            { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
            { key: 'ended', label: 'Past', count: counts.ended },
          ].map(tab => (
            <button
              type="button"
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === tab.key ? 'bg-purple-50 text-purple-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              {tab.label}
              <span className="ml-2 text-xs opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="py-16 flex flex-col items-center text-center text-gray-400">
            <Loader2 size={26} className="animate-spin mb-3" />
            <p className="text-sm">Loading meetings...</p>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No meetings found</h3>
            <p className="text-sm text-gray-500">
              {filter === 'all' ? 'Schedule your first meeting to get started' : 'No meetings match this filter'}
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition-colors"
            >
              Schedule Meeting
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-w-5xl">
            {filteredMeetings.map(meeting => {
              const meetingId = getMeetingId(meeting);
              const status = computeStatus(meeting);
              const participantCount = meeting.participants?.length || 0;
              const activeCount = meeting.activeParticipantsCount || 0;

              // 2. CHECK QUYỀN VỚI THÔNG TIN CỦA CURRENT USER
              const isOrganizer =
                meeting.organizer === currentUser ||
                meeting.organizerDetails?.username === currentUser ||
                (!meeting.organizer && !meeting.organizerDetails); // Fallback khi DB bị rỗng

              const myRsvp = meeting.rsvpStatus?.[currentUser] || meeting.rsvpStatus?.['me'] || (isOrganizer ? 'accepted' : 'pending');

              return (
                <div key={meetingId} className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{meeting.title}</h3>
                        <StatusBadge status={status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={16} className="text-gray-400" />
                          {formatDate(meeting.starttime)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock size={16} className="text-gray-400" />
                          {formatTime(meeting.starttime)} - {formatDuration(meeting.starttime, meeting.endtime)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users size={16} className="text-gray-400" />
                          {activeCount > 0 ? `${activeCount} active / ${participantCount} total` : `${participantCount} participants`}
                        </span>
                        {meeting.place && (
                          <span className="flex items-center gap-1.5">
                            <MapPin size={16} className="text-gray-400" />
                            {meeting.place}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 font-medium">
                          {meeting.workspace?.name || 'Workspace'}
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-500">
                          {/* Sửa lại hiển thị Organizer cho đỡ bị trống */}
                          Organizer: {meeting.organizerDetails?.fullname || meeting.organizer || (isOrganizer ? 'Bạn' : 'Không rõ')}
                        </span>
                        {meeting.link && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-600">
                            <LinkIcon size={11} />
                            Link ready
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex gap-2 items-center">
                          {!isOrganizer && myRsvp === 'pending' && (
                            <>
                              <button onClick={() => handleRSVP(meetingId, 'accepted')} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium shadow-sm">Chấp nhận</button>
                              <button onClick={() => setDeclineModal({ isOpen: true, meetingId, reason: '', fileName: '' })} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium">Từ chối</button>
                            </>
                          )}

                          {!isOrganizer && myRsvp === 'accepted' && (
                            <>
                              <button onClick={() => navigate(`/meetings/${meetingId}`)} className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2"><Video size={16} /> Join</button>
                              <button onClick={() => setDeclineModal({ isOpen: true, meetingId, reason: '', fileName: '' })} className="px-4 py-2 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-lg text-sm font-medium transition-colors" title="Rút lui">Hủy tham gia</button>
                            </>
                          )}

                          {!isOrganizer && myRsvp === 'declined' && (
                            <>
                              <span className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">Đã từ chối</span>
                              <button onClick={() => handleRSVP(meetingId, 'accepted')} className="px-4 py-1.5 bg-green-50 hover:bg-green-500 text-green-600 hover:text-white rounded-lg text-sm font-medium transition-colors border border-green-200 hover:border-green-500">Đổi ý (Tham gia)</button>
                            </>
                          )}

                          {isOrganizer && (
                            <>
                              <button onClick={() => navigate(`/meetings/${meetingId}`)} className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-2"><Video size={16} /> {status === 'ongoing' ? 'Join Now' : 'Join'}</button>
                              <button onClick={() => openEditModal(meeting)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Sửa thông tin">
                                <Edit3 size={16} />
                              </button>
                              <button onClick={() => handleDelete(meetingId)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                            </>
                          )}
                        </div>

                        {/* Hiển thị lý do từ chối nếu có */}
                        {!isOrganizer && myRsvp === 'declined' && meeting.rsvpDetails?.[currentUser]?.reason && (
                          <p className="text-[11px] text-gray-400 italic max-w-xs text-right truncate">
                            Lý do: {meeting.rsvpDetails[currentUser].reason}
                            {meeting.rsvpDetails[currentUser].attachment && <span> (Có đính kèm file)</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {conflictInfo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-amber-50 rounded-lg shrink-0">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Lịch bị trùng</h3>
                <p className="text-sm text-gray-500">
                  Một số thành viên đã có lịch bận trong khung giờ này. Bạn vẫn có thể tiếp tục lưu cuộc họp.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-3 mb-5 space-y-2 max-h-48 overflow-y-auto">
              {conflictInfo.conflicts.map((conflict, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <div>
                    <span className="font-medium text-gray-800">{conflict.usernames.join(', ')}</span>
                    <span className="text-gray-500"> — {conflict.title} ({conflict.type})</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleForceCreate}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Lưu/Tiếp tục
              </button>
              <button
                type="button"
                onClick={() => setConflictInfo(null)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
          onClick={() => setShowCreate(false)}
        >
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Create Meeting</h2>
              <button type="button" aria-label="Close" onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Workspace *</label>
                <select
                  value={form.workspaceid}
                  onChange={event => handleWorkspaceChange(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  {workspaces.length === 0 ? (
                    <option value="">No workspaces available</option>
                  ) : (
                    workspaces.map(workspace => (
                      <option key={getWorkspaceId(workspace)} value={getWorkspaceId(workspace)}>
                        {workspace.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Title *</label>
                <input
                  value={form.title}
                  onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
                  placeholder="e.g. Sprint Planning"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Start *</label>
                  <input
                    type="datetime-local"
                    value={form.starttime}
                    onChange={event => setForm(prev => ({ ...prev, starttime: event.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">End *</label>
                  <input
                    type="datetime-local"
                    value={form.endtime}
                    onChange={event => setForm(prev => ({ ...prev, endtime: event.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Place</label>
                  <input
                    value={form.place}
                    onChange={event => setForm(prev => ({ ...prev, place: event.target.value }))}
                    placeholder="Room A or Online"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Meeting Link</label>
                  <input
                    value={form.link}
                    onChange={event => setForm(prev => ({ ...prev, link: event.target.value }))}
                    placeholder="https://meet.google.com/..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Participants *</label>
                  <span className="text-xs text-gray-400">{form.participants.length} selected</span>
                </div>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/60 p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedMembers.length === 0 ? (
                    <p className="col-span-full text-sm text-gray-400 text-center py-4">No members in this workspace</p>
                  ) : (
                    selectedMembers.map(member => (
                      <label key={member.username} className="flex items-center gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={form.participants.includes(member.username)}
                          onChange={() => handleParticipantToggle(member.username)}
                          className="accent-purple-500"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium truncate">{member.fullname || member.username}</span>
                          <span className="block text-[11px] text-gray-400 truncate">{member.username}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                disabled={submitting || !form.title || !form.workspaceid || form.participants.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? 'Creating...' : 'Create Meeting'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {/* MODAL TỪ CHỐI */}
      {declineModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form onSubmit={submitDecline} className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Lý do từ chối tham gia</h3>
            <p className="text-sm text-gray-500 mb-4">Người tổ chức sẽ nhận được thông báo về lý do của bạn.</p>

            <textarea
              autoFocus
              required
              rows={3}
              value={declineModal.reason}
              onChange={e => setDeclineModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="VD: Mình có lịch gặp khách hàng vào giờ này..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-3"
            />

            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Đính kèm minh chứng (Tùy chọn)</label>
              <input
                type="file"
                onChange={e => setDeclineModal(prev => ({ ...prev, fileName: e.target.files?.[0]?.name || '' }))}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-600 hover:file:bg-red-100"
              />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-colors">
                Xác nhận từ chối
              </button>
              <button type="button" onClick={() => setDeclineModal({ isOpen: false, meetingId: '', reason: '', fileName: '' })} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors">
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}