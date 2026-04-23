import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, Clock, Users, Video, FileText, ChevronDown } from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  participants: number;
  status: 'upcoming' | 'ongoing' | 'ended';
  group: string;
  description?: string;
}

const mockMeetings: Meeting[] = [
  {
    id: '1',
    title: 'Software Engineering Sprint Planning',
    date: '2026-04-11',
    time: '2:00 PM',
    duration: '60 min',
    participants: 8,
    status: 'ongoing',
    group: 'Software Eng Project',
    description: 'Planning session for the next development sprint'
  },
  {
    id: '2',
    title: 'Design Review - Mobile App',
    date: '2026-04-11',
    time: '4:30 PM',
    duration: '45 min',
    participants: 5,
    status: 'upcoming',
    group: 'Design Capstone',
    description: 'Review latest mobile app design mockups'
  },
  {
    id: '3',
    title: 'Marketing Campaign Brainstorm',
    date: '2026-04-12',
    time: '10:00 AM',
    duration: '90 min',
    participants: 6,
    status: 'upcoming',
    group: 'Marketing Team',
    description: 'Brainstorming session for Q2 marketing campaign'
  },
  {
    id: '4',
    title: 'Weekly Team Sync',
    date: '2026-04-10',
    time: '3:00 PM',
    duration: '30 min',
    participants: 8,
    status: 'ended',
    group: 'Software Eng Project',
    description: 'Weekly synchronization and updates'
  },
  {
    id: '5',
    title: 'Client Presentation Rehearsal',
    date: '2026-04-09',
    time: '1:00 PM',
    duration: '60 min',
    participants: 4,
    status: 'ended',
    group: 'Design Capstone',
    description: 'Practice run for client presentation'
  },
];

export function MeetingsSchedule() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'ended'>('all');

  const filteredMeetings = mockMeetings.filter(meeting => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') return meeting.status === 'upcoming' || meeting.status === 'ongoing';
    return meeting.status === 'ended';
  });

  const upcomingCount = mockMeetings.filter(m => m.status === 'upcoming' || m.status === 'ongoing').length;
  const endedCount = mockMeetings.filter(m => m.status === 'ended').length;

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

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Meetings</h1>
            <p className="text-sm text-gray-500">Manage your team meeting schedules</p>
          </div>
          <button className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm">
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
            <span className="ml-2 text-xs opacity-70">{mockMeetings.length}</span>
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
          {filteredMeetings.map((meeting) => (
            <div
              key={meeting.id}
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
                      {new Date(meeting.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={16} className="text-gray-400" />
                      {meeting.time}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={16} className="text-gray-400" />
                      {meeting.duration}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users size={16} className="text-gray-400" />
                      {meeting.participants} participants
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 text-xs">
                      {meeting.group}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 ml-6">
                  {meeting.status === 'ended' ? (
                    <button
                      onClick={() => navigate(`/meetings/${meeting.id}/review`)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                      <FileText size={18} />
                      Review Meeting Content
                    </button>
                  ) : (
                    <button
                      onClick={() => handleJoinMeeting(meeting.id)}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm"
                    >
                      <Video size={18} />
                      {meeting.status === 'ongoing' ? 'Join Now' : 'Join'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

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
    </div>
  );
}
