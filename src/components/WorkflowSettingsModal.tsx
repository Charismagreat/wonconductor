'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, 
    UserCheck, 
    Clock, 
    CheckSquare, 
    Bell, 
    Save, 
    Loader2, 
    User,
    Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUsersAction } from '@/app/actions/user';
import { updateReportWorkflowAction } from '@/app/actions/report';

interface WorkflowSettingsModalProps {
    report: any;
    onClose: () => void;
}

export function WorkflowSettingsModal({ report, onClose }: WorkflowSettingsModalProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [config, setConfig] = useState({
        assigneeId: report.assigneeId || '',
        autoTodo: report.autoTodo === 1,
        dueDays: report.dueDays || 1
    });

    useEffect(() => {
        async function loadUsers() {
            setLoading(true);
            try {
                const fetchedUsers = await getUsersAction();
                setUsers(fetchedUsers);
            } catch (err) {
                console.error('Failed to load users:', err);
            } finally {
                setLoading(false);
            }
        }
        loadUsers();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateReportWorkflowAction(report.id, {
                assigneeId: config.assigneeId || null,
                autoTodo: config.autoTodo,
                dueDays: config.dueDays
            });
            onClose();
        } catch (err: any) {
            alert(err.message || '저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100"
            >
                {/* Header */}
                <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <Settings2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight lowercase">사후 프로세스 설정</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{report.name}</p>
                                {report.tableName && (
                                    <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-slate-900 text-white shadow-sm">
                                        Source: {report.tableName}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-8">
                    {/* Assignee Selection */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            <User size={12} className="text-blue-500" />
                            업무 담당 사원 지정
                        </label>
                        <div className="relative">
                            <select 
                                value={config.assigneeId}
                                onChange={(e) => setConfig({ ...config, assigneeId: e.target.value })}
                                disabled={loading}
                                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer disabled:opacity-50"
                            >
                                <option value="">담당자 없음 (전파만 수행)</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.fullName || u.username} ({u.role})
                                    </option>
                                ))}
                            </select>
                            {loading && (
                                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                    <Loader2 size={16} className="animate-spin text-blue-500" />
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium ml-1">데이터가 입력되면 지정된 사원에게 푸시 알림이 발송됩니다.</p>
                    </div>

                    {/* Auto Todo Toggle */}
                    <div className="flex items-center justify-between p-5 bg-slate-50 rounded-[24px] group border border-transparent hover:border-blue-100 transition-all">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${config.autoTodo ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                <CheckSquare size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-black text-slate-900 uppercase">할 일(Todo) 자동 생성</p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">담당자의 업무 리스트에 즉시 추가</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setConfig({ ...config, autoTodo: !config.autoTodo })}
                            className={`w-14 h-8 rounded-full transition-all relative ${config.autoTodo ? 'bg-blue-600' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${config.autoTodo ? 'left-7 shadow-lg shadow-blue-500/20' : 'left-1'}`} />
                        </button>
                    </div>

                    {/* Due Days (Only if autoTodo is on) */}
                    <AnimatePresence>
                        {config.autoTodo && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3 overflow-hidden"
                            >
                                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    <Clock size={12} className="text-orange-500" />
                                    기본 마감 기한 (일수)
                                </label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="number" 
                                        min={1}
                                        max={30}
                                        value={config.dueDays}
                                        onChange={(e) => setConfig({ ...config, dueDays: parseInt(e.target.value) || 1 })}
                                        className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-black text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    />
                                    <span className="text-xs font-black text-slate-400 uppercase">DAYS</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50/50 border-t border-slate-50">
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black uppercase text-sm shadow-xl shadow-blue-500/25 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        설정 저장하기
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

