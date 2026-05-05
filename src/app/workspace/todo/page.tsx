'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardList, CheckSquare, Plus, Loader2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TodoItem } from '@/components/workspace/TodoItem';
import { getTodoListAction, updateTaskStatusAction, getTaskHistoryAction } from './actions';

export default function TodoPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [tasks, setTasks] = useState<any[]>([]);
    const [todoSections, setTodoSections] = useState<any[]>([]);
    
    // 모달 및 상세 정보 상태
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [taskHistory, setTaskHistory] = useState<any[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchTasks = async () => {
        setIsLoading(true);
        const data = await getTodoListAction();
        setTasks(data);
        
        // 데이터 그룹화 로직 (섹션별 분류)
        const sections = [
            { id: 'TODO', title: '📋 할 일 (To-Do)', items: data.filter((t: any) => t.status === 'TODO' || !t.status), color: 'text-blue-500' },
            { id: 'IN_PROGRESS', title: '🛠️ 처리중 (In Progress)', items: data.filter((t: any) => t.status === 'IN_PROGRESS'), color: 'text-orange-500' },
            { id: 'LATER', title: '⏳ 나중에 (Later)', items: data.filter((t: any) => t.status === 'LATER'), color: 'text-purple-500' },
            { id: 'COMPLETED', title: '✅ 완료됨 (Completed)', items: data.filter((t: any) => t.status === 'COMPLETED'), color: 'text-emerald-500' }
        ].filter(s => s.items.length > 0);

        setTodoSections(sections);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleTaskClick = async (task: any) => {
        setSelectedTask(task);
        setTaskHistory([]);
        setIsHistoryLoading(true);
        try {
            const history = await getTaskHistoryAction(task.id);
            setTaskHistory(history);
        } catch (e) {}
        setIsHistoryLoading(false);
    };

    const handleUpdateStatus = async (status: string) => {
        if (!selectedTask || isUpdating) return;
        setIsUpdating(true);
        try {
            const result = await updateTaskStatusAction(selectedTask.id, status);
            if (result.success) {
                await fetchTasks();
                setSelectedTask(null);
            } else {
                alert(result.message);
            }
        } catch (err) {
            console.error('Update failed:', err);
        } finally {
            setIsUpdating(false);
        }
    };

    const getStatusLabel = (status: string) => {
        switch(status) {
            case 'TODO': return '할 일';
            case 'IN_PROGRESS': return '처리중';
            case 'LATER': return '나중에';
            case 'COMPLETED': return '완료';
            default: return status;
        }
    };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariant = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    return (
        <div className="max-w-xl mx-auto pb-24 px-4">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-8 py-3 bg-white/50 backdrop-blur-sm rounded-2xl border border-white/40 sticky top-0 z-10 shadow-sm">
                <div className="flex items-center space-x-2 bg-transparent px-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center">
                        <CheckSquare size={18} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">할 일 관리</h2>
                </div>
                <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={fetchTasks}
                    className="w-8 h-8 mr-2 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
                >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </motion.button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-2 mb-8">
                {[
                    { label: '전체', value: tasks.length, color: 'text-gray-500' },
                    { label: '할일', value: tasks.filter(t => t.status === 'TODO' || !t.status).length, color: 'text-blue-500' },
                    { label: '진행', value: tasks.filter(t => t.status === 'IN_PROGRESS').length, color: 'text-orange-500' },
                    { label: '완료', value: tasks.filter(t => t.status === 'COMPLETED').length, color: 'text-emerald-500' }
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white/40 backdrop-blur-sm border border-white/40 p-2 rounded-xl flex flex-col items-center shadow-sm">
                        <span className="text-[9px] font-black text-gray-400 mb-1">{stat.label}</span>
                        <span className={`text-sm font-black ${stat.color}`}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 size={40} className="text-blue-500 animate-spin mb-4" />
                    <p className="text-gray-500 font-bold">업무 데이터를 불러오는 중...</p>
                </div>
            ) : (
                <motion.div 
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="space-y-8"
                >
                    {todoSections.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                            <ClipboardList size={40} className="text-gray-300 mb-4" />
                            <h3 className="text-gray-500 font-bold">배정된 업무가 없습니다</h3>
                        </div>
                    ) : (
                        todoSections.map((section) => (
                            <div key={section.id}>
                                <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ml-1 ${section.color}`}>
                                    {section.title}
                                </h3>
                                <div className="space-y-3">
                                    {section.items.map((todo: any) => (
                                        <motion.div key={todo.id} variants={itemVariant}>
                                            <div onClick={() => handleTaskClick(todo)}>
                                                <TodoItem 
                                                    title={todo.title}
                                                    description={todo.description}
                                                    dueDate={todo.dueAt ? new Date(todo.dueAt).toLocaleDateString() : '기한 없음'}
                                                    category={getStatusLabel(todo.status || 'TODO')}
                                                    initialCompleted={todo.status === 'COMPLETED'}
                                                />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </motion.div>
            )}

            {/* Status Modal */}
            <AnimatePresence>
                {selectedTask && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-24">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedTask(null)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider mb-1 block">업무 상세 및 상태 변경</span>
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">{selectedTask.title}</h3>
                                    </div>
                                    <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                                        <AlertCircle size={20} className="text-gray-400" />
                                    </button>
                                </div>

                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                                    {selectedTask.description || '상세 설명이 없습니다.'}
                                </p>

                                {/* History Tab (Mini) */}
                                <div className="mb-8 overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                                    <div className="px-4 py-2 bg-gray-100/50 dark:bg-gray-800 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-gray-500">상태 변경 이력</span>
                                        {isHistoryLoading && <Loader2 size={10} className="animate-spin text-gray-400" />}
                                    </div>
                                    <div className="p-3 max-h-32 overflow-y-auto space-y-3">
                                        {taskHistory.length === 0 ? (
                                            <p className="text-[10px] text-gray-400 text-center py-2">변경 이력이 없습니다.</p>
                                        ) : (
                                            taskHistory.map((h, i) => (
                                                <div key={i} className="flex items-start space-x-2 text-[10px]">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1" />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between text-gray-400">
                                                            <span>{h.changedByName}</span>
                                                            <span>{new Date(h.changedAt).toLocaleString()}</span>
                                                        </div>
                                                        <div className="text-gray-700 dark:text-gray-300 font-bold mt-0.5">
                                                            {getStatusLabel(h.oldStatus)} → <span className="text-blue-500">{getStatusLabel(h.newStatus)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        disabled={isUpdating}
                                        onClick={() => handleUpdateStatus('COMPLETED')}
                                        className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all font-black"
                                    >
                                        <CheckSquare size={20} className="mb-1" />
                                        <span className="text-xs">완료</span>
                                    </button>
                                    <button 
                                        disabled={isUpdating}
                                        onClick={() => handleUpdateStatus('IN_PROGRESS')}
                                        className="flex flex-col items-center justify-center p-4 rounded-2xl bg-orange-500 text-white hover:bg-orange-600 transition-all font-black"
                                    >
                                        <Loader2 size={20} className="mb-1" />
                                        <span className="text-xs">처리중</span>
                                    </button>
                                    <button 
                                        disabled={isUpdating}
                                        onClick={() => handleUpdateStatus('LATER')}
                                        className="flex flex-col items-center justify-center p-4 rounded-2xl bg-purple-500 text-white hover:bg-purple-600 transition-all font-black"
                                    >
                                        <Clock size={20} className="mb-1" />
                                        <span className="text-xs">나중에</span>
                                    </button>
                                    <button 
                                        disabled={isUpdating}
                                        onClick={() => handleUpdateStatus('TODO')}
                                        className="flex flex-col items-center justify-center p-4 rounded-2xl bg-blue-500 text-white hover:bg-blue-600 transition-all font-black"
                                    >
                                        <ClipboardList size={20} className="mb-1" />
                                        <span className="text-xs">할 일로 복원</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Bottom Floating Action (Concept) */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-20">
                <div className="p-1.5 bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl flex items-center space-x-2">
                    <input 
                        type="text" 
                        placeholder="새로운 업무를 입력하세요..." 
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-3 placeholder:text-gray-400 font-medium"
                    />
                    <button className="bg-orange-500 text-white p-2 rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30">
                        <Plus size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
