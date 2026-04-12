import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send,
  Mic,
  FileText,
  Calendar,
  MoreVertical,
  Search
} from 'lucide-react';

const promptSuggestions = [
  "Summarize last meeting",
  "What is my schedule tomorrow?",
  "Extract key points from PRd.pdf"
];

export function AIAssistant() {
  const [inputText, setInputText] = useState('');

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
          
          {/* Timestamp */}
          <div className="text-center text-xs text-gray-400 font-medium flex items-center justify-center gap-4">
            <div className="h-px bg-gray-100 flex-1 max-w-[100px]" />
            Today, 11:42 AM
            <div className="h-px bg-gray-100 flex-1 max-w-[100px]" />
          </div>

          {/* User Message */}
          <div className="flex justify-end gap-3 w-full">
            <div className="flex flex-col items-end max-w-[80%]">
              <div className="px-5 py-3.5 bg-purple-400 text-white rounded-3xl rounded-tr-sm shadow-sm shadow-purple-200 text-[15px] leading-relaxed">
                <p>Can you summarize the key decisions from the Marketing Team's sync this morning and tell me if it affects my schedule?</p>
              </div>
            </div>
          </div>

          {/* AI Response */}
          <div className="flex gap-4 w-full">
            <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-purple-500 shrink-0 shadow-sm">
              <Sparkles size={20} className="fill-purple-100" />
            </div>
            
            <div className="flex flex-col items-start max-w-[85%]">
              <span className="text-[12px] font-semibold text-gray-500 mb-1.5 ml-1">UniPlatform AI</span>
              
              <div className="px-5 py-4 bg-gray-50/80 border border-gray-100 text-gray-800 rounded-3xl rounded-tl-sm shadow-sm text-[15px] leading-relaxed">
                <p className="mb-4">
                  Here are the key decisions from the Marketing Team sync:
                </p>
                <ul className="list-disc list-inside space-y-1 mb-5 text-gray-700">
                  <li>The Q3 Campaign launch date has been moved up to Oct 28.</li>
                  <li>Social media assets need to be finalized by Friday.</li>
                  <li>The budget for paid ads was approved for an extra $5k.</li>
                </ul>
                <p className="mb-4">
                  Regarding your schedule: Yes, this affects you. A new urgent review session has been scheduled for tomorrow at 2:00 PM, which conflicts with your <strong>Software Eng Sync</strong>.
                </p>

                {/* Citations (RAG UI) */}
                <div className="pt-4 border-t border-gray-200/60 mt-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Sources Referenced</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="flex items-center gap-1.5 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm">
                      <FileText size={12} className="text-purple-400" />
                      Marketing Meeting Minutes
                    </button>
                    <button className="flex items-center gap-1.5 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:border-purple-300 hover:text-purple-600 transition-colors shadow-sm">
                      <Calendar size={12} className="text-purple-400" />
                      Group Schedule
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
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
                className="text-xs font-medium text-purple-600 bg-purple-50/50 border border-purple-200 px-3 py-1.5 rounded-full hover:bg-purple-50 hover:border-purple-300 transition-all cursor-pointer shadow-sm"
                onClick={() => setInputText(suggestion)}
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
              placeholder="Ask the AI Assistant..."
              className="flex-1 max-h-40 min-h-[52px] py-3.5 px-2 bg-transparent border-none outline-none resize-none text-[15px] text-gray-800 placeholder:text-gray-400"
              rows={1}
            />
            
            <div className="flex items-center gap-2 pb-1 pr-1 shrink-0 mb-0.5">
              <button 
                className={`
                  p-3 rounded-full transition-all flex items-center justify-center
                  ${inputText.trim().length > 0 
                    ? 'bg-purple-400 text-white shadow-md shadow-purple-200 hover:bg-purple-500 hover:-translate-y-0.5' 
                    : 'bg-gray-100 text-gray-400'}
                `}
              >
                <Send size={18} className={inputText.trim().length > 0 ? "ml-0.5" : ""} />
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
