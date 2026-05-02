import React, { useState, useEffect, useRef } from 'react';
import { 
  Paperclip, 
  Sparkles, 
  Send,
  MoreVertical,
  Search,
  MessageSquare,
  Users,
  FileText,
  X,
  Download
} from 'lucide-react';
import { connectSocket } from '../utils/socket';
import { format } from 'date-fns';

interface ChatInterfaceProps {
  workspaceId?: string;
}

interface Message {
  id: string;
  senderusername: string;
  senderfullname?: string;
  content: string;
  createdAt: string;
  attachment?: {
    type: string;
    name: string;
    size: string;
    ggid?: string;
  };
}

export function ChatInterface({ workspaceId = ""}: ChatInterfaceProps) {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [memberCount, setMemberCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const currentUser = localStorage.getItem('uniplatform_username') || '';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!workspaceId) return;

    const token = localStorage.getItem('uniplatform_user_token');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

    // 1. Fetch Workspace Details
    const fetchWorkspace = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/workspaces/${workspaceId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setWorkspaceName(data.name);
          setMemberCount(data.members?.length || 0);
        }
      } catch (err) {
        console.error("Failed to fetch workspace", err);
      }
    };

    // 2. Fetch Chat History
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/messages/${workspaceId}?limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          // Backend returns the array directly
          const rawHistory = Array.isArray(data) ? data : (data.messages || []);
          const history = rawHistory.map((msg: any) => ({
            id: msg.id || msg._id || Math.random().toString(),
            senderusername: msg.senderusername,
            senderfullname: msg.senderfullname,
            content: msg.content,
            createdAt: msg.createdAt || new Date().toISOString(),
            attachment: msg.files && msg.files.length > 0 ? {
              type: msg.files[0].typefile?.split('/')[1] || 'file',
              name: msg.files[0].filename,
              size: msg.files[0].sizefile ? `${(parseInt(msg.files[0].sizefile) / 1024).toFixed(1)} KB` : '',
              ggid: msg.files[0].ggid,
            } : undefined,
          }));
          setMessages(history.reverse());
        }
      } catch (err) {
        console.error("Failed to fetch messages", err);
      }
    };

    fetchWorkspace();
    fetchHistory();

    // 3. Socket.io Integration
    const socket = connectSocket();
    
    socket.emit('join_workspace', workspaceId);

    const handleReceiveMessage = (msg: any) => {
      // Backend returns either standard format or with senderusername
      const newMsg: Message = {
        id: msg.id || msg._id || Math.random().toString(),
        senderusername: msg.senderusername,
        senderfullname: msg.senderfullname,
        content: msg.content,
        createdAt: msg.createdAt || new Date().toISOString(),
        attachment: msg.files && msg.files.length > 0 ? {
          type: msg.files[0].typefile?.split('/')[1] || 'file',
          name: msg.files[0].filename,
          size: msg.files[0].sizefile ? `${(parseInt(msg.files[0].sizefile) / 1024).toFixed(1)} KB` : '',
          ggid: msg.files[0].ggid,
        } : undefined,
      };
      setMessages(prev => {
        // Check if message already exists (prevent duplicate but allow updates for confirmed messages)
        const existingIdx = prev.findIndex(m => m.id === newMsg.id || (m.content === newMsg.content && m.senderusername === newMsg.senderusername && Math.abs(new Date(m.createdAt).getTime() - new Date(newMsg.createdAt).getTime()) < 2000));
        
        if (existingIdx !== -1) {
            // Update existing message (useful for adding attachments from confirmed broadcast)
            const updated = [...prev];
            updated[existingIdx] = { 
                ...updated[existingIdx], 
                ...newMsg, 
                id: newMsg.id // Ensure we use the real DB ID
            };
            return updated;
        }
        return [...prev, newMsg];
      });
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('receive_message_confirmed', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('receive_message_confirmed', handleReceiveMessage);
    };
  }, [workspaceId]);

  const handleAskAI = () => {
    if (!workspaceId) return;
    const socket = connectSocket();
    
    // Nếu có input text, dùng nó làm prompt. Nếu không, tóm tắt chung.
    const prompt = inputText.trim() || "Tóm tắt các nội dung quan trọng đã trao đổi trong nhóm này.";
    
    socket.emit('ask_ai', {
      workspaceId,
      prompt,
      senderusername: currentUser
    });
    
    setInputText('');
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedFile) || !workspaceId || isUploading) return;
    setIsUploading(true);

    try {
        let fileIds: string[] = [];
        const token = localStorage.getItem('uniplatform_user_token');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

        if (selectedFile) {
            const formData = new FormData();
            formData.append('file', selectedFile);
            
            const res = await fetch(`${apiUrl}/api/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                fileIds.push(data.file.id || data.file.fileid || data.file._id);
            } else {
                console.error("File upload failed");
                setIsUploading(false);
                return; // Stop if upload fails
            }
        }

        if (inputText.startsWith('/ai ')) {
           const socket = connectSocket();
           socket.emit('ask_ai', {
             workspaceId,
             prompt: inputText.substring(4).trim(),
             senderusername: currentUser
           });
        } else {
           const socket = connectSocket();
           socket.emit('send_message', {
             workspaceId,
             content: inputText.trim(),
             fileIds: fileIds.length > 0 ? fileIds : undefined
           });
        }

        setInputText('');
        setSelectedFile(null);
    } catch (err) {
        console.error("Send message error", err);
    } finally {
        setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
        Select a workspace from the sidebar to start chatting.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Chat Header */}
      <div className="h-[73px] px-6 border-b border-gray-100 flex items-center justify-between bg-white/95 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500">
            <MessageSquare size={20} className="fill-purple-500/20" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{workspaceName}</h2>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
              <Users size={12} className="text-gray-400" />
              <span>{memberCount} Members</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isSearchOpen ? (
            <div className="flex items-center bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200">
              <Search size={16} className="text-gray-400" />
              <input 
                type="text" 
                autoFocus
                placeholder="Search messages..."
                className="bg-transparent border-none outline-none text-sm px-2 w-48"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <Search size={20} />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                <MoreVertical size={20} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
        {(searchQuery.trim() 
          ? messages.filter(msg => 
              msg.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
              (msg.senderfullname && msg.senderfullname.toLowerCase().includes(searchQuery.toLowerCase())) ||
              (msg.attachment && msg.attachment.name.toLowerCase().includes(searchQuery.toLowerCase()))
            )
          : messages
        ).map((msg, idx, arr) => {
          const isMe = msg.senderusername === currentUser;
          const showAvatar = idx === 0 || arr[idx - 1].senderusername !== msg.senderusername;
          const initialsColor = isMe ? 'bg-purple-200 text-purple-700' : 'bg-gray-100 text-gray-700';
          const avatar = msg.senderusername ? msg.senderusername.substring(0, 2).toUpperCase() : 'AI';
          
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isMe && (
                <div className="w-8 flex-shrink-0 flex justify-center">
                  {showAvatar ? (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${msg.senderusername === 'UniBot' ? 'bg-gradient-to-br from-fuchsia-400 to-purple-600 text-white' : initialsColor} shadow-sm`}>
                      {avatar}
                    </div>
                  ) : (
                    <div className="w-8" />
                  )}
                </div>
              )}
              
              <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                {showAvatar && !isMe && (
                  <span className="text-[11px] font-semibold text-gray-500 mb-1 ml-1">{msg.senderfullname || msg.senderusername}</span>
                )}
                <div 
                  className={`
                    px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed relative group
                    ${isMe 
                      ? 'bg-purple-400 text-white rounded-tr-sm shadow-sm shadow-purple-200' 
                      : msg.senderusername === 'UniBot'
                        ? 'bg-purple-50 border border-purple-100 text-purple-900 rounded-tl-sm shadow-sm'
                        : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
                    }
                  `}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Attachment rendering */}
                  {msg.attachment && (
                    <div className={`
                      mt-3 flex items-center gap-3 p-3 rounded-xl border group/attach
                      ${isMe ? 'bg-purple-500/20 border-purple-300' : 'bg-white border-gray-100'}
                    `}>
                      <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                        ${isMe ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'}
                      `}>
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold truncate">{msg.attachment.name}</p>
                        <p className={`text-[11px] ${isMe ? 'text-purple-100' : 'text-gray-500'}`}>{msg.attachment.size} • {msg.attachment.type.toUpperCase()}</p>
                      </div>
                      {msg.attachment.ggid && (
                        <a 
                          href={`https://drive.google.com/uc?id=${msg.attachment.ggid}&export=download`} 
                          target="_blank" 
                          rel="noreferrer"
                          className={`
                            p-2 rounded-lg transition-colors shrink-0
                            ${isMe ? 'bg-purple-400 hover:bg-purple-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}
                          `}
                          title="Download File"
                        >
                          <Download size={16} />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Read receipt / Time */}
                  <div className={`text-[10px] mt-1 hidden group-hover:block absolute ${isMe ? 'right-0 -bottom-5 text-gray-400' : 'left-0 -bottom-5 text-gray-400'}`}>
                    {msg.createdAt ? format(new Date(msg.createdAt), 'hh:mm a') : ''}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-50 shrink-0">
        <div className="flex flex-col bg-gray-50 p-1.5 rounded-2xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-300 transition-all">
          
          {selectedFile && (
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl mb-2 mx-1 border border-gray-100 shadow-sm">
                <FileText size={16} className="text-purple-500" />
                <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{selectedFile.name}</span>
                <span className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                <button onClick={() => setSelectedFile(null)} className="ml-auto text-gray-400 hover:text-red-500">
                    <X size={16} />
                </button>
            </div>
          )}

          <div className="flex items-end gap-2 w-full">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-xl transition-colors shrink-0 group"
            >
              <Paperclip size={20} className="group-hover:scale-110 transition-transform" />
            </button>
            
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here... (use /ai to ask UniBot)"
              className="flex-1 max-h-32 min-h-[44px] py-3 px-1 bg-transparent border-none outline-none resize-none text-sm text-gray-800 placeholder:text-gray-400"
              rows={1}
              disabled={isUploading}
            />
            
            <div className="flex items-center gap-1.5 pb-1 pr-1 shrink-0">
              {/* AI Summarize Action */}
              <button 
                onClick={handleAskAI}
                className="p-2.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors group relative flex items-center justify-center"
              >
                <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                <span className="absolute -top-8 right-0 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  Ask AI / Summarize
                </span>
              </button>
              
              {/* Send Action */}
              <button 
                onClick={handleSendMessage}
                disabled={isUploading}
                className={`
                  p-2.5 rounded-xl transition-all flex items-center justify-center
                  ${(inputText.trim().length > 0 || selectedFile) && !isUploading
                    ? 'bg-purple-400 text-white shadow-sm shadow-purple-200 hover:bg-purple-500' 
                    : 'bg-gray-100 text-gray-400'}
                `}
              >
                {isUploading ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <Send size={18} className={(inputText.trim().length > 0 || selectedFile) ? "ml-0.5" : ""} />}
              </button>
            </div>
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