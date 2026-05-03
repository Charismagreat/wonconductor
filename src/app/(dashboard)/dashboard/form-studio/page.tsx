export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import { listFormTemplatesAction } from '@/app/actions/form-studio';
import Link from 'next/link';
import { Plus, FileText, Image as ImageIcon, LayoutTemplate } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import FormDeleteButton from './FormDeleteButton';

export default async function FormStudioPage() {
  const result = await listFormTemplatesAction();
  const templates = result.success && result.templates ? result.templates : [];

  const headerRight = (
    <Link 
      href="/dashboard/form-studio/builder"
      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
    >
      <Plus size={18} />
      새 양식 등록
    </Link>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="max-w-[1600px] mx-auto px-8 md:px-12 pt-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <PageHeader 
          title="FORM STUDIO"
          description="사원들이 워크스페이스에서 사용할 자동화 양식을 디자인하고 배포하세요."
          icon={LayoutTemplate}
          rightElement={headerRight}
        />

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 bg-white border border-dashed border-slate-200 rounded-[40px] text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-500">
            <FileText size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">등록된 양식이 없습니다</h3>
          <p className="text-slate-500 text-center mb-6">견적서나 발주서 이미지를 업로드하고<br/>데이터 소스를 매핑하여 자동화 양식을 만들어 보세요.</p>
          <Link 
            href="/dashboard/form-studio/builder"
            className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
          >
            첫 양식 만들기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl: any) => (
            <div key={tpl.id} className="bg-white border border-slate-200 rounded-[24px] overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all group flex flex-col h-[320px]">
              <div className="h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden shrink-0">
                {tpl.backgroundImageData ? (
                  <img src={tpl.backgroundImageData} alt={tpl.name} className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <ImageIcon className="text-slate-300" size={40} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <Link 
                    href={`/dashboard/form-studio/builder?id=${tpl.id}`}
                    className="w-full py-2 bg-white/90 backdrop-blur text-center rounded-lg text-sm font-bold text-slate-800 hover:bg-white"
                  >
                    수정하기
                  </Link>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 line-clamp-1">{tpl.name}</h3>
                  <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                    연결된 소스: {tpl.sourceTable || '없음'}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-xs font-bold rounded-lg ${
                      tpl.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {tpl.status === 'PUBLISHED' ? '배포됨' : '작성중'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      최종 수정: {new Date(tpl.__updated_at || tpl.createdAt).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </span>
                  </div>
                  <FormDeleteButton id={tpl.id} name={tpl.name} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </main>
    </div>
  );
}
