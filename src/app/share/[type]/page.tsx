import React from 'react';
import { SmartChart } from '@/components/SmartChart';
import { loadAllPinnedChartsAction } from '@/lib/services/chart-service';
import { queryTable } from '@/egdesk-helpers';
import { TemplateRenderer } from '@/components/publishing/TemplateRenderer';
import { getSessionAction } from '@/app/actions/auth';
import { notFound, redirect } from 'next/navigation';

export default async function SharedChartPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  
  // 1. 우선순위 1: 핀 고정 차트(Shared Insight)에서 매칭 시도
  const allCharts = await loadAllPinnedChartsAction();
  const chartData = allCharts.find((c: any) => String(c.id) === String(type));

  if (chartData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-5xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Shared Insight</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">이 차트는 FinanceHub 플랫폼에서 공유되었습니다.</p>
          </div>
          
          <div className="shadow-2xl shadow-blue-900/10 rounded-[40px]">
            <SmartChart 
              config={chartData.config} 
              refreshedAt={chartData.refreshedAt || chartData.updatedAt}
              chartId={chartData.id}
            />
          </div>
        </div>
      </div>
    );
  }

  // 2. 우선순위 2: 마이크로 앱(Template / CEO Dashboard 등)에서 매칭 시도
  try {
    const resultsRaw = await queryTable('micro_app_config', {
      filters: { id: type }
    });
    const results = Array.isArray(resultsRaw) ? resultsRaw : (resultsRaw as any)?.rows || [];
    
    if (results && results.length > 0) {
      const config = results[0];
      const user = await getSessionAction();
      
      // 세션 보안 체크 (세션이 없거나 접근 권한이 없으면 적절한 리다이렉트/경고 유도)
      if (!user) {
        redirect(`/login?callbackUrl=/share/${type}`);
      }
      
      const allowedRoles = JSON.parse(config.rbacRoles || '["CEO", "ACCOUNTANT"]');
      if (!allowedRoles.includes(user.role)) {
        return (
          <div className="bg-white p-12 rounded-[40px] shadow-2xl border border-slate-100 text-center max-w-md mx-auto mt-20 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m-3.333-4.667V8a4.667 4.667 0 019.334 0v2.333M4.667 21h14.666a2 2 0 002-2V10.333a2 2 0 00-2-2H4.667a2 2 0 00-2 2V19a2 2 0 002 2z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">접근 권한이 없습니다</h2>
            <p className="text-slate-500 font-medium leading-relaxed">이 데이터는 경영진 전용입니다. 권한이 있는 계정으로 다시 시도해 주세요.</p>
            <div className="mt-8">
              <a href="/dashboard" className="px-8 py-3 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors">
                대시보드로 돌아가기
              </a>
            </div>
          </div>
        );
      }
      
      const mappingConfig = JSON.parse(config.mappingConfig);
      const uiSettings = JSON.parse(config.uiSettings);
      
      return (
        <div className="animate-in fade-in zoom-in-95 duration-700">
          <TemplateRenderer 
            templateId={config.templateId}
            sourceTableId={config.sourceTableId}
            mappingConfig={mappingConfig}
            uiSettings={uiSettings}
            appName={config.name}
          />
        </div>
      );
    }
  } catch (e) {
    console.error('[Shared Page Hybrid Fallback Error]:', e);
  }

  // 3. 둘 다 매칭되지 않을 때 최종 404
  notFound();
}
