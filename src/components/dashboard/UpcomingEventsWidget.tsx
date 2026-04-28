'use client';

import React from 'react';
import { 
  Calendar, 
  ChevronRight, 
  Bell, 
  CheckCircle2, 
  PartyPopper, 
  PlaneTakeoff,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarEvent, CalendarEventType } from '@/lib/services/calendar-service';

interface UpcomingEventsWidgetProps {
  events: CalendarEvent[];
  hideLink?: boolean;
}

const TYPE_CONFIG: Record<CalendarEventType, { icon: any, color: string, bg: string, label: string }> = {
  TASK: { icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', label: '업무 마감' },
  NOTICE: { icon: Bell, color: 'text-red-600', bg: 'bg-red-50', label: '전사 공지' },
  EVENT: { icon: PartyPopper, color: 'text-yellow-600', bg: 'bg-yellow-50', label: '회사 행사' },
  VACATION: { icon: PlaneTakeoff, color: 'text-green-600', bg: 'bg-green-50', label: '휴가/부재' },
};

export default function UpcomingEventsWidget({ events, hideLink = false }: UpcomingEventsWidgetProps) {
  // Filter for next 7 days and sort
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const upcoming = events
    .filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= today && eventDate <= nextWeek;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-blue-600" />
          <h2 className="text-lg font-bold text-gray-800 tracking-tight uppercase">Upcoming Schedule</h2>
        </div>
        {!hideLink && (
          <Link 
            href="/dashboard/calendar" 
            className="text-xs font-black text-blue-600 hover:text-slate-900 transition-all flex items-center gap-1 uppercase tracking-widest group"
          >
            View Full Calendar
            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {upcoming.length > 0 ? (
          upcoming.map((event, idx) => {
            const config = TYPE_CONFIG[event.type];
            const Icon = config.icon;
            const eventDate = new Date(event.date);
            const isToday = eventDate.toDateString() === today.toDateString();

            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={event.id}
                className="bg-white border border-slate-100 p-5 rounded-[28px] shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all group relative overflow-hidden flex flex-col justify-between"
              >
                {isToday && (
                  <div className="absolute top-0 right-0 p-1.5 px-3 bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl shadow-lg z-10">
                    Today
                  </div>
                )}
                
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${config.bg} ${config.color}`}>
                      <Icon size={20} />
                    </div>
                    {event.reportId && (
                       <Link 
                        href={`/report/${event.reportId}`}
                        className="p-2 text-slate-300 hover:text-blue-600 transition-colors"
                        title="해당 테이블로 이동"
                       >
                         <ExternalLink size={14} />
                       </Link>
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-blue-600 transition-colors">
                      {event.title}
                    </h4>
                  </div>

                  <div className="pt-3 border-t border-slate-50 flex items-center justify-between mt-auto">
                    <span className="text-[10px] font-bold text-slate-400">
                      {eventDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                    </span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                      {event.status || 'Planned'}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full py-12 bg-slate-50/50 border border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center text-slate-400">
            <AlertCircle size={32} strokeWidth={1.5} className="mb-2 opacity-30" />
            <p className="text-[11px] font-black uppercase tracking-widest opacity-60">No upcoming events for the next 7 days</p>
          </div>
        )}
      </div>
    </section>
  );
}
