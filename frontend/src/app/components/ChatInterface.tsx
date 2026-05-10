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
  Download,
  UserPlus,
  Loader2,
  Shield,
  User,
  Trash2,
  Settings2,
  ChevronRight,
  Plus
} from 'lucide-react';
import { connectSocket } from '../utils/socket';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import { toast } from 'sonner';

interface Member {
  username: string;
  fullname?: string;
  workspacerole: 'Leader' | 'Member' | 'Viewer';
}

interface ChatInterfaceProps {
  workspaceId?: string;
  hideHeader?: boolean;
  onDeleteSuccess?: () => void;
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

export function ChatInterface({ workspaceId = "", hideHeader = false, onDeleteSuccess }: ChatInterfaceProps) {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [memberCount, setMemberCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isManageMembersModalOpen, setIsManageMembersModalOpen] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Member');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('Member');
  const [isRemovingMember, setIsRemovingMember] = useState<string | null>(null);
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = localStorage.getItem('uniplatform_username') || '';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberUsername.trim() || !workspaceId) return;

    setIsAddingMember(true);
    try {
      const token = localStorage.getItem('uniplatform_user_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

      const response = await fetch(`${apiUrl}/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newMemberUsername.trim(),
          workspacerole: newMemberRole
        })
      });

      if (response.ok) {
        toast.success('Member added successfully!');
        setNewMemberUsername('');
        setIsAddMemberModalOpen(false);
        // Optional: Refresh member count
        const data = await response.json();
        if (data.member) {
          setMemberCount(data.member.length);
          setAllMembers(data.member);
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to add member');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (username: string) => {
    if (!workspaceId) return;
    setIsRemovingMember(username);
    try {
      const token = localStorage.getItem('uniplatform_user_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

      const response = await fetch(`${apiUrl}/api/workspaces/${workspaceId}/members/${username}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success(`Removed ${username} successfully`);
        setAllMembers(prev => prev.filter(m => m.username !== username));
        setMemberCount(prev => prev - 1);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to remove member');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsRemovingMember(null);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceId) return;
    setIsDeletingWorkspace(true);
    try {
      const token = localStorage.getItem('uniplatform_user_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

      const response = await fetch(`${apiUrl}/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 204) {
        toast.success('Workspace deleted successfully');
        setIsDeleteConfirmModalOpen(false);
        setIsManageMembersModalOpen(false);
        
        // Notify sidebar to refresh if needed
        window.dispatchEvent(new CustomEvent('workspace_deleted'));
        
        if (onDeleteSuccess) {
          onDeleteSuccess();
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to delete workspace');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsDeletingWorkspace(false);
    }
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
          setMemberCount(data.member?.length || 0);
          setAllMembers(data.member || []);

          // Determine current user role
          const me = data.member?.find((m: any) => m.username === currentUser);
          if (me) setCurrentUserRole(me.workspacerole);
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
    // Check isComposing to prevent sending when finishing a Vietnamese character (Telex/VNI)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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
      {!hideHeader && (
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
            {showSearch && (
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="w-32 md:w-64 pl-9 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs md:text-sm focus:ring-2 focus:ring-purple-200 transition-all"
                  autoFocus
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            )}
            <button
              onClick={() => setIsManageMembersModalOpen(true)}
              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
              title="Manage Members"
            >
              <Settings2 size={20} />
            </button>
            <button
              onClick={() => setIsAddMemberModalOpen(true)}
              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
              title="Add Member"
            >
              <UserPlus size={20} />
            </button>
            <button
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) setSearchQuery('');
              }}
              className={`p-2 rounded-xl transition-colors ${showSearch ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              <Search size={20} />
            </button>
            <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className={`flex-1 overflow-y-auto p-3 md:p-4 space-y-4 md:space-y-5 scroll-smooth ${hideHeader ? 'bg-white' : 'bg-gray-50/30'}`}>
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
            <div key={msg.id} className={`flex gap-2 md:gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              {!isMe && (
                <div className="w-6 md:w-8 flex-shrink-0 flex justify-center">
                  {showAvatar ? (
                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[8px] md:text-[10px] font-bold ${msg.senderusername === 'UniBot' ? 'bg-gradient-to-br from-fuchsia-400 to-purple-600 text-white' : initialsColor} shadow-sm`}>
                      {avatar}
                    </div>
                  ) : (
                    <div className="w-6 md:w-8" />
                  )}
                </div>
              )}

              <div className={`flex flex-col max-w-[85%] md:max-w-[80%] min-w-0 ${isMe ? 'items-end' : 'items-start'} overflow-hidden`}>
                {showAvatar && !isMe && (
                  <span className="text-[10px] md:text-[11px] font-semibold text-gray-500 mb-0.5 ml-1">{msg.senderfullname || msg.senderusername}</span>
                )}
                <div
                  className={`
                    px-3 py-2 md:px-4 md:py-2.5 rounded-2xl text-[13px] md:text-[14px] leading-relaxed relative group min-w-0 w-full overflow-hidden
                    ${isMe
                      ? 'bg-purple-500 text-white rounded-tr-sm shadow-sm'
                      : msg.senderusername === 'UniBot'
                        ? 'bg-purple-50 border border-purple-100 text-purple-900 rounded-tl-sm shadow-sm'
                        : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
                    }
                  `}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>


                  {/* Attachment rendering */}
                  {msg.attachment && (
                    <div className={`
                      mt-2 flex items-center gap-2 p-2 rounded-xl border group/attach w-full min-w-0
                      ${isMe ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-100'}
                    `}>
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                        ${isMe ? 'bg-white text-purple-500' : 'bg-white text-gray-400 shadow-sm'}
                      `}>
                        <FileText size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${isMe ? 'text-white' : 'text-gray-700'}`} title={msg.attachment.name}>{msg.attachment.name}</p>
                        <p className={`text-[10px] ${isMe ? 'text-purple-100' : 'text-gray-400'}`}>{msg.attachment.size}</p>
                      </div>
                      {msg.attachment.ggid && (
                        <a
                          href={`https://drive.google.com/uc?id=${msg.attachment.ggid}&export=download`}
                          target="_blank"
                          rel="noreferrer"
                          className={`
                            p-1.5 rounded-lg transition-colors shrink-0
                            ${isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-100 shadow-sm'}
                          `}
                          title="Download File"
                        >
                          <Download size={14} />
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
      <div className="p-2.5 bg-white border-t border-gray-50 shrink-0">
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
              disabled={isUploading || currentUserRole === 'Viewer'}
              className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-xl transition-colors shrink-0 group disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Paperclip size={18} className="group-hover:scale-110 transition-transform" />
            </button>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentUserRole === 'Viewer' ? "You have read-only access to this workspace" : "Type your message here... (use /ai to ask UniBot)"}
              className="flex-1 max-h-32 min-h-[44px] py-3 px-1 bg-transparent border-none outline-none resize-none text-sm text-gray-800 placeholder:text-gray-400 disabled:cursor-not-allowed"
              rows={1}
              disabled={isUploading || currentUserRole === 'Viewer'}
            />

            <div className="flex items-center gap-1.5 pb-1 pr-1 shrink-0">
              {/* AI Summarize Action */}
              <button
                onClick={handleAskAI}
                disabled={currentUserRole === 'Viewer'}
                className="p-2 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors group relative flex items-center justify-center disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                <span className="absolute -top-8 right-0 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  Ask AI / Summarize
                </span>
              </button>

              {/* Send Action */}
              <button
                onClick={handleSendMessage}
                disabled={isUploading || currentUserRole === 'Viewer'}
                className={`
                  p-2 rounded-xl transition-all flex items-center justify-center
                  ${(inputText.trim().length > 0 || selectedFile) && !isUploading && currentUserRole !== 'Viewer'
                    ? 'bg-purple-500 text-white shadow-sm shadow-purple-200 hover:bg-purple-600'
                    : 'bg-gray-100 text-gray-400'}
                  disabled:opacity-50 disabled:cursor-not-allowed
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

      {/* Add Member Modal */}
      <Dialog open={isAddMemberModalOpen} onOpenChange={setIsAddMemberModalOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl border-none shadow-2xl shadow-purple-500/10 bg-white/98 backdrop-blur-xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-2xl font-bold tracking-tight">Add Team Member</DialogTitle>
              <DialogDescription className="text-purple-100/80 mt-1.5 text-sm leading-relaxed">
                Invite a new user to collaborate in your workspace.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleAddMember} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold text-gray-700 ml-1">Username</Label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium transition-colors group-focus-within:text-purple-500">@</span>
                  <Input
                    id="username"
                    placeholder="john_doe"
                    className="h-12 pl-8 pr-4 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium"
                    value={newMemberUsername}
                    onChange={(e) => setNewMemberUsername(e.target.value)}
                    disabled={isAddingMember}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm font-semibold text-gray-700 ml-1">Assign Role</Label>
                <Select
                  value={newMemberRole}
                  onValueChange={setNewMemberRole}
                  disabled={isAddingMember}
                >
                  <SelectTrigger id="role" className="h-14 rounded-2xl bg-gray-50 border-gray-100 focus:bg-white focus:ring-purple-500/20 focus:border-purple-500 transition-all px-4 shadow-sm">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-3xl border-none shadow-2xl shadow-purple-500/20 p-2 min-w-[280px] bg-white/95 backdrop-blur-xl z-[100]">
                    <SelectItem value="Member" className="rounded-2xl focus:bg-purple-50 focus:text-purple-700 py-3 mb-1 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm">
                          <User size={18} />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-sm text-gray-900">Member</span>
                          <span className="text-[11px] text-gray-500 leading-tight">Regular access to chat & meetings</span>
                        </div>
                      </div>
                    </SelectItem>
                    
                    {(currentUserRole === 'Leader' || currentUserRole === 'Admin') && (
                      <SelectItem value="Leader" className="rounded-2xl focus:bg-purple-50 focus:text-purple-700 py-3 mb-1 cursor-pointer transition-colors">
                        <div className="flex items-center gap-3.5">
                          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
                            <Shield size={18} />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="font-bold text-sm text-gray-900">Leader</span>
                            <span className="text-[11px] text-gray-500 leading-tight">Full administrative control</span>
                          </div>
                        </div>
                      </SelectItem>
                    )}

                    <SelectItem value="Viewer" className="rounded-2xl focus:bg-purple-50 focus:text-purple-700 py-3 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shadow-sm">
                          <User size={18} />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-sm text-gray-900">Viewer</span>
                          <span className="text-[11px] text-gray-500 leading-tight">Read-only access only</span>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="flex flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 h-12 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all"
                onClick={() => setIsAddMemberModalOpen(false)}
                disabled={isAddingMember}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-[1.5] h-12 rounded-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5 transition-all active:translate-y-0 disabled:opacity-50 disabled:translate-y-0"
                disabled={isAddingMember || !newMemberUsername.trim()}
              >
                {isAddingMember ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Invite Member'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Members Modal */}
      <Dialog open={isManageMembersModalOpen} onOpenChange={setIsManageMembersModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl border-none shadow-2xl shadow-purple-500/10 bg-white/98 backdrop-blur-xl p-0 overflow-hidden flex flex-col h-[80vh] max-h-[600px]">
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-8 text-white relative shrink-0">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tight">Workspace Members</DialogTitle>
              <DialogDescription className="text-purple-100/80 mt-1.5 text-sm leading-relaxed">
                Manage who has access to this workspace and their permission levels.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar">
            {allMembers.map((member) => (
              <div
                key={member.username}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-100/50 hover:bg-white hover:border-purple-100 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${member.workspacerole === 'Leader' ? 'bg-purple-100 text-purple-700' : 'bg-white text-gray-500 border border-gray-100'
                    }`}>
                    {(member.fullname || member.username).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">
                        {member.fullname || member.username}
                      </span>
                      {member.workspacerole === 'Leader' && (
                        <Shield size={12} className="text-purple-500 shrink-0" />
                      )}
                    </div>
                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${member.workspacerole === 'Leader' ? 'bg-purple-400' : 'bg-gray-300'}`} />
                      {member.workspacerole} {member.fullname ? `(@${member.username})` : ''}
                    </span>
                  </div>
                </div>

                {/* Only show remove button if current user is Leader/Admin and NOT removing themselves */}
                {(currentUserRole === 'Leader' || currentUserRole === 'Admin') && member.username !== currentUser && (
                  <button
                    onClick={() => handleRemoveMember(member.username)}
                    disabled={isRemovingMember === member.username}
                    className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                    title="Remove Member"
                  >
                    {isRemovingMember === member.username ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                )}

                {member.username === currentUser && (
                  <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-1 rounded-lg shrink-0">YOU</span>
                )}
              </div>
            ))}
          </div>

          <div className="p-6 bg-gray-50/50 border-t border-gray-100 shrink-0 flex flex-col gap-3">
            <Button
              onClick={() => {
                setIsManageMembersModalOpen(false);
                setIsAddMemberModalOpen(true);
              }}
              className="w-full h-11 rounded-2xl font-semibold bg-white text-purple-600 border border-purple-100 hover:bg-purple-50 shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Invite Someone New
            </Button>

            {(currentUserRole === 'Leader' || currentUserRole === 'Admin') && (
              <Button
                variant="ghost"
                onClick={() => setIsDeleteConfirmModalOpen(true)}
                className="w-full h-11 rounded-2xl font-semibold text-red-500 hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Delete Workspace
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteConfirmModalOpen} onOpenChange={setIsDeleteConfirmModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-none shadow-2xl bg-white p-0 overflow-hidden">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Workspace?</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              This action cannot be undone. All messages, files, and data associated with <strong>{workspaceName}</strong> will be permanently deleted.
            </p>
          </div>
          <DialogFooter className="p-6 pt-0 flex flex-row gap-3">
            <Button
              variant="ghost"
              className="flex-1 h-12 rounded-2xl font-bold text-gray-500 hover:bg-gray-100"
              onClick={() => setIsDeleteConfirmModalOpen(false)}
              disabled={isDeletingWorkspace}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-12 rounded-2xl font-bold bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200"
              onClick={handleDeleteWorkspace}
              disabled={isDeletingWorkspace}
            >
              {isDeletingWorkspace ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}