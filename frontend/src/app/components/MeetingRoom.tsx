import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  Users,
  MessageSquare,
  MoreVertical,
  Settings,
  X,
  Paperclip,
  Download,
  Send,
  Grid3x3,
  Maximize2
} from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  initials: string;
  isAudioMuted: boolean;
  isVideoOn: boolean;
  isSpeaking: boolean;
}

interface ChatMessage {
  id: string;
  sender: string;
  senderId: string;
  message: string;
  timestamp: string;
  file?: {
    name: string;
    size: string;
    type: string;
  };
}

const mockParticipants: Participant[] = [
  { id: '1', name: 'Jane Smith (You)', initials: 'JS', isAudioMuted: false, isVideoOn: true, isSpeaking: false },
  { id: '2', name: 'Alex Johnson', initials: 'AJ', isAudioMuted: false, isVideoOn: true, isSpeaking: true },
  { id: '3', name: 'Sam Chen', initials: 'SC', isAudioMuted: false, isVideoOn: false, isSpeaking: false },
  { id: '4', name: 'Morgan Taylor', initials: 'MT', isAudioMuted: true, isVideoOn: true, isSpeaking: false },
  { id: '5', name: 'Jordan Lee', initials: 'JL', isAudioMuted: false, isVideoOn: true, isSpeaking: false },
];

const mockChatMessages: ChatMessage[] = [
  {
    id: '1',
    sender: 'Alex Johnson',
    senderId: '2',
    message: 'Hey everyone! Ready to start?',
    timestamp: '2:01 PM'
  },
  {
    id: '2',
    sender: 'Sam Chen',
    senderId: '3',
    message: "Yes, let me share the design mockups",
    timestamp: '2:02 PM',
    file: {
      name: 'mobile-app-mockups.pdf',
      size: '2.4 MB',
      type: 'pdf'
    }
  },
  {
    id: '3',
    sender: 'Morgan Taylor',
    senderId: '4',
    message: 'Great! I reviewed the initial designs and have some feedback',
    timestamp: '2:03 PM'
  },
];

export function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockChatMessages);
  const [newMessage, setNewMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLeaveMeeting = () => {
    navigate('/meetings');
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      sender: 'Jane Smith (You)',
      senderId: '1',
      message: newMessage,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    };

    setChatMessages([...chatMessages, message]);
    setNewMessage('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      sender: 'Jane Smith (You)',
      senderId: '1',
      message: 'Shared a file',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      file: {
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        type: file.name.split('.').pop() || 'file'
      }
    };

    setChatMessages([...chatMessages, message]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800/50 border-b border-gray-700/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-white font-medium">Software Engineering Sprint Planning</span>
          </div>
          <span className="text-gray-400 text-sm">2:15:32</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-300">
            <Settings size={20} />
          </button>
          <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-300">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
            {mockParticipants.map((participant) => (
              <div
                key={participant.id}
                className={`relative bg-gray-800 rounded-xl overflow-hidden aspect-video ${
                  participant.isSpeaking ? 'ring-2 ring-purple-500' : ''
                }`}
              >
                {participant.isVideoOn ? (
                  <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-gray-800 flex items-center justify-center">
                    {participant.id === '1' ? (
                      <div className="text-center">
                        <div className="w-24 h-24 rounded-full bg-purple-500 flex items-center justify-center text-white text-2xl mb-2">
                          {participant.initials}
                        </div>
                        <p className="text-white text-sm">{participant.name}</p>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-white text-xl">
                        {participant.initials}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-white text-xl mb-2">
                        {participant.initials}
                      </div>
                      <p className="text-gray-400 text-sm">{participant.name}</p>
                    </div>
                  </div>
                )}

                {/* Participant Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/80 to-transparent p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{participant.name}</span>
                    <div className="flex items-center gap-2">
                      {participant.isAudioMuted ? (
                        <div className="p-1 bg-red-500 rounded">
                          <MicOff size={14} className="text-white" />
                        </div>
                      ) : (
                        <div className={`p-1 ${participant.isSpeaking ? 'bg-purple-500' : 'bg-gray-700'} rounded`}>
                          <Mic size={14} className="text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar - Chat */}
        {showChat && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Meeting Chat</h3>
              <button
                onClick={() => setShowChat(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-sm text-gray-900">{msg.sender}</span>
                    <span className="text-xs text-gray-500">{msg.timestamp}</span>
                  </div>
                  <div className={`${msg.senderId === '1' ? 'bg-purple-50 border border-purple-100' : 'bg-gray-50 border border-gray-100'} rounded-lg p-3`}>
                    <p className="text-sm text-gray-900">{msg.message}</p>
                    {msg.file && (
                      <div className="mt-2 flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg">
                        <div className="p-2 bg-purple-50 rounded">
                          <Paperclip size={16} className="text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{msg.file.name}</p>
                          <p className="text-xs text-gray-500">{msg.file.size}</p>
                        </div>
                        <button className="p-1.5 hover:bg-gray-100 rounded transition-colors">
                          <Download size={16} className="text-gray-600" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Paperclip size={20} className="text-gray-600" />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Participants Panel */}
        {showParticipants && (
          <div className="w-64 bg-white border-l border-gray-200 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Participants ({mockParticipants.length})</h3>
              <button
                onClick={() => setShowParticipants(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {mockParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-semibold">
                    {participant.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{participant.name}</p>
                  </div>
                  <div className="flex gap-1">
                    {participant.isAudioMuted ? (
                      <MicOff size={14} className="text-red-500" />
                    ) : (
                      <Mic size={14} className={participant.isSpeaking ? 'text-purple-500' : 'text-gray-400'} />
                    )}
                    {!participant.isVideoOn && <VideoOff size={14} className="text-gray-400" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800/50 border-t border-gray-700/50">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Meeting ID: {meetingId}</span>
        </div>

        {/* Center Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMicOn(!isMicOn)}
            className={`p-3 rounded-full transition-colors ${
              isMicOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {isMicOn ? (
              <Mic size={20} className="text-white" />
            ) : (
              <MicOff size={20} className="text-white" />
            )}
          </button>

          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`p-3 rounded-full transition-colors ${
              isVideoOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {isVideoOn ? (
              <Video size={20} className="text-white" />
            ) : (
              <VideoOff size={20} className="text-white" />
            )}
          </button>

          <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors">
            <Monitor size={20} className="text-white" />
          </button>

          <button
            onClick={handleLeaveMeeting}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-full transition-colors flex items-center gap-2"
          >
            <PhoneOff size={20} className="text-white" />
            <span className="text-white font-medium">Leave</span>
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className={`p-3 rounded-full transition-colors ${
              showParticipants ? 'bg-purple-500' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <Users size={20} className="text-white" />
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-3 rounded-full transition-colors ${
              showChat ? 'bg-purple-500' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <MessageSquare size={20} className="text-white" />
          </button>

          <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors">
            <Grid3x3 size={20} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
