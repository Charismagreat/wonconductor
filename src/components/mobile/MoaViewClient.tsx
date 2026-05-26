'use client';

import React, { useEffect } from 'react';
import { SmartChart } from '@/components/SmartChart';
import { Sparkles, Phone, AlertCircle } from 'lucide-react';

interface MoaViewClientProps {
  charts: any[];
}

export function MoaViewClient({ charts }: MoaViewClientProps) {
  // [모바일 뷰포트 강제 동적 Override 및 복원 라이프사이클]
  useEffect(() => {
    // 1. 헤드에서 기존 viewport 메타 태그를 탐색합니다.
    const meta = document.querySelector('meta[name="viewport"]');
    const originalContent = meta ? meta.getAttribute('content') : null;

    // 2. 모바일 반응형에 완벽히 피벗되도록 width=device-width 뷰포트로 강제 설정합니다.
    if (meta) {
      meta.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0'
      );
    } else {
      const newMeta = document.createElement('meta');
      newMeta.name = 'viewport';
      newMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0';
      document.getElementsByTagName('head')[0].appendChild(newMeta);
    }

    // 3. 페이지 이탈(언마운트) 시 기존의 데스크톱 강제 고정(width=1280) 규격으로 안전하게 복구합니다.
    return () => {
      const currentMeta = document.querySelector('meta[name="viewport"]');
      if (currentMeta) {
        if (originalContent) {
          currentMeta.setAttribute('content', originalContent);
        } else {
          // 원래 값이 없었다면 기본 데스크톱 규격으로 원복합니다.
          currentMeta.setAttribute('content', 'width=1280');
        }
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased flex flex-col font-sans pb-16">
      {/* 차트 리스트 메인 영역 (페이지 대형 헤더를 소거하여 모바일 최상단 밀착 정렬) */}
      <main className="flex-1 px-1 py-3 flex flex-col gap-4">
        {charts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white rounded-[32px] border border-dashed border-slate-200 text-center py-24 my-auto">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertCircle size={28} className="text-slate-300" />
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">선택된 위젯이 없습니다</h3>
            <p className="text-[10px] text-slate-400 font-semibold max-w-[220px] leading-relaxed">
              모아보기 보관함 생성 시 차트 위젯이 선택되지 않았거나 파라미터가 누락되었습니다.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 w-full">
            {charts.map((c) => (
              <div 
                key={c.id} 
                className="w-full bg-white rounded-[32px] overflow-hidden border border-slate-100/80 shadow-md shadow-slate-900/[0.02]"
              >
                {/* 모바일 화면에서는 width 제한 없이 100%로 강제 통일하여 1열 피드로 웅장하게 그립니다. */}
                <SmartChart 
                  config={c.config}
                  isPinned={true}
                  chartId={c.id}
                  layout={{ span: 'full' }} // 모바일에서는 무조건 full-width로 강제 고정
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 모바일 전용 꼬리말 */}
      <footer className="text-center text-slate-300 text-[8px] font-black uppercase tracking-[0.2em] pt-6 pb-2">
        &copy; 2026 Mobile Closet &bull; Optimized Viewport
      </footer>
    </div>
  );
}
