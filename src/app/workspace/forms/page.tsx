export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import { listFormTemplatesAction } from '@/app/actions/form-studio';
import Link from 'next/link';
import { FileText, ArrowRight } from 'lucide-react';

export default async function WorkspaceFormsPage() {
  const result = await listFormTemplatesAction('PUBLISHED');
  const templates = result.success && result.templates ? result.templates : [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">자동 완성 문서</h1>
        <p className="text-slate-500 mt-1">사내에 배포된 공식 양식을 사용하여 문서를 빠르게 작성하세요.</p>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[24px] border border-slate-200">
          <FileText size={48} className="text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">사용 가능한 양식이 없습니다</h3>
          <p className="text-slate-500 mt-1 text-center text-sm">관리자가 폼 스튜디오에서 양식을 배포하면<br/>이곳에서 문서를 작성할 수 있습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((tpl: any) => (
            <Link 
              href={`/workspace/forms/${tpl.id}`} 
              key={tpl.id}
              className="group flex bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all h-[140px]"
            >
              <div className="w-1/3 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                {tpl.backgroundImageData ? (
                  <img src={tpl.backgroundImageData} alt={tpl.name} className="w-full h-full object-cover object-top opacity-70 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <FileText className="text-slate-300" size={32} />
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{tpl.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    연결: {tpl.sourceTable || '기본'}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    문서 작성하기 <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
