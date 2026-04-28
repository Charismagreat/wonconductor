import React from 'react';
import { queryTable } from '@/egdesk-helpers';
import { getSessionAction } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { 
    Users, 
    Briefcase, 
    CheckCircle2, 
    Clock, 
    AlertCircle,
    TrendingUp,
    Mic,
    Camera,
    Plus,
    ChevronRight,
    ArrowLeft,
    FastForward,
    Compass
} from 'lucide-react';
import Link from 'next/link';
import { FieldReportSection } from '@/components/FieldReportSection';
import PageHeader from '@/components/PageHeader';

export default async function DepartmentWorkspacePage({
    params
}: {
    params: Promise<{ deptId: string }>;
}) {
    // [CONSOLIDATION] Redirect to the new Workflow Hub
    redirect('/notifications');
    
    const { deptId } = await params;
    const session = await getSessionAction();

    if (!session) {
        redirect('/login');
    }

    // 1. Fetch Department Info
    const deptRes = await queryTable('department', { filters: { id: deptId } });
    const department = deptRes[0];

    if (!department) {
        return (
            <div className="p-20 text-center">
                <p className="text-gray-500 font-bold">존재하지 않는 부서입니다.</p>
                <Link href="/" className="text-blue-600 mt-4 inline-block">홈으로 돌아가기</Link>
            </div>
        );
    }

    // 2. Fetch Department Tasks
    // Note: In real scenarios, tasks would be linked via deptId or managerId. 
    // Here we'll simulate by filtering tasks (Lee Team Leader's tasks for PoC)
    const allTasks = await queryTable('action_task', { 
        limit: 100,
        orderBy: 'dueAt',
        orderDirection: 'ASC'
    });

    // 3. Simulated Department Insights (AI generated vibe)
    const stats = {
        total: allTasks.length,
        todo: allTasks.filter((t: any) => t.status === 'TODO').length,
        inProgress: allTasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
        done: allTasks.filter((t: any) => t.status === 'DONE').length,
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#fafafa]">
            <header className="p-8 md:p-8 pb-0">
                <div className="max-w-[1600px] mx-auto">
                    <PageHeader 
                        title={`${department.name} Workspace`}
                        description={department.description || `${department.name} 부서의 업무와 데이터를 관리하는 전용 공간입니다.`}
                        icon={Compass}
                        rightElement={
                            <div className="flex items-center gap-4">
                                <Link href="/dashboard" className="p-2.5 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 transition-all shadow-sm">
                                    <ArrowLeft size={20} />
                                </Link>
                                <div className="text-right hidden md:block">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">{deptId}</p>
                                    <h3 className="text-sm font-black text-slate-800 uppercase">{department.name}</h3>
                                </div>
                            </div>
                        }
                    />

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: '전체 과업', count: stats.total, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { label: '진행 대기', count: stats.todo, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                            { label: '진행 중', count: stats.inProgress, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                            { label: '완료됨', count: stats.done, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        ].map((s, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                                    <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                                </div>
                                <div className={`${s.bg} ${s.color} p-3 rounded-2xl`}>
                                    <s.icon size={20} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Report Bar (Front-line First Vision) - CEO에게는 노출하지 않음 */}
                    {session?.role !== 'CEO' && session?.role !== 'ADMIN' && (
                        <FieldReportSection deptId={deptId} />
                    )}

                    {/* CEO를 위한 대체 섹션 (보고 요약) */}
                    {(session?.role === 'CEO' || session?.role === 'ADMIN') && (
                        <div className="bg-white p-6 rounded-[32px] border border-blue-100 shadow-sm mb-8 flex flex-col md:flex-row items-center justify-between gap-6 border-l-8 border-l-blue-600">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 mb-1 tracking-tight">현장 지휘 센터 (Commander View)</h3>
                                <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">부서 실무진의 보고 데이터와 과업 흐름을 실시간으로 모니터링 중입니다.</p>
                            </div>
                            <div className="flex gap-3">
                                <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-500/20">긴급 지시 발행</button>
                                <button className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm">일반 테이블 생성</button>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-8 md:p-8 pt-0 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Tasks List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                            <Briefcase size={20} className="text-blue-600" />
                            Active Tasks
                        </h2>
                        <button className="text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest">View All</button>
                    </div>

                    {allTasks.map((task: any) => (
                        <div key={task.id} className="group bg-white p-6 rounded-[32px] border border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300 flex items-start justify-between gap-6 cursor-pointer">
                            <div className="space-y-3 flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                                        task.type === 'ISSUE' ? 'bg-red-50 text-red-600 border-red-100' :
                                        task.type === 'MEETING' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                        'bg-blue-50 text-blue-600 border-blue-100'
                                    }`}>
                                        {task.type}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-300">#{task.id}</span>
                                </div>
                                <h4 className="text-lg font-black text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                    {task.title}
                                </h4>
                                <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                                    {task.description}
                                </p>
                                <div className="pt-2 flex items-center gap-6">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Clock size={14} />
                                        <span className="text-[11px] font-bold">마감: {task.dueAt ? new Date(task.dueAt).toLocaleDateString() : '미정'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Users size={14} />
                                        <span className="text-[11px] font-bold">{task.assigneeId}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-4">
                                <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                                    task.status === 'TODO' ? 'bg-gray-100 text-gray-400' :
                                    task.status === 'IN_PROGRESS' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' :
                                    'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                }`}>
                                    {task.status}
                                </div>
                                <div className="p-2 bg-gray-50 text-gray-300 rounded-full group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                                    <ChevronRight size={20} />
                                </div>
                            </div>
                        </div>
                    ))}

                    {allTasks.length === 0 && (
                        <div className="p-20 bg-white border border-dashed rounded-[40px] flex flex-col items-center justify-center text-gray-300">
                            <CheckCircle2 size={48} className="mb-4 opacity-10" />
                            <p className="text-sm font-black uppercase tracking-widest">할 일이 없습니다!</p>
                        </div>
                    )}
                </div>

                {/* Side: ORG Activity & Insights */}
                <div className="space-y-8">
                    <section className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm overflow-hidden relative group">
                        <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                             <FastForward size={20} className="text-indigo-600" />
                             지능형 업무 추적
                        </h2>
                        <div className="space-y-4">
                            {/* In a real scenario, filter instances by dept or tasks */}
                            <div className="p-4 bg-slate-50 rounded-2xl hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-indigo-100 group cursor-pointer">
                                <Link href={`/workflow/wf-inst-test`}>
                                    <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">진행 중인 흐름</p>
                                    <h4 className="text-sm font-black text-gray-800 mb-2">현장 품질 이슈 자동 대응</h4>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                        <Clock size={12} />
                                        <span>최근 업데이트: {new Date().toLocaleTimeString()}</span>
                                    </div>
                                </Link>
                            </div>
                            <p className="text-[10px] text-gray-400 text-center italic">시스템이 실시간으로 업무 흐름을 감시 중입니다.</p>
                        </div>
                    </section>

                    <section className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
                        <div className="relative">
                            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                                <TrendingUp size={20} className="text-blue-600" />
                                AI INSIGHTS
                            </h2>
                            <div className="space-y-6">
                                <div className="p-4 bg-slate-50 rounded-2xl border-l-4 border-blue-500">
                                    <p className="text-[10px] font-black text-blue-600 uppercase mb-2 tracking-widest">오늘의 요약</p>
                                    <p className="text-xs font-semibold text-gray-600 leading-relaxed">
                                        현재 이팀장님에게 집중된 품질 이슈 분석 결과, **밴드 변색 조치**가 가장 시급합니다. 납품 일정을 고려하여 오후 2시 이전에 자재팀 협의를 권장합니다.
                                    </p>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border-l-4 border-amber-500">
                                    <p className="text-[10px] font-black text-amber-600 uppercase mb-2 tracking-widest">리스크 감지</p>
                                    <p className="text-xs font-semibold text-gray-600 leading-relaxed">
                                        효성 미납 건의 경우 차주 월요일 라인 정지 우려가 있습니다. 긴급 상황이므로 대표님 승인을 미리 받아두는 것이 좋습니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                        <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                            <Users size={20} className="text-indigo-600" />
                            부서원 현황
                        </h2>
                        <div className="space-y-4">
                            {[
                                { name: '이동완 팀장', role: '부서장', status: '업무 중', color: 'bg-green-500' },
                                { name: '김래현 이사', role: '영업 지원', status: '외근 중', color: 'bg-amber-500' },
                                { name: '김시종 주임', role: '현장 실무', status: '회의 중', color: 'bg-blue-500' },
                            ].map((u, i) => (
                                <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 font-black">
                                            {u.name[0]}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-gray-900">{u.name}</p>
                                            <p className="text-[10px] font-bold text-gray-400">{u.role}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${u.color}`} />
                                        <span className="text-[10px] font-black text-gray-500 uppercase">{u.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
