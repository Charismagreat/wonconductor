'use client';

import React, { useState, useEffect } from 'react';
// 📦 EXPLICIT IMPORTS: Much more stable in Turbopack/React 19 than name-based strings
import { 
    TrendingUp,
    Mic,
    Camera,
    Plus,
    ChevronRight,
    ArrowLeft,
    FastForward,
    Compass,
    Briefcase,
    Search,
    Bell,
    ArrowRight,
    FileText,
    CheckCircle2,
    Check,
    Clock,
    Inbox,
    Loader2,
    UserCheck,
    AlertTriangle,
    MapPin,
    Trash2,
    Filter,
    Zap
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import {
    markNotificationAsReadAction,
    markAllNotificationsAsReadAction,
    clearOldNotificationsAction,
    getAdminNotificationLogsAction,
    previewWorkspaceTestDataPurgeAction,
    purgeWorkspaceTestDataAction,
    deleteNotificationGroupAction
} from '@/app/actions/notification';
import { requestSteeringAction } from '@/app/actions/workflow-steering';
import { FieldReportSection } from '@/components/FieldReportSection';
import { AICenterWorkflowsClient } from '@/components/AICenterWorkflowsClient';
import { BrainCircuit } from 'lucide-react';


/**
 * 🛡️ Explicit SafeIcon: Uses actual component references to avoid "undefined" errors.
 * If the component passed is undefined, it returns a diagnostic fallback.
 */
const SafeIcon = ({ icon: Icon, isMounted, ...props }: { icon: any, isMounted: boolean, [key: string]: any }) => {
    if (!isMounted) return null;
    
    if (!Icon) {
        console.error('[DIAGNOSTIC] SafeIcon received UNDEFINED icon component');
        return <div className="w-3 h-3 rounded-full bg-red-500 opacity-50 shrink-0" title="Missing Icon" />;
    }
    
    // Check if Icon is a valid function or object (standard React Component check)
    const isComponent = typeof Icon === 'function' || typeof Icon === 'object';
    if (!isComponent) {
        console.error('[DIAGNOSTIC] Invalid icon type received:', typeof Icon);
        return <div className="w-3 h-3 rounded-full bg-amber-400 opacity-50 shrink-0" title="Invalid component" />;
    }
    
    try {
        return <Icon {...props} />;
    } catch (err) {
        return <div className="w-3 h-3 rounded-full bg-slate-300 opacity-50 shrink-0" />;
    }
};

interface BusinessWorkflowHubProps {
    user: any;
    initialNotifications: any[];
    initialAdminLogs?: any[];
    departments?: any[];
    suggestedWorkflows?: any[];
    activeWorkflows?: any[];
}

/**
 * 🚀 BusinessWorkflowHub
 * Standardized Default Export for Stable Module Resolution
 */
export default function BusinessWorkflowHub({ user, initialNotifications, initialAdminLogs = [], departments = [], suggestedWorkflows = [], activeWorkflows = [] }: BusinessWorkflowHubProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'execution' | 'workflows'>('execution');
    const [notifications, setNotifications] = useState<any[]>(Array.isArray(initialNotifications) ? initialNotifications : (initialNotifications as any)?.rows ?? []);
    const [adminLogs, setAdminLogs] = useState<any[]>(Array.isArray(initialAdminLogs) ? initialAdminLogs : (initialAdminLogs as any)?.rows ?? []);
    const [loading, setLoading] = useState(false);
    const [isPurgingTestData, setIsPurgingTestData] = useState(false);
    const [isPreviewingPurge, setIsPreviewingPurge] = useState(false);
    const [purgeDays, setPurgeDays] = useState(30);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDept, setSelectedDept] = useState('ALL');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [isSteeringId, setIsSteeringId] = useState<string | null>(null);

    const toggleGroup = async (key: string, latestLog?: any) => {
        const isOpening = !expandedGroups[key];
        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

        if (isOpening && latestLog) {
            try {
                // [중요] 상세 히스토리를 확인하는 순간 해당 작업(link)의 모든 로그를 읽음 처리함
                await markNotificationAsReadAction(latestLog.id, latestLog.link);
                window.dispatchEvent(new Event('notification:updated'));
                
                // 로컬 상태 즉시 업데이트로 실시간 반응성 확보
                if (latestLog.link) {
                    setNotifications(prev => prev.map(n => 
                        n.link === latestLog.link ? { ...n, isRead: '1' } : n
                    ));
                    setAdminLogs(prev => prev.map(n => 
                        n.link === latestLog.link ? { ...n, isRead: '1' } : n
                    ));
                }
            } catch (err) {
                console.error('Failed to mark group as read:', err);
            }
        }
    };

    const handleDeleteGroup = async (latestLog: any) => {
        if (!isAdmin || !latestLog.link) return;
        
        if (!window.confirm('해당 작업과 관련된 모든 알림을 삭제하시겠습니까?\n(워크스페이스 항목 데이터는 유지되며 대시보드에서만 제거됩니다)')) return;
        
        setLoading(true);
        try {
            const result = await deleteNotificationGroupAction(latestLog.link);
            if (result.success) {
                // 로컬 상태 즉시 갱신
                const refreshed = await getAdminNotificationLogsAction({ searchTerm });
                setAdminLogs(refreshed);
                window.dispatchEvent(new Event('notification:updated'));
            }
        } catch (err) {
            console.error('Failed to delete group:', err);
            alert('그룹 삭제에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const getFileTypeInfo = (text: string) => {
        const t = (text || '').toLowerCase();
        if (t.includes('.png') || t.includes('.jpg') || t.includes('.jpeg') || t.includes('.gif') || t.includes('사진') || t.includes('이미지')) {
            return { icon: Camera, color: 'text-blue-600', bg: 'bg-blue-50', label: '이미지' };
        }
        if (t.includes('.xlsx') || t.includes('.xls') || t.includes('.csv') || t.includes('엑셀')) {
            return { icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50', label: '데이터' };
        }
        if (t.includes('.pdf') || t.includes('문서')) {
            return { icon: FileText, color: 'text-rose-600', bg: 'bg-rose-50', label: '문서' };
        }
        if (t.includes('.mp3') || t.includes('.wav') || t.includes('.m4a') || t.includes('녹음') || t.includes('음성')) {
            return { icon: Mic, color: 'text-purple-600', bg: 'bg-purple-50', label: '음성' };
        }
        return { icon: Briefcase, color: 'text-slate-600', bg: 'bg-slate-50', label: '업무' };
    };

    useEffect(() => {
        setIsMounted(true);
        console.log('[DIAGNOSTIC] BusinessWorkflowHub module mounted recursively');
    }, []);

    const isAdmin = user?.role === 'ADMIN';

    // -- Event Handlers --
    const handleAdminSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const results = await getAdminNotificationLogsAction({ searchTerm });
            setAdminLogs(results);
        } catch (err) {
            console.error('Admin search failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePurgeWorkspaceTestData = async () => {
        if (!isAdmin || isPurgingTestData) return;

        setIsPreviewingPurge(true);
        let preview: any = null;
        try {
            preview = await previewWorkspaceTestDataPurgeAction(purgeDays);
        } catch (err: any) {
            alert(err?.message || '삭제 대상 미리보기에 실패했습니다.');
            setIsPreviewingPurge(false);
            return;
        }
        setIsPreviewingPurge(false);

        const ok = window.confirm(
            `최근 ${preview.days}일 기준 삭제 미리보기\n` +
            `- 대상 항목: ${preview.targetItems}건\n` +
            `- 연관 알림: ${preview.targetNotifications}건\n` +
            `- 연관 파일: ${preview.targetFiles}건\n\n` +
            '정말 일괄 삭제하시겠습니까?'
        );
        if (!ok) return;

        setIsPurgingTestData(true);
        try {
            const result = await purgeWorkspaceTestDataAction(purgeDays);
            if (result?.success) {
                const refreshed = await getAdminNotificationLogsAction({ searchTerm });
                setAdminLogs(refreshed);
                window.dispatchEvent(new Event('notification:updated'));
                alert(
                    `최근 ${result.days}일 테스트 데이터 정리 완료\n` +
                    `- 삭제된 항목: ${result.deletedItems}건\n` +
                    `- 삭제된 알림: ${result.deletedNotifications}건\n` +
                    `- 삭제된 파일: ${result.deletedFiles}건`
                );
            } else {
                alert('테스트 데이터 삭제 중 오류가 발생했습니다.');
            }
        } catch (err: any) {
            alert(err?.message || '테스트 데이터 삭제 중 오류가 발생했습니다.');
        } finally {
            setIsPurgingTestData(false);
        }
    };

    const handleRequestSteering = async (log: any) => {
        if (!isAdmin || isSteeringId) return;

        const openItemMatch = typeof log.link === 'string' ? log.link.match(/[?&]openItem=([^&]+)/) : null;
        const rowId = openItemMatch ? decodeURIComponent(openItemMatch[1]) : null;
        const reportMatch = log.title?.match(/\[(.*?)\]/);
        const reportName = reportMatch ? reportMatch[1] : null;

        if (!rowId || !reportName) {
            alert('데이터 연동 정보가 부족하여 지휘 요청을 할 수 없습니다.');
            return;
        }

        // reportId를 찾기 위해 departments나 다른 메타데이터를 활용하거나 
        // link(/report/reportId)에서 추출
        const reportIdMatch = log.link?.match(/\/report\/([^/?]+)/);
        const reportId = reportIdMatch ? reportIdMatch[1] : null;

        if (!reportId) {
            alert('보고서 ID를 찾을 수 없습니다.');
            return;
        }

        const ok = window.confirm(`[${reportName}] 관련 업무를 STEERING HUB(대표이사 지휘)로 이동하시겠습니까?\n\nAI가 해당 데이터를 분석하여 대표이사에게 추천 조치를 보고하게 됩니다.`);
        if (!ok) return;

        setIsSteeringId(log.id);
        try {
            const res = await requestSteeringAction(reportId, rowId);
            if (res.success) {
                alert('STEERING HUB로 성공적으로 전달되었습니다.\n대표이사가 지휘 센터에서 해당 내용을 확인하고 조치를 결정하게 됩니다.');
            }
        } catch (err: any) {
            alert(err.message || '지휘 요청 중 오류가 발생했습니다.');
        } finally {
            setIsSteeringId(null);
        }
    };

    // 🛡️ UNYIELDING MOUNT GUARD
    if (!isMounted) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    // -- Stats Calculation (Option 1: Summarize from loaded data) --
    const logsToSummarize = isAdmin ? adminLogs : notifications;
    
    // Filtered Logs
    const filteredLogs = logsToSummarize.filter((log: any) => {
        if (selectedDept === 'ALL') return true;
        // In this PoC, we check if title contains the department name in brackets
        const dept = departments.find(d => d.id === selectedDept);
        return log.title?.includes(`[${dept?.name}]`) || log.message?.includes(`[${dept?.name}]`);
    });

    // 1. 로그 그룹화 (동일 작업 단위)
    const logGroups = Object.entries(
        filteredLogs.reduce((acc: any, log: any) => {
            const openItemMatch = typeof log.link === 'string' ? log.link.match(/[?&]openItem=([^&]+)/) : null;
            const wsItemId = openItemMatch ? decodeURIComponent(openItemMatch[1]) : null;
            const reportMatch = log.title?.match(/\[(.*?)\]/);
            const reportName = reportMatch ? reportMatch[1] : 'SYSTEM';
            const summaryMatch = log.message?.match(/\[(.*?)\]/) || log.message?.match(/([^\s]+?\.(png|jpg|jpeg|gif|pdf|xlsx|xls|mp3|wav|m4a))/i);
            const summary = summaryMatch ? (summaryMatch[1] || summaryMatch[0]) : '';
            
            // [수정] userId를 키에서 제외합니다. 한 작업(wsItemId)에 여러 명(기안자, 관리자)이 알림을 받아도 
            // 관리자 화면에서는 하나의 카드(작업 단위)로 병합하여 보여주기 위함입니다.
            const key = wsItemId ? `ws_${wsItemId}` : summary ? `${reportName}_${summary}` : `${reportName}_${log.link}`;
            if (!acc[key]) acc[key] = { reportName, summary, logs: [] };
            acc[key].logs.push(log);
            return acc;
        }, {} as Record<string, any>)
    ).map(([groupKey, group]: [string, any]) => {
        const sortedLogs = [...group.logs].sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        
        // [수정] 상세 내역 내 중복 제거: 동일한 내용(title+message)의 로그는 수신자가 달라도 하나만 표시합니다.
        const seen = new Set();
        const dedupedLogs = sortedLogs.filter((log: any) => {
            const contentKey = `${log.title}_${log.message}`;
            if (seen.has(contentKey)) return false;
            seen.add(contentKey);
            return true;
        });

        const fileLog = dedupedLogs.find((l: any) => l.link && l.link.includes('/uploads/'));
        return { groupKey, ...group, sortedLogs: dedupedLogs, latestLog: fileLog || dedupedLogs[0] };
    });

    // 2. 고유 작업 단위 기반 통계 계산
    const stats = {
        total: logGroups.length,
        todo: logGroups.filter((g: any) => g.latestLog.taskStatus === 'TODO').length,
        actionRequired: logGroups.filter((g: any) => 
            g.latestLog.title?.includes('조치 필요') || 
            g.latestLog.type === 'ALERT' || 
            g.latestLog.taskStatus === 'UNRESOLVED'
        ).length,
        inProgress: logGroups.filter((g: any) => g.latestLog.taskStatus === 'IN_PROGRESS').length,
        done: logGroups.filter((g: any) => g.latestLog.taskStatus === 'DONE').length,
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <PageHeader 
                title="WORKFLOW HUB"
                description={user.role === 'ADMIN' 
                    ? "전사 업무 여정을 실시간으로 관제하고 진행 상태를 모니터링합니다." 
                    : "본인에게 할당된 업무 흐름과 실시간 알림을 확인합니다."}
                icon={Bell}
                rightElement={(
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <div className="relative min-w-[140px]">
                            <select 
                                value={selectedDept}
                                onChange={(e) => setSelectedDept(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500/20 appearance-none transition-all cursor-pointer hover:bg-slate-50"
                            >
                                <option value="ALL">전체 부서 관제</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                            </select>
                            <SafeIcon icon={Filter} isMounted={isMounted} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                        </div>

                        <form onSubmit={handleAdminSearch} className="relative w-full md:w-64">
                            <input 
                                type="text" 
                                placeholder="사원명, 업무 검색..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-900 placeholder:text-slate-400 shadow-sm focus:ring-2 focus:ring-blue-500/20 transition-all hover:bg-slate-50"
                            />
                            <SafeIcon icon={Search} isMounted={isMounted} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                        </form>
                        
                        <div className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 flex items-center gap-2">
                            <div className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
                        </div>
                    </div>
                )}
            />

            {/* Tab bar */}
            <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-[20px] w-fit">
                <button
                    onClick={() => setActiveTab('execution')}
                    className={`px-6 py-3 rounded-[16px] font-black text-[11px] uppercase tracking-widest transition-all ${
                        activeTab === 'execution'
                            ? 'bg-white text-blue-700 shadow-lg shadow-gray-200'
                            : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <SafeIcon icon={Bell} isMounted={isMounted} size={13} />
                        Execution Watcher
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('workflows')}
                    className={`px-6 py-3 rounded-[16px] font-black text-[11px] uppercase tracking-widest transition-all ${
                        activeTab === 'workflows'
                            ? 'bg-white text-purple-700 shadow-lg shadow-gray-200'
                            : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <SafeIcon icon={BrainCircuit} isMounted={isMounted} size={13} />
                        Workflows
                    </span>
                </button>
            </div>

            {/* Workflows tab content */}
            {activeTab === 'workflows' && (
                <AICenterWorkflowsClient
                    suggestedWorkflows={suggestedWorkflows}
                    activeWorkflows={activeWorkflows}
                />
            )}

            {/* Execution Watcher tab content */}
            {activeTab === 'execution' && <>

            {/* 1. Field Report Section (Consolidated from Workspace) */}
            {user.role !== 'CEO' && user.role !== 'ADMIN' && (
                <FieldReportSection deptId={user.departmentId || 'GENERAL'} />
            )}

            {/* 2. Stats Grid - Unified with Department Workspace Design */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: '전체 업무', count: stats.total, icon: Bell, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: '진행 대기', count: stats.todo, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: '조치 필요', count: stats.actionRequired, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
                    { label: '진행 중', count: stats.inProgress, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: '완료됨', count: stats.done, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map((s, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                            <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                        </div>
                        <div className={`${s.bg} ${s.color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
                            <SafeIcon icon={s.icon} isMounted={isMounted} size={20} />
                        </div>
                    </div>
                ))}
            </div>



            {/* Journey View */}
            <div className="space-y-4">
                {loading ? (
                    <div className="bg-white border border-slate-100 rounded-[32px] p-20 text-center text-slate-300">
                        <SafeIcon icon={Loader2} isMounted={isMounted} size={32} className="animate-spin mb-4 mx-auto" />
                    </div>
                ) : logGroups.length === 0 ? (
                    <div className="bg-white border border-slate-100 rounded-[32px] p-20 text-center text-slate-300">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <SafeIcon icon={Inbox} isMounted={isMounted} size={28} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest">분석된 업무 여정이 없습니다.</p>
                    </div>
                ) : (
                    logGroups.map((group: any) => {
                        const { groupKey, sortedLogs, latestLog } = group;
                        
                        const isExpanded = !!expandedGroups[groupKey];
                        const isActionRequired = latestLog.title?.includes('조치 필요') || 
                                              latestLog.type === 'ALERT' || 
                                              latestLog.taskStatus === 'UNRESOLVED';
                        const fileInfo = getFileTypeInfo(latestLog.title + latestLog.message);
                        
                        return (
                            <div key={groupKey} className="relative group animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {/* 🛡️ 마스터 통합 카드 (Consolidated Job Card) */}
                                <div className={`bg-white border transition-all duration-300 rounded-[32px] overflow-hidden shadow-sm hover:shadow-xl ${
                                    isExpanded 
                                    ? (isActionRequired ? 'ring-2 ring-rose-500/10 border-rose-500/20' : 'ring-2 ring-blue-500/10 border-blue-500/20') 
                                    : (isActionRequired ? 'border-rose-200' : 'border-slate-100')
                                }`}>
                                    {/* 1. 카드 상단: 작업 정보 & 파일 타입 아이콘 */}
                                    <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-white to-slate-50/50">
                                        <div className="flex items-center gap-6">
                                            {/* 파일 타입 아이콘 (클릭 시 링크 이동) */}
                                            {(() => {
                                                const basePath = process.env.NEXT_PUBLIC_EGDESK_BASE_PATH || '';
                                                const finalLink = latestLog.link 
                                                    ? (latestLog.link.startsWith('http') ? latestLog.link : `${basePath}${latestLog.link.startsWith('/') ? '' : '/'}${latestLog.link}`) 
                                                    : '#';
                                                return (
                                                    <a 
                                                        href={finalLink} 
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`${fileInfo.bg} ${fileInfo.color} w-16 h-16 rounded-2xl flex items-center justify-center border border-white shadow-inner group/icon hover:scale-105 transition-transform active:scale-95`}
                                                        title={`${fileInfo.label} 보기`}
                                                    >
                                                        <SafeIcon icon={fileInfo.icon} isMounted={isMounted} size={28} />
                                                    </a>
                                                );
                                            })()}
                                            
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border ${
                                                        isActionRequired 
                                                        ? 'text-rose-600 bg-rose-50 border-rose-100' 
                                                        : 'text-blue-600 bg-blue-50 border-blue-100'
                                                    }`}>
                                                        {group.reportName}
                                                    </span>
                                                    {latestLog.message?.includes('📍') && (
                                                        (() => {
                                                            const match = latestLog.message.match(/📍 위치: (.*)/);
                                                            const locFull = match ? match[1].trim() : '현장 확인됨';
                                                            const geoMatch = locFull.match(/\[geo:(.*)\]/);
                                                            const coords = geoMatch ? geoMatch[1] : null;
                                                            // geo 태그를 제거한 순수 주소 명칭
                                                            const locName = geoMatch ? locFull.replace(geoMatch[0], '').trim() : locFull;
                                                            
                                                            // 구글 지도 URL 구성 (좌표 우선, 없으면 주소 검색)
                                                            const googleMapsUrl = coords 
                                                                ? `https://www.google.com/maps/search/?api=1&query=${coords}`
                                                                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locName)}`;

                                                            return (
                                                                <a 
                                                                    href={googleMapsUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-widest border border-emerald-100 flex items-center gap-1 max-w-[220px] hover:bg-emerald-100 hover:border-emerald-200 transition-all group/map cursor-pointer shadow-sm"
                                                                    title={`${locName}\n(클릭 시 지도에서 보기)`}
                                                                    onClick={(e) => e.stopPropagation()} // 카드 클릭 이벤트와 별개로 처리
                                                                >
                                                                    <MapPin size={10} className="shrink-0 group-hover/map:scale-110 transition-transform text-emerald-500" /> 
                                                                    <span className="truncate">
                                                                        {locName.length > 22 ? locName.substring(0, 20) + '...' : locName}
                                                                    </span>
                                                                </a>
                                                            );
                                                        })()
                                                    )}
                                                    {group.summary && (
                                                        <span className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">
                                                            {group.summary}
                                                        </span>
                                                    )}
                                                    {/* 사원 정보 (상단으로 이동하여 카드 크기 최적화) */}
                                                    <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
                                                        <div className="w-5 h-5 bg-slate-900 text-white rounded-md flex items-center justify-center font-black text-[8px]">
                                                            {latestLog.user.fullName?.[0]}
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-700">{latestLog.user.fullName}</span>
                                                    </div>

                                                    {/* 진행 단계 요약 */}
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100/50 rounded-lg border border-slate-100 ml-2">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">
                                                            {sortedLogs.length} STEPS
                                                        </span>
                                                    </div>

                                                    {latestLog.taskStatus && (
                                                        <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center gap-1.5 border ml-1 ${
                                                            latestLog.taskStatus === 'DONE' 
                                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                                : 'bg-amber-50 text-amber-600 border-amber-100'
                                                        }`}>
                                                            <div className={`w-1 h-1 rounded-full ${latestLog.taskStatus === 'DONE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                            {latestLog.taskStatus}
                                                        </div>
                                                    )}
                                                </div>
                                                <h3 className={`text-lg font-black tracking-tight leading-tight ${
                                                    isActionRequired ? 'text-rose-600' : 'text-slate-800'
                                                }`}>
                                                    {latestLog.title}
                                                </h3>
                                                <p className="text-sm font-medium text-slate-500 mt-1 line-clamp-1 italic">
                                                    {latestLog.message?.split('\n📍')[0]}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {/* ⚡ 지휘 요청 버튼 */}
                                            {isAdmin && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRequestSteering(latestLog);
                                                    }}
                                                    disabled={isSteeringId === latestLog.id}
                                                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border border-transparent group/zap ${
                                                        isSteeringId === latestLog.id 
                                                        ? 'bg-blue-100 text-blue-600 animate-pulse' 
                                                        : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-200'
                                                    }`}
                                                    title="대표이사(CEO) 지휘 요청 - STEERING HUB로 이동"
                                                >
                                                    <SafeIcon icon={isSteeringId === latestLog.id ? Loader2 : Zap} isMounted={isMounted} size={20} className={isSteeringId === latestLog.id ? "animate-spin" : "group-hover/zap:scale-110 transition-transform"} />
                                                </button>
                                            )}

                                            {/* 🗑️ 삭제 버튼 (관리자 전용) */}
                                            {isAdmin && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteGroup(latestLog);
                                                    }}
                                                    className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all border border-transparent hover:border-rose-100 group/trash"
                                                    title="이 작업의 모든 알림 삭제"
                                                >
                                                    <SafeIcon icon={Trash2} isMounted={isMounted} size={20} className="group-hover/trash:scale-110 transition-transform" />
                                                </button>
                                            )}

                                            <div className="text-right hidden md:block">
                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">최종 업데이트</p>
                                                <p className="text-xs font-bold text-slate-600">
                                                    <span className="opacity-40 font-medium mr-1.5">{new Date(latestLog.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' })}</span>
                                                    {new Date(latestLog.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => toggleGroup(groupKey, latestLog)}
                                                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                                    isExpanded ? 'bg-slate-900 text-white rotate-180' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                                }`}
                                            >
                                                <SafeIcon icon={isExpanded ? ChevronRight : ChevronRight} isMounted={isMounted} size={20} className={isExpanded ? "rotate-90" : "rotate-90"} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 2. 확장 영역: 컴팩트 히스토리 (Accordion) */}
                                    {isExpanded && (
                                        <div className="bg-slate-50/50 border-t border-slate-100 p-8 pt-6 animate-in slide-in-from-top-2 duration-300">
                                            <div className="mb-4 flex items-center justify-between">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">전체 처리 이력 (Audit Trail)</h4>
                                                <div className="h-px bg-slate-100 flex-1 ml-4" />
                                            </div>
                                            <div className="space-y-3">
                                                {sortedLogs.map((log: any, idx: number) => (
                                                    <div key={log.id} className="flex gap-4 relative">
                                                        {idx !== sortedLogs.length - 1 && (
                                                            <div className="absolute left-[7px] top-4 w-0.5 h-full bg-slate-200/50" />
                                                        )}
                                                        <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm shrink-0 z-10 mt-1 ${
                                                            idx === 0 ? 'bg-blue-500' : 'bg-slate-300'
                                                        }`} />
                                                        <div className="flex-1 pb-4">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <span className={`text-[11px] font-bold ${idx === 0 ? 'text-slate-900' : 'text-slate-500'}`}>
                                                                    {log.title}
                                                                </span>
                                                                <span className="text-[9px] font-medium text-slate-400">
                                                                    {new Date(log.createdAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' })} {new Date(log.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 mt-0.5">{log.message}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            </>}
        </div>
    );
}
