import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Users, ArrowRight, Sparkles } from 'lucide-react';

const AVATAR_MARCUS = "https://images.unsplash.com/photo-1652471943570-f3590a4e52ed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMG1hbiUyMGJsYWNrfGVufDF8fHx8MTc3NTU4MzUxN3ww&ixlib=rb-4.1.0&q=80&w=1080";
const AVATAR_SARAH = "https://images.unsplash.com/photo-1652471949169-9c587e8898cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHdvbWFuJTIwd2hpdGV8ZW58MXx8fHwxNzc1NTgzNTIwfDA&ixlib=rb-4.1.0&q=80&w=1080";
const AVATAR_ME = "https://images.unsplash.com/photo-1761243892035-c3e13829115a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHdvbWFuJTIwYXNpYW58ZW58MXx8fHwxNzc1NTQ5NjAzfDA&ixlib=rb-4.1.0&q=80&w=1080";

export function CalendarWidget({ className = '' }: { className?: string }) {
  const hours = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM'];

  // 1 hour = 64px height. Start at 9 AM = 0px
  // 9:00 -> 0px, 9:30 -> 32px, etc.
  
  return (
    <div className={`flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Intelligent Schedule
            <span className="flex -space-x-2">
              <img src={AVATAR_SARAH} alt="Sarah" className="w-6 h-6 rounded-full border-2 border-white object-cover" />
              <img src={AVATAR_MARCUS} alt="Marcus" className="w-6 h-6 rounded-full border-2 border-white object-cover" />
              <img src={AVATAR_ME} alt="Elara" className="w-6 h-6 rounded-full border-2 border-white object-cover" />
            </span>
          </h2>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4" />
            Tuesday, April 7, 2026
          </p>
        </div>
        
        <div className="flex gap-1">
          <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-transparent">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-transparent">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Suggested Slot Header */}
      <div className="bg-blue-50/50 px-5 py-3 border-b border-blue-100/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-blue-900">Best time to sync</p>
            <p className="text-xs text-blue-600/80 font-medium">1:00 PM - 2:00 PM (1h)</p>
          </div>
        </div>
        <button className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm shadow-blue-200 transition-colors flex items-center gap-1">
          Schedule <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Grid Area */}
      <div className="flex-1 overflow-y-auto bg-white relative">
        <div className="relative min-w-full">
          {/* Background Grid Lines */}
          <div className="absolute inset-0 pointer-events-none">
            {hours.map((hour, i) => (
              <div key={i} className="flex h-16 border-b border-slate-50/50 w-full">
                <div className="w-16 border-r border-slate-100/50 bg-slate-50/30 flex justify-center pt-2">
                  <span className="text-[11px] font-semibold text-slate-400">{hour}</span>
                </div>
                <div className="flex-1 border-b border-slate-100/30"></div>
              </div>
            ))}
          </div>

          {/* Events Layer */}
          <div className="relative w-full h-[512px]">
            
            {/* Event 1 - 9:30 AM to 11:00 AM (96px height, top 32px) */}
            <div className="absolute left-[76px] right-4 top-[32px] h-[96px] bg-slate-100 border border-slate-200/60 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow group cursor-pointer overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300"></div>
              <p className="text-sm font-bold text-slate-800 tracking-tight">Design Review</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                9:30 AM - 11:00 AM
              </p>
              <div className="flex -space-x-1.5 mt-2">
                <img src={AVATAR_ME} className="w-5 h-5 rounded-full border border-white" />
                <img src={AVATAR_MARCUS} className="w-5 h-5 rounded-full border border-white" />
              </div>
            </div>

            {/* Event 2 - 11:30 AM to 12:30 PM (64px height, top 160px) */}
            <div className="absolute left-[76px] right-4 top-[160px] h-[64px] bg-slate-100 border border-slate-200/60 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow group cursor-pointer overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300"></div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-slate-800 tracking-tight">Marketing Sync</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">11:30 AM - 12:30 PM</p>
                </div>
                <img src={AVATAR_SARAH} className="w-5 h-5 rounded-full border border-white shadow-sm" />
              </div>
            </div>

            {/* AI SUGGESTED FREE SLOT - 1:00 PM to 2:00 PM (64px height, top 256px) */}
            <div className="absolute left-[76px] right-4 top-[256px] h-[64px] bg-white border-2 border-dashed border-blue-300 rounded-xl p-3 flex items-center justify-between group cursor-pointer hover:bg-blue-50/50 transition-colors shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center animate-pulse">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-700 tracking-tight flex items-center gap-2">
                    Available for all
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Free Slot</span>
                  </p>
                  <p className="text-xs text-blue-500 font-medium mt-0.5">1:00 PM - 2:00 PM</p>
                </div>
              </div>
              <div className="flex -space-x-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                <img src={AVATAR_SARAH} className="w-5 h-5 rounded-full border border-white" />
                <img src={AVATAR_MARCUS} className="w-5 h-5 rounded-full border border-white" />
                <img src={AVATAR_ME} className="w-5 h-5 rounded-full border border-white" />
              </div>
            </div>

            {/* Event 3 - 2:30 PM to 4:00 PM (96px height, top 352px) */}
            <div className="absolute left-[76px] right-4 top-[352px] h-[96px] bg-slate-100 border border-slate-200/60 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow group cursor-pointer overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300"></div>
              <p className="text-sm font-bold text-slate-800 tracking-tight">Engineering Standup & Planning</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">2:30 PM - 4:00 PM</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex -space-x-1.5">
                  <img src={AVATAR_MARCUS} className="w-5 h-5 rounded-full border border-white" />
                  <div className="w-5 h-5 rounded-full border border-white bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">+4</div>
                </div>
              </div>
            </div>

            {/* Current Time Indicator - say 10:28 AM, ~93px top */}
            <div className="absolute left-[64px] right-4 top-[93px] flex items-center z-20 pointer-events-none">
              <div className="w-2 h-2 rounded-full bg-blue-600 ml-[-4px]"></div>
              <div className="h-px bg-blue-600 w-full shadow-[0_0_4px_rgba(37,99,235,0.5)]"></div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}