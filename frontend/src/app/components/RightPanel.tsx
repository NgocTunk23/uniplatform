import React from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  FileText, 
  Sparkles,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';

const scheduleData = [
  { time: '09:00 AM', status: 'busy', names: ['SJ', 'AC'] },
  { time: '10:00 AM', status: 'busy', names: ['JS', 'SJ'] },
  { time: '11:00 AM', status: 'free', names: ['JS', 'SJ', 'AC', 'MR'], best: true },
  { time: '12:00 PM', status: 'busy', names: ['MR'] },
  { time: '01:00 PM', status: 'free', names: ['JS', 'AC'], partial: true },
];

export function RightPanel() {
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-100 p-6 overflow-y-auto w-full">
      {/* Intelligent Schedule Widget */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon size={16} className="text-purple-400" />
            Intelligent Schedule
          </h3>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            <MoreHorizontal size={16} />
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-50">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Today, Oct 24</span>
              <span className="text-sm font-medium text-gray-800 mt-0.5">Finding free slot...</span>
            </div>
            <div className="flex -space-x-1">
              <div className="w-6 h-6 rounded-full border border-white bg-gray-100 text-gray-700 flex items-center justify-center text-[8px] font-bold z-30 shadow-sm">AC</div>
              <div className="w-6 h-6 rounded-full border border-white bg-gray-200 text-gray-800 flex items-center justify-center text-[8px] font-bold z-20 shadow-sm">SJ</div>
              <div className="w-6 h-6 rounded-full border border-white bg-purple-200 text-purple-700 flex items-center justify-center text-[8px] font-bold z-10 shadow-sm">JS</div>
              <div className="w-6 h-6 rounded-full border border-white bg-gray-300 text-gray-900 flex items-center justify-center text-[8px] font-bold z-0 shadow-sm">MR</div>
            </div>
          </div>

          <div className="space-y-3">
            {scheduleData.map((slot, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-[11px] font-medium text-gray-400 w-12 pt-1.5 shrink-0 text-right">
                  {slot.time}
                </span>
                
                <div className={`
                  flex-1 rounded-xl p-2.5 border transition-all relative overflow-hidden group cursor-pointer
                  ${slot.best 
                    ? 'bg-purple-50 border-purple-200 shadow-sm shadow-purple-100' 
                    : slot.status === 'free' 
                      ? 'bg-white border-gray-100 hover:border-purple-200 hover:shadow-sm' 
                      : 'bg-gray-50 border-transparent opacity-60'
                  }
                `}>
                  {slot.best && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-400" />
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${slot.best ? 'text-purple-700' : 'text-gray-700'}`}>
                      {slot.best ? 'Perfect Match' : slot.status === 'free' ? 'Available' : 'Busy'}
                    </span>
                    <div className="flex gap-1">
                      {slot.names.map((name, idx) => (
                        <div key={idx} className="w-4 h-4 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[8px] text-gray-500 font-bold shadow-sm">
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <button className="w-full mt-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm">
            Propose Meeting Time
          </button>
        </div>
      </div>

      {/* AI Meeting Minutes Preview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            Latest Minutes
          </h3>
          <button className="text-[11px] font-semibold text-purple-500 hover:text-purple-600 flex items-center">
            View all <ChevronRight size={14} />
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 group cursor-pointer hover:border-purple-200 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">
              <FileText size={16} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Weekly Sync: UI Refinements</h4>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5 font-medium">
                <Clock size={12} /> Today, 09:30 AM
              </div>
            </div>
          </div>
          
          <div className="space-y-2 mb-3">
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Key Decisions</span>
              <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                <li>Adopt Pastel Purple as accent</li>
                <li>Remove voice/video call icons</li>
                <li>Implement left sidebar layout</li>
              </ul>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-3 border-t border-gray-50">
            <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
              <Users size={12} /> 4 Attendees
            </div>
            <button className="text-xs font-semibold text-purple-500 bg-purple-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
              Open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
