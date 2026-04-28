import React from 'react';
import PageHeader from '@/components/PageHeader';
import { Calendar } from 'lucide-react';
import { getCalendarEvents } from '@/lib/services/calendar-service';
import FullCalendarView from '@/components/calendar/FullCalendarView';
import UpcomingEventsWidget from '@/components/dashboard/UpcomingEventsWidget';

/**
 * 🗓️ System Calendar Page (Dashboard/Admin)
 */
export default async function CalendarPage() {
  // 1. Fetch data from service (Admin role sees everything)
  const events = await getCalendarEvents({
    userRole: 'ADMIN'
  });

  return (
    <div className="px-8 md:px-12 pt-6 pb-12">
      <PageHeader 
        title="SYSTEM CALENDAR"
        description="전사 공지사항, 프로젝트 마감 기한 및 사원들의 주요 일정을 한눈에 관리하세요."
        icon={Calendar}
      />

      <main className="max-w-[1600px] mx-auto mt-12 space-y-12">
        <UpcomingEventsWidget events={events} hideLink={true} />
        
        <FullCalendarView 
          events={events} 
          isAdmin={true} 
        />
        
        {/* Premium Legend / Key */}
        <section className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-2xl shadow-slate-900/5">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Calendar Legend</h2>
          </div>
          
          <div className="flex flex-wrap gap-10">
            <div className="flex items-center gap-4 group">
            <div className="w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/20 group-hover:scale-125 transition-transform" />
            <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900 uppercase tracking-widest">업무 마감</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">TASK Deadline</span>
            </div>
            </div>
            <div className="flex items-center gap-4 group">
            <div className="w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-500/20 group-hover:scale-125 transition-transform" />
            <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900 uppercase tracking-widest">전사 공지</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">NOTICE / Announcement</span>
            </div>
            </div>
            <div className="flex items-center gap-4 group">
            <div className="w-4 h-4 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/20 group-hover:scale-125 transition-transform" />
            <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900 uppercase tracking-widest">회사 행사</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">EVENT / Meetup</span>
            </div>
            </div>
            <div className="flex items-center gap-4 group">
            <div className="w-4 h-4 rounded-full bg-green-500 shadow-lg shadow-green-500/20 group-hover:scale-125 transition-transform" />
            <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900 uppercase tracking-widest">휴가/부재</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">VACATION / Absence</span>
            </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
