'use client';

import React, { useState } from 'react';
import { CreatePortal, createPortal } from 'react-dom';
import { Trash2, Loader2, AlertTriangle, X } from 'lucide-react';
import { deleteReportAction } from '@/app/actions/report';

interface DeleteReportButtonProps {
  reportId: string;
  reportName: string;
}

export function DeleteReportButton({ reportId, reportName }: DeleteReportButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteReportAction(reportId);
      setShowConfirm(false);
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다.');
      setIsDeleting(false);
    }
  };

  const modalContent = showConfirm && (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ isolation: 'isolate' }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={() => setShowConfirm(false)}
      />
      
      {/* Modal Card */}
      <div className="relative bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        <div className="p-8 pb-4 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
            <AlertTriangle className="text-red-500" size={32} />
          </div>
          
          <h3 className="text-xl font-black text-slate-900 mb-2">테이블 삭제</h3>
          <p className="text-sm font-medium text-slate-500 leading-relaxed px-4">
            <span className="text-slate-900 font-bold">"{reportName}"</span><br />
            정말로 삭제하시겠습니까? 데이터가 모두 보관함(Archive)으로 이동됩니다.
          </p>
        </div>

        <div className="p-8 pt-4 flex gap-3">
          <button
            onClick={() => setShowConfirm(false)}
            className="flex-1 py-4 bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
          >
            취소
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 py-4 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-red-500/20 active:scale-95"
          >
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            삭제하기
          </button>
        </div>
        
        <button 
          onClick={() => setShowConfirm(false)}
          className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowConfirm(true); }}
        className="text-slate-400 hover:text-red-500 transition-all p-2 hover:bg-red-50 rounded-xl pointer-events-auto"
        title="삭제"
      >
        <Trash2 size={18} />
      </button>

      {mounted && showConfirm && createPortal(modalContent, document.body)}
    </>
  );
}
