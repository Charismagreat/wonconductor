import React from 'react';
import { queryTable } from '@/egdesk-helpers';
import { getSessionAction } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { 
    Activity, 
    Clock, 
    CheckCircle2, 
    ArrowLeft,
    Box,
    FileText,
    MessageSquare,
    User,
    ChevronDown,
    FastForward
} from 'lucide-react';
import Link from 'next/link';

export default async function WorkflowDetailPage({
    params
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await getSessionAction();

    if (!session) {
        redirect('/login');
    }

    // 1. Fetch Workflow Instance
    const instRes = await queryTable('workflow_instance', { filters: { id } });
    const instance = instRes[0];

    if (!instance) {
        return <div className="p-20 text-center">워크플로우 정보를 찾을 수 없습니다.</div>;
    }

    // 2. Fetch Template Info
    const tplRes = await queryTable('workflow_template', { filters: { id: instance.templateId } });
    const template = tplRes[0];

    // 3. Fetch Related Tasks
    const tasksRaw = await queryTable('action_task', {
        filters: { instanceId: id },
        orderBy: 'createdAt'
    });
    const tasks = Array.isArray(tasksRaw) ? tasksRaw : (tasksRaw as any)?.rows ?? [];

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
            <header className="bg-white border-b border-slate-100 p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center gap-4 mb-6">
                        <Link href="/dashboard" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                            <ArrowLeft size={20} className="text-slate-400" />
                        </Link>
                        <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                            {instance.status}
                        </div>
                    </div>
                    <div className="flex items-end justify-between gap-8">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2 uppercase">
                                {template?.name || 'Workflow Instance'}
                            </h1>
                            <p className="text-slate-400 font-bold text-sm tracking-tight flex items-center gap-2">
                                <Activity size={16} />
                                Instance ID: {id} • 시작일: {new Date(instance.startedAt).toLocaleString()}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">
                                로그 다운로드
                            </button>
                            <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-500/20 hover:scale-105 transition-all">
                                전체 완료 처리
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Left: Timeline */}
                    <div className="lg:col-span-2 space-y-12">
                        <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Traceability Timeline</h2>
                        
                        <div className="relative space-y-12 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            
                            {/* 1. Trigger Event */}
                            <div className="relative pl-16 group">
                                <div className="absolute left-0 w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 z-10 group-hover:scale-110 transition-transform">
                                    <MessageSquare size={20} />
                                </div>
                                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">01. 현장 보고 발생 (Trigger)</p>
                                        <p className="text-[10px] font-bold text-slate-300">{new Date(instance.startedAt).toLocaleTimeString()}</p>
                                    </div>
                                    <p className="text-slate-600 font-medium leading-relaxed italic mb-4">
                                        "음성/사진 데이터 입력을 통해 워크플로우가 자동 시작되었습니다."
                                    </p>
                                    <div className="flex gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                                        <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-900 leading-none mb-1">Row ID: {instance.triggerRowId}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Report ID: {template?.triggerReportId}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Tasks Progression */}
                            {tasks.map((task: any, idx: number) => (
                                <div key={task.id} className="relative pl-16 group">
                                    <div className={`absolute left-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg z-10 group-hover:scale-110 transition-transform ${
                                        task.status === 'DONE' ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-slate-200 text-slate-400'
                                    }`}>
                                        {task.status === 'DONE' ? <CheckCircle2 size={20} /> : <Box size={20} />}
                                    </div>
                                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
                                        {task.status === 'DONE' && (
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-12 -mt-12 flex items-center justify-center pt-8 pr-8">
                                                <CheckCircle2 size={24} className="text-emerald-500 opacity-20" />
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between mb-4">
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${
                                                task.status === 'DONE' ? 'text-emerald-600' : 'text-slate-400'
                                            }`}>
                                                {String(idx + 2).padStart(2, '0')}. {task.type} 할당 및 수행
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-300">
                                                {task.createdAt ? new Date(task.createdAt).toLocaleTimeString() : 'N/A'}
                                            </p>
                                        </div>
                                        <h4 className="text-lg font-black text-slate-900 mb-2 truncate pr-12">{task.title}</h4>
                                        <p className="text-sm text-slate-500 leading-relaxed mb-6">{task.description}</p>
                                        
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                                                    <User size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-900 leading-none">{task.assigneeId}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{task.assigneeRole}</p>
                                                </div>
                                            </div>
                                            <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                                task.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                {task.status}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* 3. Final Milestone (Placeholder for CEO Approval) */}
                            <div className="relative pl-16 opacity-40">
                                <div className="absolute left-0 w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 z-10 border-2 border-dashed border-slate-200">
                                    <FastForward size={20} />
                                </div>
                                <div className="p-8 rounded-[32px] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">최종 마감 및 승인 대기 중</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Meta Info */}
                    <div className="space-y-8">
                        <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 pb-4 border-b border-slate-50">Context Info</h3>
                            <div className="space-y-6">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Trigger Template</p>
                                    <p className="text-xs font-bold text-slate-700">{template?.name}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 rounded-xl">
                                        <Clock size={16} className="text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Status</p>
                                        <p className="text-xs font-bold text-slate-700">{instance.status}</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="bg-blue-600 p-8 rounded-[40px] text-white shadow-xl shadow-blue-600/20">
                            <Activity size={24} className="mb-4 opacity-50" />
                            <h3 className="text-lg font-black mb-2">AI 추적 한마디</h3>
                            <p className="text-xs text-blue-100 font-medium leading-relaxed">
                                본 업무는 {tasks.length}개의 과업으로 분화되었으며, 현재 전체적인 조치가 신속하게 이루어지고 있습니다. 평균 마감 속도는 이전 기간 대비 15% 단축되었습니다.
                            </p>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
