'use client';

import React, { useEffect, useState } from 'react';
import { 
  History, 
  User, 
  Calendar, 
  ArrowRight, 
  X, 
  Clock, 
  Package, 
  Info,
  Loader2,
  CheckCircle2,
  Edit2,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { getRowHistoryAction } from '@/app/actions/row';

interface AuditData {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    creator: { id: string; username: string; fullName: string | null } | null;
    updater: { id: string; username: string; fullName: string | null } | null;
    histories: any[];
}

interface AuditHistoryModalProps {
    isOpen?: boolean; // For compatibility
    onClose: () => void;
    rowId: string;
    columns?: any[]; // For compatibility
}

export function AuditHistoryModal({ rowId, onClose }: AuditHistoryModalProps) {
    const [auditData, setAuditData] = useState<AuditData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (rowId) {
            fetchAuditData();
        }
    }, [rowId]);

    const fetchAuditData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getRowHistoryAction(rowId);
            setAuditData(result as any);
        } catch (err: any) {
            setError(err.message || '이력을 불러오는 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div 
                className="absolute inset-0" 
                onClick={onClose} 
            />
            
            <div className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ease-out">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                            <History size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 tracking-tight">Audit Trail</h2>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                                데이터 변경 이력 추적
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-4">
                            <Loader2 size={48} className="animate-spin text-blue-500" />
                            <p className="font-bold text-sm tracking-widest animate-pulse">이력 분석 중...</p>
                        </div>
                    ) : error ? (
                        <div className="py-20 text-center">
                            <div className="bg-red-50 text-red-600 p-4 rounded-2xl inline-flex flex-col items-center gap-2 max-w-sm mx-auto">
                                <AlertCircle size={32} />
                                <p className="font-bold">{error}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-3xl group hover:bg-white hover:shadow-xl hover:shadow-blue-500/5 transition-all">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                                            <Package size={16} />
                                        </div>
                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">최초 생성</span>
                                    </div>
                                    <p className="text-base font-black text-gray-900 truncate">{auditData?.creator?.fullName || auditData?.creator?.username || '시스템'}</p>
                                    <p className="text-[10px] font-bold text-gray-400 mt-1">{auditData?.createdAt ? new Date(auditData.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}</p>
                                </div>

                                <div className="p-5 bg-purple-50/50 border border-purple-100 rounded-3xl group hover:bg-white hover:shadow-xl hover:shadow-purple-500/5 transition-all">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-8 h-8 bg-purple-500 text-white rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
                                            <Edit2 size={16} />
                                        </div>
                                        <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">마지막 수정</span>
                                    </div>
                                    <p className="text-base font-black text-gray-900 truncate">{auditData?.updater?.fullName || auditData?.updater?.username || '기록 없음'}</p>
                                    <p className="text-[10px] font-bold text-gray-400 mt-1">{auditData?.updatedAt ? new Date(auditData.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}</p>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="relative pl-10 space-y-8 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                                {/* Histories */}
                                {auditData?.histories.map((history, idx) => {
                                    let oldData: any = {};
                                    let newData: any = {};
                                    try {
                                        oldData = history.oldData ? JSON.parse(history.oldData) : {};
                                        newData = history.newData ? JSON.parse(history.newData) : {};
                                    } catch (e) {
                                        console.error('JSON parse error in history:', e);
                                    }

                                    const changedFields = Object.keys(newData).filter(key => 
                                        key !== 'id' && key !== 'updatedAt' && JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])
                                    );

                                    return (
                                        <div key={history.id} className="relative group">
                                            <div className={`absolute -left-10 top-1.5 w-8 h-8 rounded-xl flex items-center justify-center z-10 shadow-lg transition-transform group-hover:scale-110 ${
                                                history.changeType === 'DELETE' ? 'bg-red-500 text-white shadow-red-500/30' : 'bg-blue-600 text-white shadow-blue-500/30'
                                            }`}>
                                                {history.changeType === 'DELETE' ? <Trash2 size={16} /> : <Edit2 size={16} />}
                                            </div>
                                            <div className="p-6 bg-white border border-gray-100 rounded-3xl group-hover:shadow-2xl group-hover:shadow-gray-900/5 transition-all">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <p className="text-xs font-black text-gray-900 uppercase">
                                                            {history.changeType === 'DELETE' ? '데이터 삭제' : '데이터 수정'}
                                                        </p>
                                                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                                                            By {history.changedBy?.fullName || history.changedBy?.username || 'Unknown'}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-400">{new Date(history.changedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
                                                </div>

                                                <div className="space-y-3">
                                                    {changedFields.map(field => (
                                                        <div key={field} className="flex flex-col gap-1.5">
                                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{field}</span>
                                                            <div className="flex items-center gap-3 bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                                                                <div className="flex-1 text-[11px] font-bold text-gray-400 line-through truncate">{String(oldData[field] || '없음')}</div>
                                                                <ArrowRight size={12} className="text-gray-300 flex-shrink-0" />
                                                                <div className="flex-1 text-[11px] font-black text-gray-800 truncate">{String(newData[field] || '없음')}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {changedFields.length === 0 && history.changeType === 'DELETE' && (
                                                        <p className="text-xs font-bold text-red-500 flex items-center gap-1.5 animate-pulse">
                                                            <Trash2 size={12} /> 데이터가 삭제되었습니다.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {auditData?.histories.length === 0 && !isLoading && (
                                     <div className="relative group">
                                         <div className="absolute -left-10 top-1.5 w-8 h-8 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center z-10">
                                             <Info size={16} />
                                         </div>
                                         <div className="p-5 border border-dashed border-gray-200 rounded-3xl">
                                             <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest text-center">변경 이력이 아직 없습니다.</p>
                                         </div>
                                     </div>
                                )}

                                {/* Start point */}
                                <div className="relative group">
                                    <div className="absolute -left-10 top-1.5 w-8 h-8 bg-gray-200 text-gray-500 rounded-xl flex items-center justify-center z-10 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <Package size={16} />
                                    </div>
                                    <div className="p-5 border border-dashed border-gray-100 rounded-3xl group-hover:border-blue-200 group-hover:bg-blue-50/30 transition-all">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] group-hover:text-blue-600">Initial Creation Log</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 bg-gray-50 border-t border-gray-100">
                    <button 
                        onClick={onClose}
                        className="w-full py-4 bg-white border border-gray-200 text-gray-900 font-extrabold rounded-2xl text-xs uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                    >
                        닫기
                    </button>
                    <p className="mt-4 text-[9px] font-black text-gray-300 uppercase tracking-[0.4em] text-center">
                        Secure Audit Logging System v1.0
                    </p>
                </div>
            </div>
        </div>
    );
}

