import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, Clock, Users, Video, FileText, X, Plus } from 'lucide-react';

interface Meeting {
  meetingid: string;
  title: string;
  starttime: string;
  endtime: string;
  participants: string[];
  activeParticipantsCount?: number;
  status: 'upcoming' | 'ongoing' | 'ended';
  workspace?: { name: string };
  description?: string;
}

interface Workspace {
  workspaceid: string;
  name: string;
}

export function MeetingsSchedule() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'ended'>('all');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New meeting form state
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    workspaceid: '',
    starttime: '',
    endtime: '',
  });

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
  const token = localStorage.getItem('uniplatform_user_token');

  useEffect(() => {
    fetchMeetings();
    fetchWorkspaces();
  }, []);

  const fetchMeetings = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/meetings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (err) {
      console.error("Fetch meetings error", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/workspaces`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
        if (data.length > 0) {
          setNewMeeting(prev => ({ ...prev, workspaceid: data[0].workspaceid }));
        }
      }
    } catch (err) {
      console.error("Fetch workspaces error", err);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/api/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newMeeting)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchMeetings();
        setNewMeeting({ title: '', workspaceid: workspaces[0]?.workspaceid || '', starttime: '', endtime: '' });
      }
    } catch (err) {
      console.error("Create meeting error", err);
    }
  };

  const filteredMeetings = meetings.filter(meeting => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') return meeting.status === 'upcoming' || meeting.status === 'ongoing';
    return meeting.status === 'ended';
  });

  const upcomingCount = meetings.filter(m => m.status === 'upcoming' || m.status === 'ongoing').length;
  const endedCount = meetings.filter(m => m.status === 'ended').length;

  const handleJoinMeeting = (meetingId: string) => {
    navigate(`/meetings/${meetingId}`);
  };

  const getStatusBadge = (status: Meeting['status']) => {
    switch (status) {
      case 'ongoing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-600 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            Live Now
          </span>
        );
      case 'upcoming':
        return (
          <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 text-xs">
            Scheduled
          </span>
        );
      case 'ended':
        return (
          <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-xs">
            Ended
          </span>
        );
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Meetings</h1>
            <p className="text-sm text-gray-500">Manage your team meeting schedules</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <Calendar size={18} />
            Schedule Meeting
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-purple-50 text-purple-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Meetings
            <span className="ml-2 text-xs opacity-70">{meetings.length}</span>
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'upcoming'
                ? 'bg-purple-50 text-purple-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Upcoming
            <span className="ml-2 text-xs opacity-70">{upcomingCount}</span>
          </button>
          <button
            onClick={() => setFilter('ended')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'ended'
                ? 'bg-purple-50 text-purple-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Past
            <span className="ml-2 text-xs opacity-70">{endedCount}</span>
          </button>
        </div>
      </div>

      {/* Meetings List */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="space-y-4 max-w-5xl">
          {filteredMeetings.map((meeting) => {
            const start = new Date(meeting.starttime);
            const end = new Date(meeting.endtime);
            const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
            
            return (
              <div
                key={meeting.meetingid}
                className="bg-white border border-gray-100 rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{meeting.title}</h3>
                      {getStatusBadge(meeting.status)}
                    </div>
                    {meeting.description && (
                      <p className="text-sm text-gray-600 mb-3">{meeting.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={16} className="text-gray-400" />
                        {start.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={16} className="text-gray-400" />
                        {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={16} className="text-gray-400" />
                        {duration} min
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users size={16} className={meeting.activeParticipantsCount && meeting.activeParticipantsCount > 0 ? "text-purple-500" : "text-gray-400"} />
                        <span className={meeting.activeParticipantsCount && meeting.activeParticipantsCount > 0 ? "text-purple-600 font-bold" : ""}>
                          {meeting.activeParticipantsCount && meeting.activeParticipantsCount > 0 
                            ? `${meeting.activeParticipantsCount} active / ${meeting.participants.length} total`
                            : `${meeting.participants.length} participants`
                          }
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 text-xs">
                        {meeting.workspace?.name || 'Workspace'}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 ml-6">
                    {meeting.status === 'ended' ? (
                      <button
                        onClick={() => navigate(`/meetings/${meeting.meetingid}/review`)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        <FileText size={18} />
                        Review Meeting Content
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoinMeeting(meeting.meetingid)}
                        className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm"
                      >
                        <Video size={18} />
                        {meeting.status === 'ongoing' ? 'Join Now' : 'Join'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredMeetings.length === 0 && (
            <div className="text-center py-16">
              <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No meetings found</h3>
              <p className="text-sm text-gray-500">
                {filter === 'upcoming' ? 'No upcoming meetings scheduled' : 'No past meetings'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Meeting Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Schedule New Meeting</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateMeeting} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title</label>
                <input 
                  type="text" required
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  value={newMeeting.title}
                  onChange={e => setNewMeeting({...newMeeting, title: e.target.value})}
                  placeholder="e.g. Sprint Planning"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workspace</label>
                <select 
                  required
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  value={newMeeting.workspaceid}
                  onChange={e => setNewMeeting({...newMeeting, workspaceid: e.target.value})}
                >
                  {workspaces.map(ws => (
                    <option key={ws.workspaceid} value={ws.workspaceid}>{ws.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input 
                    type="datetime-local" required
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    value={newMeeting.starttime}
                    onChange={e => setNewMeeting({...newMeeting, starttime: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input 
                    type="datetime-local" required
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                    value={newMeeting.endtime}
                    onChange={e => setNewMeeting({...newMeeting, endtime: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-colors font-medium shadow-sm"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
