'use client'

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getMicroApp, refreshMicroAppWidgetAction } from '@/app/actions/micro-app';
import { SmartChart } from '@/components/SmartChart';
import { ArrowLeft, Share2, Clock, Smartphone } from 'lucide-react';

export default function MicroAppPage() {
  const { appId } = useParams();
  const router = useRouter();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [refreshingIds, setRefreshingIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadApp() {
      const data = await getMicroApp(appId as string);
      if (data) {
        setApp(data);
      } else {
        alert('앱을 찾을 수 없습니다.');
      }
      setLoading(false);
    }
    loadApp();
  }, [appId]);

  const handleRefreshWidget = async (widgetId: string) => {
    const widget = app.widgets.find((w: any) => w.id === widgetId);
    if (!widget || !widget.config.refreshMetadata) return;

    setRefreshingIds(prev => [...prev, widgetId]);
    try {
      const result = await refreshMicroAppWidgetAction(widget);
      if (result.success) {
        setApp((prev: any) => ({
          ...prev,
          widgets: prev.widgets.map((w: any) => 
            w.id === widgetId 
            ? { ...w, config: { ...w.config, data: result.data }, refreshedAt: result.refreshedAt } 
            : w
          )
        }));
        alert(`'${widget.title}' 데이터가 갱신되었습니다.`);
      } else {
        alert('데이터 갱신에 실패했습니다.');
      }
    } catch (error) {
      alert('네트워크 오류가 발생했습니다.');
    } finally {
      setRefreshingIds(prev => prev.filter(id => id !== widgetId));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">앱 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <div className="text-6xl mb-6">🏜️</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">앱이 존재하지 않습니다.</h1>
        <p className="text-slate-500 mb-8">URL이 잘못되었거나 삭제된 앱일 수 있습니다.</p>
        <button 
          onClick={() => router.push('/dashboard')}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold"
        >
          대시보드로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* App Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <span className="text-xl">{app.icon || '📱'}</span>
              {app.name}
            </h1>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <Smartphone size={10} />
              Micro-App Mode
            </div>
          </div>
        </div>
        <button 
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('앱 링크가 복사되었습니다!');
          }}
          className="p-2 bg-blue-50 text-blue-600 rounded-xl"
        >
          <Share2 size={18} />
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {app.widgets.map((widget: any) => (
          <div key={widget.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SmartChart 
              config={{
                ...widget.config,
                title: widget.title,
                data: widget.config.data || [] 
              }}
              onRefresh={() => handleRefreshWidget(widget.id)}
              isRefreshing={refreshingIds.includes(widget.id)}
              refreshedAt={widget.refreshedAt}
              layout={{ span: 'full' }}
            />
          </div>
        ))}
        
        {/* Footer info */}
        <div className="pt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-100 shadow-sm">
            <Clock size={12} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Last Updated: {new Date(app.updatedAt || app.publishedAt).toLocaleString()}
            </span>
          </div>
          <p className="mt-4 text-[10px] font-medium text-slate-300">
            Powered by EGDesk Micro-App Studio
          </p>
        </div>
      </main>
    </div>
  );
}
