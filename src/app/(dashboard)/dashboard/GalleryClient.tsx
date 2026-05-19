'use client';

import React, { useState } from 'react';
import { SmartChart } from '@/components/SmartChart';
import { deletePinnedChartAction, refreshIndividualChartAction, updateChartLayoutAction, reorderPinnedChartsAction, savePinnedChartAction } from '@/app/actions/ai';
import { useRouter } from 'next/navigation';

interface GalleryClientProps {
  initialCharts: any[];
}

export function GalleryClient({ initialCharts }: GalleryClientProps) {
  const router = useRouter();
  const [charts, setCharts] = useState(initialCharts);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {charts.map((p: any, i: number) => (
        <div 
          key={p.id} 
          className={p.layout?.span === 'full' ? 'lg:col-span-2' : 'lg:col-span-1'}
        >
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
  );
}
