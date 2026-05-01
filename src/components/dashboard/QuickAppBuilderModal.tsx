'use client'

import React, { useState } from 'react';
import { createMicroAppFromCharts } from '@/app/actions/micro-app';
import { useRouter } from 'next/navigation';

interface QuickAppBuilderModalProps {
  projectId: string;
  selectedCharts: any[];
  onClose: () => void;
}

export const QuickAppBuilderModal: React.FC<QuickAppBuilderModalProps> = ({
  projectId,
  selectedCharts,
  onClose
}) => {
  const [appName, setAppName] = useState(`${selectedCharts[0]?.title || '새 업무'} 모니터링 앱`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleCreateApp = async () => {
    if (!appName.trim()) {
      alert('앱 이름을 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createMicroAppFromCharts({
        projectId,
        appName,
        selectedCharts
      });

      if (result.success) {
        alert(result.message);
        // 생성된 앱의 상세 페이지나 관리 페이지로 이동 (향후 구현)
        router.push(`/micro-app/${result.appId}`);
        onClose();
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('앱 생성 요청 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
              <span className="text-2xl">🚀</span>
            </div>
            <h2 className="text-2xl font-bold">마이크로 앱 퀵 빌더</h2>
          </div>
          <p className="text-blue-100">선택한 차트들로 독립적인 업무용 앱을 만듭니다.</p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">앱 이름</label>
            <input 
              type="text" 
              placeholder="예: CFO 자금일보 앱"
              className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex justify-between">
              <span>선택된 위젯</span>
              <span className="text-blue-600 font-bold">{selectedCharts.length}개</span>
            </label>
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 max-h-48 overflow-y-auto space-y-2">
              {selectedCharts.map((chart, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100/50">
                  <div className="w-8 h-8 bg-blue-50 flex items-center justify-center rounded-lg text-blue-600 text-xs font-bold">
                    {idx + 1}
                  </div>
                  <span className="text-sm font-medium text-slate-700 truncate">{chart.title || '제목 없는 차트'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
          <button 
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button 
            disabled={isSubmitting}
            onClick={handleCreateApp}
            className="flex-[2] px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              '마이크로 앱 발행하기'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
