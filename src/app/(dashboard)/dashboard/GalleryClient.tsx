'use client';

import React, { useState, useEffect } from 'react';
import { SmartChart } from '@/components/SmartChart';
import { deletePinnedChartAction, refreshIndividualChartAction, updateChartLayoutAction, reorderPinnedChartsAction, savePinnedChartAction } from '@/app/actions/ai';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FolderHeart, Share2, Trash2, Clipboard, Plus } from 'lucide-react'; // 보관함 UI에 사용할 고해상도 아이콘 추가

interface GalleryClientProps {
  initialCharts: any[];
}

export function GalleryClient({ initialCharts }: GalleryClientProps) {
  const router = useRouter();
  const [charts, setCharts] = useState(initialCharts);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // [신규 피처] 모바일 모아보기 제어를 위한 상태 변수 선언
  const [isMoaMode, setIsMoaMode] = useState(false);
  const [selectedMoaIds, setSelectedMoaIds] = useState<string[]>([]);
  const [savedMoaLinks, setSavedMoaLinks] = useState<any[]>([]);

  // 마운트 시 로컬스토리지 보관함 데이터를 영구 적재합니다.
  useEffect(() => {
    const saved = localStorage.getItem('moaview-saved-links');
    if (saved) {
      try {
        setSavedMoaLinks(JSON.parse(saved));
      } catch (e) {
        console.error('[보관함 로드 오류]:', e);
      }
    }
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('이 차트를 갤러리에서 삭제하시겠습니까?')) return;
    const res = await deletePinnedChartAction(id);
    if (res.success) {
      setCharts(charts.filter(c => c.id !== id));
      router.refresh();
    }
  };

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      const res = await refreshIndividualChartAction(id);
      if (res.success && res.item) {
        setCharts(charts.map(c => c.id === id ? res.item : c));
      }
    } catch (e) {
      console.error('Refresh failed:', e);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleGenerateMoaLink = () => {
    if (selectedMoaIds.length === 0) return;
    const alias = prompt('생성할 모바일 모아보기 링크의 이름(별칭)을 입력해 주세요:', '나만의 모바일 대시보드');
    if (!alias) return;

    const origin = window.location.origin;
    const moaUrl = `${origin}/share/moaview?charts=${selectedMoaIds.join(',')}`;

    const newLink = {
      id: `moa_${new Date().getTime()}`,
      name: alias,
      url: moaUrl,
      createdAt: new Date().toISOString()
    };

    const updated = [newLink, ...savedMoaLinks];
    setSavedMoaLinks(updated);
    localStorage.setItem('moaview-saved-links', JSON.stringify(updated));

    navigator.clipboard.writeText(moaUrl);
    alert(`"${alias}" 모바일 링크가 보관함에 추가되고 클립보드에 자동 복사되었습니다!\n이제 스마트폰 카카오톡이나 슬랙으로 공유하여 최적화 화면으로 보실 수 있습니다.`);
    
    setIsMoaMode(false);
    setSelectedMoaIds([]);
  };

  const handleLayoutChange = async (id: string, layout: any) => {
    // 낙관적 업데이트
    setCharts(charts.map(c => c.id === id ? { ...c, layout } : c));
    try {
      await updateChartLayoutAction(id, layout);
    } catch (e) {
      console.error('Layout update failed:', e);
    }
  };

  const handleConfigChange = async (id: string, newConfig: any) => {
    // 낙관적 업데이트 (함수형 상태 업데이트로 Stale Closure 방지)
    setCharts(prev => prev.map(c => c.id === id ? { ...c, config: newConfig } : c));
    try {
      await savePinnedChartAction(id, newConfig);
    } catch (e) {
      console.error('Config update failed:', e);
    }
  };

  const handleMove = async (id: string, direction: -1 | 1) => {
    const currentIndex = charts.findIndex(c => c.id === id);
    if (currentIndex === -1) return;
    
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= charts.length) return;
    
    const newCharts = [...charts];
    const [movedItem] = newCharts.splice(currentIndex, 1);
    newCharts.splice(newIndex, 0, movedItem);
    
    // 낙관적 업데이트
    setCharts(newCharts);
    
    try {
      await reorderPinnedChartsAction(newCharts);
    } catch (e) {
      console.error('Reorder failed:', e);
      setCharts(charts); // 실패 시 복구
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 0. 메인 갤러리 액션 툴바 (새 차트 만들기 대신 모아보기 버튼 우선 배치) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-900/[0.02]">
        <div>
          <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase">나의 분석 갤러리</h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Interactive Report Gallery & Widgets</p>
        </div>
        <div className="flex items-center gap-3">
          {!isMoaMode && (
            <button 
              onClick={() => setIsMoaMode(true)}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/20 hover:scale-[1.03] active:scale-95 transition-all cursor-pointer"
            >
              <Share2 size={14} />
              모아보기 (모바일용 멀티 선택)
            </button>
          )}
          
          <Link 
            href="/dashboard/studio" 
            className="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-wider hover:scale-[1.03] active:scale-95 transition-all animate-pulse"
          >
            <Plus size={14} />
            새 차트 만들기
          </Link>
        </div>
      </div>

      {/* 1. [신규 피처] 저장된 모바일 모아보기 링크 보관함 (Saved Moa Closet) UI */}
      {savedMoaLinks.length > 0 && (
        <div className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-2xl shadow-slate-900/5 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-rose-50 p-2.5 rounded-2xl text-rose-500">
              <FolderHeart size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight leading-none">모아보기 보관함 (Mobile Closet)</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Saved Mobile Optimized Dashboard Links</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedMoaLinks.map((link) => (
              <div 
                key={link.id} 
                className="flex items-center gap-3 bg-slate-50 hover:bg-white border border-slate-100 hover:border-blue-500/30 px-4 py-2.5 rounded-2xl transition-all shadow-sm hover:shadow-md group/chip"
              >
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(link.url);
                    alert(`"${link.name}" 모바일 링크가 클립보드에 복사되었습니다!`);
                  }}
                  className="text-xs font-black text-slate-700 hover:text-blue-600 transition-colors flex items-center gap-2"
                  title="링크 복사"
                >
                  <Share2 size={12} className="text-slate-400 group-hover/chip:text-blue-500" />
                  {link.name}
                </button>
                <button 
                  onClick={() => {
                    if (confirm(`"${link.name}" 모아보기 링크를 보관함에서 삭제하시겠습니까?`)) {
                      const filtered = savedMoaLinks.filter(l => l.id !== link.id);
                      setSavedMoaLinks(filtered);
                      localStorage.setItem('moaview-saved-links', JSON.stringify(filtered));
                    }
                  }}
                  className="text-slate-300 hover:text-red-500 transition-colors font-bold text-xs shrink-0"
                  title="삭제"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. [신규 피처] 모아보기 모드 활성화 시 나타나는 지능형 생성 컨트롤러 바 */}
      {isMoaMode && (
        <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-blue-50 border border-blue-100 rounded-[28px] animate-in slide-in-from-top-4 duration-300 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-500/20">
              <Clipboard size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-blue-900 leading-none">모아보기 링크 생성 대기 중</p>
              <p className="text-[10px] font-bold text-blue-500 mt-1">모바일에 노출시킬 위젯들을 체크박스로 다중 선택해 주세요 (선택됨: <span className="font-black text-blue-700">{selectedMoaIds.length}개</span>)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={handleGenerateMoaLink}
              disabled={selectedMoaIds.length === 0}
              className="px-6 py-3.5 bg-blue-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest disabled:opacity-50 active:scale-95 transition-all shadow-xl shadow-blue-500/20"
            >
              모바일 링크 생성
            </button>
            <button 
              onClick={() => { setIsMoaMode(false); setSelectedMoaIds([]); }}
              className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl text-xs uppercase tracking-widest transition-all"
            >
              취소
            </button>
          </div>
        </div>
      )}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {charts.map((p: any, i: number) => (
        <div 
          key={p.id} 
          className={`relative ${p.layout?.span === 'full' ? 'lg:col-span-2' : 'lg:col-span-1'}`}
        >
          {/* [모아보기 선택 체크박스] isMoaMode가 true일 때만 아름답게 페이드인 오버레이 노출 */}
          {isMoaMode && (
            <div className="absolute top-6 left-6 z-30 pointer-events-auto flex items-center justify-center animate-in zoom-in duration-300">
              <input 
                type="checkbox" 
                checked={selectedMoaIds.includes(p.id)}
                onChange={() => {
                  setSelectedMoaIds(prev => 
                    prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                  );
                }}
                className="w-7 h-7 rounded-full border-[3px] border-blue-500/30 text-blue-600 cursor-pointer shadow-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all hover:scale-110 active:scale-90 bg-white/90 backdrop-blur-md"
                title="모아보기 선택"
              />
            </div>
          )}

          <SmartChart 
            config={p.config} 
            isPinned={true}
            chartId={p.id}
            onDelete={() => handleDelete(p.id)}
            onRefresh={() => handleRefresh(p.id)}
            refreshedAt={p.refreshedAt || p.updatedAt}
            isRefreshing={refreshingId === p.id}
            layout={p.layout}
            onLayoutChange={(newLayout) => handleLayoutChange(p.id, newLayout)}
            onConfigChange={(newConfig) => handleConfigChange(p.id, newConfig)}
            onMoveUp={i > 0 ? () => handleMove(p.id, -1) : undefined}
            onMoveDown={i < charts.length - 1 ? () => handleMove(p.id, 1) : undefined}
          />
        </div>
      ))}
      </div>
    </div>
  );
}
