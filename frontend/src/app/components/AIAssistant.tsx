import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send,
  Mic,
  FileText,
  Calendar,
  MoreVertical,
  Search,
  Loader2
} from 'lucide-react';

const promptSuggestions = [
  "Summarize last meeting",
  "What is my schedule tomorrow?",
  "Extract key points from PRd.pdf"
];

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

// Bỏ qua lỗi TypeScript với Vite env (nếu có)
const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5001';

export function AIAssistant() {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    // Lưu tin nhắn User vào State UI
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('uniplatform_user_token');
      
      const res = await fetch(`http://localhost:5001/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        // Đẩy toàn bộ `messages` (lịch sử) lên làm context cho Ollama
        body: JSON.stringify({ 
          prompt: userMsg.text,
          context: messages.map(m => ({ senderusername: m.sender, content: m.text }))
        })
      });

      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: data.text }]);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: "Ollama server không phản hồi!" }]);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="flex flex-col h-full bg-white relative max-w-5xl mx-auto w-full border-x border-gray-50/50 shadow-sm shadow-gray-100/50">
      {/* Header */}
      <div className="h-[73px] px-6 border-b border-gray-100 flex items-center justify-between bg-white/95 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500">
            <Bot size={20} className="fill-purple-500/10" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">AI Assistant</h2>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
              <Sparkles size={12} className="text-purple-400" />
              <span>Powered by UniPlatform AI</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
            <Search size={20} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        <div className="w-full max-w-3xl space-y-8 mt-4 pb-20">
          
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-10 text-sm">
              Hãy bắt đầu cuộc trò chuyện với UniPlatform AI
            </div>
          )}

          {/* Render tin nhắn */}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} gap-3 w-full`}>
              {msg.sender === 'ai' && (
                <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-purple-500 shrink-0 shadow-sm">
                  <Sparkles size={20} className="fill-purple-100" />
                </div>
              )}
              
              <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
                {msg.sender === 'ai' && <span className="text-[12px] font-semibold text-gray-500 mb-1.5 ml-1">UniPlatform AI</span>}
                
                <div className={`px-5 py-4 rounded-3xl shadow-sm text-[15px] leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-purple-400 text-white rounded-tr-sm shadow-purple-200' 
                    : 'bg-gray-50/80 border border-gray-100 text-gray-800 rounded-tl-sm'
                }`}>
                  {/* Dùng whitespace-pre-wrap để hiển thị đúng dấu xuống dòng của AI */}
                  <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </div>
              </div>
            </div>
          ))}

          {/* Haptic Loading cho AI */}
          {isLoading && (
            <div className="flex gap-4 w-full">
              <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-purple-500 shrink-0 shadow-sm">
                <Loader2 size={20} className="animate-spin" />
              </div>
              <div className="flex flex-col items-start justify-center">
                 <span className="text-[12px] font-semibold text-gray-500 mb-1.5 ml-1">UniPlatform AI đang suy nghĩ...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white shrink-0 bg-gradient-to-t from-white via-white to-transparent shadow-[0_-10px_40px_rgba(255,255,255,1)] z-10">
        <div className="max-w-3xl mx-auto flex flex-col">
          
          {/* Prompt Suggestions */}
          <div className="flex flex-wrap gap-2 mb-3">
            {promptSuggestions.map((suggestion, idx) => (
              <button 
                key={idx}
                disabled={isLoading}
                className="text-xs font-medium text-purple-600 bg-purple-50/50 border border-purple-200 px-3 py-1.5 rounded-full hover:bg-purple-50 hover:border-purple-300 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                onClick={() => handleSendMessage(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Floating Input Box */}
          <div className="flex items-end gap-2 bg-white p-2 rounded-3xl border border-gray-200 shadow-sm shadow-gray-100 focus-within:ring-4 focus-within:ring-purple-50 focus-within:border-purple-300 transition-all">
            <button className="p-3 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-full transition-colors shrink-0 group mb-0.5">
              <Mic size={22} className="group-hover:scale-110 transition-transform" />
            </button>
            
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask the AI Assistant..."
              className="flex-1 max-h-40 min-h-[52px] py-3.5 px-2 bg-transparent border-none outline-none resize-none text-[15px] text-gray-800 placeholder:text-gray-400"
              rows={1}
            />
            
            <div className="flex items-center gap-2 pb-1 pr-1 shrink-0 mb-0.5">
              <button 
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputText.trim()}
                className={`
                  p-3 rounded-full transition-all flex items-center justify-center
                  ${inputText.trim().length > 0 && !isLoading
                    ? 'bg-purple-400 text-white shadow-md shadow-purple-200 hover:bg-purple-500 hover:-translate-y-0.5' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                `}
              >
                <Send size={18} className={inputText.trim().length > 0 && !isLoading ? "ml-0.5" : ""} />
              </button>
            </div>
          </div>
          
          <div className="text-center mt-3">
            <p className="text-[11px] font-medium text-gray-400">
              AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}