import React, { useState } from 'react';
import { 
  Paperclip, 
  Sparkles, 
  Send,
  MoreVertical,
  Search,
  MessageSquare,
  Users,
  FileText
} from 'lucide-react';

const messages = [
  {
    id: 1,
    sender: 'Alex Chen',
    avatar: 'AC',
    initialsColor: 'bg-gray-100 text-gray-700',
    content: "Hey team! I just pushed the latest frontend updates to the main branch. The new dashboard layout should be rendering correctly now.",
    time: '10:24 AM',
    isMe: false,
  },
  {
    id: 2,
    sender: 'Sarah Jenkins',
    avatar: 'SJ',
    initialsColor: 'bg-gray-200 text-gray-800',
    content: "Awesome, thanks Alex! I'll review the PR right after my morning class.",
    time: '10:28 AM',
    isMe: false,
  },
  {
    id: 3,
    sender: 'Jane Smith',
    avatar: 'JS',
    initialsColor: 'bg-purple-200 text-purple-700',
    content: "I can take a look as well. Did you manage to fix the spacing issue on the mobile sidebar?",
    time: '10:32 AM',
    isMe: true,
  },
  {
    id: 4,
    sender: 'Alex Chen',
    avatar: 'AC',
    initialsColor: 'bg-gray-100 text-gray-700',
    content: "Yes, I used Tailwind's hidden classes for mobile and adjusted the flex-basis. It's fully responsive now.",
    time: '10:35 AM',
    isMe: false,
  },
  {
    id: 5,
    sender: 'Alex Chen',
    avatar: 'AC',
    initialsColor: 'bg-gray-100 text-gray-700',
    content: "Also, I attached the updated design specs from the client to the Drive folder. We should review it before the next sync.",
    time: '10:36 AM',
    isMe: false,
    attachment: {
      type: 'pdf',
      name: 'Design_Specs_v2.pdf',
      size: '2.4 MB'
    }
  }
];

interface ChatInterfaceProps {
  groupName: string;
}

export function ChatInterface({ groupName }: ChatInterfaceProps) {
  const [inputText, setInputText] = useState('');

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Chat Header */}
      <div className="h-[73px] px-6 border-b border-gray-100 flex items-center justify-between bg-white/95 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500">
            <MessageSquare size={20} className="fill-purple-500/20" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{groupName}</h2>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
              <Users size={12} className="text-gray-400" />
              <span>4 Members online</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Members Avatars Overlap */}
          <div className="hidden sm:flex -space-x-2 mr-4">
            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 text-gray-700 flex items-center justify-center text-[10px] font-bold z-30 shadow-sm">AC</div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 text-gray-800 flex items-center justify-center text-[10px] font-bold z-20 shadow-sm">SJ</div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-purple-200 text-purple-700 flex items-center justify-center text-[10px] font-bold z-10 shadow-sm">JS</div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-50 text-gray-400 flex items-center justify-center text-[10px] font-bold z-0 shadow-sm">+1</div>
          </div>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
            <Search size={20} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
        <div className="text-center text-xs text-gray-400 font-medium pb-2 flex items-center justify-center gap-4">
          <div className="h-px bg-gray-100 flex-1 max-w-[100px]" />
          Today, 10:24 AM
          <div className="h-px bg-gray-100 flex-1 max-w-[100px]" />
        </div>

        {messages.map((msg, idx) => {
          const showAvatar = idx === 0 || messages[idx - 1].sender !== msg.sender;
          return (
            <div key={msg.id} className={`flex gap-3 ${msg.isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              {!msg.isMe && (
                <div className="w-8 flex-shrink-0 flex justify-center">
                  {showAvatar ? (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${msg.initialsColor} shadow-sm`}>
                      {msg.avatar}
                    </div>
                  ) : (
                    <div className="w-8" />
                  )}
                </div>
              )}
              
              <div className={`flex flex-col max-w-[70%] ${msg.isMe ? 'items-end' : 'items-start'}`}>
                {showAvatar && !msg.isMe && (
                  <span className="text-[11px] font-semibold text-gray-500 mb-1 ml-1">{msg.sender}</span>
                )}
                <div 
                  className={`
                    px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed relative group
                    ${msg.isMe 
                      ? 'bg-purple-400 text-white rounded-tr-sm shadow-sm shadow-purple-200' 
                      : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
                    }
                  `}
                >
                  <p>{msg.content}</p>

                  {/* Attachment rendering */}
                  {msg.attachment && (
                    <div className={`
                      mt-3 flex items-center gap-3 p-3 rounded-xl border
                      ${msg.isMe ? 'bg-purple-500/20 border-purple-300' : 'bg-white border-gray-100'}
                    `}>
                      <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                        ${msg.isMe ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'}
                      `}>
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{msg.attachment.name}</p>
                        <p className={`text-[11px] ${msg.isMe ? 'text-purple-100' : 'text-gray-500'}`}>{msg.attachment.size} • {msg.attachment.type.toUpperCase()}</p>
                      </div>
                    </div>
                  )}

                  {/* Read receipt / Time */}
                  <div className={`text-[10px] mt-1 hidden group-hover:block absolute ${msg.isMe ? 'right-0 -bottom-5 text-gray-400' : 'left-0 -bottom-5 text-gray-400'}`}>
                    {msg.time}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-50 shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-300 transition-all">
          
          <button className="p-3 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-xl transition-colors shrink-0 group">
            <Paperclip size={20} className="group-hover:scale-110 transition-transform" />
          </button>
          
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1 max-h-32 min-h-[44px] py-3 px-1 bg-transparent border-none outline-none resize-none text-sm text-gray-800 placeholder:text-gray-400"
            rows={1}
          />
          
          <div className="flex items-center gap-1.5 pb-1 pr-1 shrink-0">
            {/* AI Summarize Action */}
            <button className="p-2.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors group relative flex items-center justify-center">
              <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
              <span className="absolute -top-8 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
                AI Summarize
              </span>
            </button>
            
            {/* Send Action */}
            <button 
              className={`
                p-2.5 rounded-xl transition-all flex items-center justify-center
                ${inputText.trim().length > 0 
                  ? 'bg-purple-400 text-white shadow-sm shadow-purple-200 hover:bg-purple-500' 
                  : 'bg-gray-100 text-gray-400'}
              `}
            >
              <Send size={18} className={inputText.trim().length > 0 ? "ml-0.5" : ""} />
            </button>
          </div>
        </div>
        <div className="text-center mt-3">
          <p className="text-[10px] font-medium text-gray-400">
            Press <kbd className="font-sans px-1 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-500">Enter</kbd> to send, <kbd className="font-sans px-1 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-500">Shift</kbd> + <kbd className="font-sans px-1 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-500">Enter</kbd> for a new line
          </p>
        </div>
      </div>
    </div>
  );
}