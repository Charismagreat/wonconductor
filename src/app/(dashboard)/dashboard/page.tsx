import React from 'react';
import { getSessionAction } from '@/app/actions/auth';
import { getPinnedChartsAction } from '@/app/actions/ai';
import { redirect } from 'next/navigation';
import { Sparkles, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { GalleryClient } from './GalleryClient';
import PageHeader from '@/components/PageHeader';

export default async function ReportGalleryPage() {
  const user = await getSessionAction();
  if (!user) {
    redirect('/login');
  }

  // [성능 최적화] 이미 조회 완료된 user.id를 전달하여 중복 세션 API 홉(Hop)을 제거하고 즉시 로드합니다.
  const pinnedCharts = await getPinnedChartsAction(user.id);

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="max-w-[1600px] mx-auto px-8 md:px-12 pt-6 pb-12">
        <PageHeader 
          title="My Dashboard"
          description="분석 스튜디오에서 완성하여 핀으로 고정한 핵심 차트 리포트입니다."
          icon={Sparkles}
        />

        {pinnedCharts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[40px] border border-dashed border-slate-200 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
              <ImageIcon size={40} className="text-slate-200" />
            </div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-2">갤러리가 비어 있습니다</h2>
            <p className="text-slate-400 font-medium max-w-sm">Data Chart Studio에서 차트를 분석하고 핀 아이콘을 눌러 이곳에 나만의 리포트를 구성해 보세요.</p>
          </div>
        ) : (
          <GalleryClient initialCharts={pinnedCharts} />
        )}
      </main>
      
      <footer className="max-w-[1600px] mx-auto px-6 py-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
        &copy; 2026 Interactive Report Gallery &bull; Final Insights
      </footer>
    </div>
  );
}
