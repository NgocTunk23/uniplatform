import React from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Calendar, Clock, Users, Download, FileText, Video, Mic } from 'lucide-react';

export function MeetingReview() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const mockMeetingData = {
    title: 'Weekly Team Sync',
    date: 'April 10, 2026',
    time: '3:00 PM',
    duration: '30 min',
    participants: [
      'Jane Smith', 'Alex Johnson', 'Sam Chen', 'Morgan Taylor', 'Jordan Lee', 'Casey Brown', 'Riley Davis', 'Taylor Wilson'
    ],
    recording: {
      duration: '28:45',
      size: '145 MB'
    },
    transcript: [
      { speaker: 'Jane Smith', time: '0:00', text: 'Good afternoon everyone! Thanks for joining our weekly sync. Let\'s start with quick updates from each team.' },
      { speaker: 'Alex Johnson', time: '1:23', text: 'I completed the API integration for the new authentication system. It\'s ready for testing.' },
      { speaker: 'Sam Chen', time: '2:45', text: 'Great work! I\'ve finished the UI mockups for the mobile app. I\'ll share them in the chat after this meeting.' },
      { speaker: 'Morgan Taylor', time: '4:10', text: 'I\'ve been working on the database optimization. We\'re seeing about 40% improvement in query performance.' },
      { speaker: 'Jane Smith', time: '5:30', text: 'Excellent progress from everyone. Let\'s move on to discuss the upcoming sprint goals.' }
    ],
    notes: [
      'API authentication integration complete - ready for QA testing',
      'Mobile UI mockups completed - will be shared with team',
      'Database optimization showing 40% performance improvement',
      'Next sprint focus: user onboarding flow and notification system',
      'Code review scheduled for Friday at 2 PM',
      'Team to review security audit findings by end of week'
    ],
    sharedFiles: [
      { name: 'Sprint_Goals_Q2.pdf', size: '2.4 MB', type: 'pdf' },
      { name: 'Database_Performance_Report.xlsx', size: '1.8 MB', type: 'xlsx' },
      { name: 'Meeting_Slides.pptx', size: '5.2 MB', type: 'pptx' }
    ]
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-100">
        <button
          onClick={() => navigate('/meetings')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Meetings</span>
        </button>

        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">{mockMeetingData.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Calendar size={16} className="text-gray-400" />
              {mockMeetingData.date}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={16} className="text-gray-400" />
              {mockMeetingData.time}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={16} className="text-gray-400" />
              {mockMeetingData.duration}
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={16} className="text-gray-400" />
              {mockMeetingData.participants.length} participants
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl space-y-8">
          {/* Recording Section */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recording</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Video size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Meeting Recording</h3>
                    <p className="text-sm text-gray-500">
                      Duration: {mockMeetingData.recording.duration} • Size: {mockMeetingData.recording.size}
                    </p>
                  </div>
                </div>
                <button className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-2">
                  <Download size={18} />
                  Download
                </button>
              </div>
              <div className="bg-gray-200 rounded-lg h-2 overflow-hidden">
                <div className="bg-purple-500 h-full w-0" />
              </div>
            </div>
          </section>

          {/* Transcript Section */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Transcript</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-4">
              {mockMeetingData.transcript.map((item, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <span className="text-xs font-medium text-gray-500">{item.time}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 mb-1">{item.speaker}</p>
                    <p className="text-sm text-gray-700">{item.text}</p>
                  </div>
                </div>
              ))}
              <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                View full transcript
              </button>
            </div>
          </section>

          {/* Meeting Notes Section */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Meeting Notes</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <ul className="space-y-3">
                {mockMeetingData.notes.map((note, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="text-purple-500 mt-1">•</span>
                    <span className="text-sm text-gray-700 flex-1">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Shared Files Section */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shared Files</h2>
            <div className="space-y-3">
              {mockMeetingData.sharedFiles.map((file, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                        <FileText size={20} className="text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">{file.name}</h4>
                        <p className="text-xs text-gray-500">{file.size}</p>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Download size={18} className="text-gray-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Participants Section */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Participants ({mockMeetingData.participants.length})</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {mockMeetingData.participants.map((participant, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-semibold">
                      {participant.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="text-sm text-gray-700">{participant}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
