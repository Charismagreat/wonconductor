'use client';

import React, { useState } from 'react';
import {
    BrainCircuit,
    CheckCircle2,
    XCircle,
    Loader2,
    Zap,
    Tag,
    ListChecks,
    ChevronDown,
    ChevronUp,
    PauseCircle,
    Sparkles,
    FlaskConical,
} from 'lucide-react';
import {
    activateWorkflowAction,
    discardWorkflowAction,
    deactivateWorkflowAction,
    debugFetchHierarchyAction,
} from '@/app/actions/ai-center-workflows';

interface AICenterWorkflowsClientProps {
    suggestedWorkflows: any[];
    activeWorkflows: any[];
}

const ACTION_COLORS: Record<string, string> = {
    notify: 'bg-amber-50 border-amber-100 text-amber-700',
    create_task: 'bg-indigo-50 border-indigo-100 text-indigo-700',
    update_status: 'bg-teal-50 border-teal-100 text-teal-700',
    escalate: 'bg-red-50 border-red-100 text-red-700',
    approve: 'bg-violet-50 border-violet-100 text-violet-700',
};

const ACTION_LABELS: Record<string, string> = {
    notify: '알림',
    create_task: '태스크 생성',
    update_status: '상태 업데이트',
    escalate: '에스컬레이션',
    approve: '결재',
};

/**
 * Render action params as human-readable lines.
 * Handles approvalChain (array of {role, name}) specially to avoid [object Object].
 */
function renderActionParams(params: Record<string, any> | undefined): React.ReactNode {
    if (!params) return null;

    const lines: string[] = [];

    for (const [key, val] of Object.entries(params)) {
        if (key === 'approvalChain' && Array.isArray(val)) {
            const chain = val
                .map((item: any) => item.name ? `${item.role}(${item.name})` : item.role)
                .join(' → ');
            lines.push(`결재 순서: ${chain}`);
        } else if (key === 'deadline' && val && typeof val === 'object' && val.ref) {
            lines.push(`마감일: {{${val.ref}}} 필드 기준`);
        } else if (typeof val === 'object' && val !== null) {
            lines.push(`${key}: ${JSON.stringify(val)}`);
        } else {
            lines.push(`${key}: ${val}`);
        }
    }

    return lines.map((line, i) => (
        <span key={i} className="block">
            {line}
        </span>
    ));
}

function WorkflowCard({
    workflow,
    mode,
}: {
    workflow: any;
    mode: 'suggested' | 'active';
}) {
    const [expanded, setExpanded] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);

    const actions: Array<{ actionId: string; params?: Record<string, any>; stage?: number; position?: number }> =
        (workflow.actions || []).slice().sort((a: any, b: any) => {
            const stageDiff = (a.stage ?? 0) - (b.stage ?? 0);
            return stageDiff !== 0 ? stageDiff : (a.position ?? 0) - (b.position ?? 0);
        });
    const hints: string[] = workflow.hints || [];
    const inputTypes: string[] = workflow.inputTypes || [];

    const reportHint = hints.find((h) => h.startsWith('report:'))?.replace('report:', '');
    const categoryHint = hints.find((h) => h.startsWith('category:'))?.replace('category:', '');

    const handleActivate = async () => {
        setProcessing('activate');
        try {
            await activateWorkflowAction(workflow.id);
        } catch {
            alert('활성화 중 오류가 발생했습니다.');
        } finally {
            setProcessing(null);
        }
    };

    const handleDiscard = async () => {
        setProcessing('discard');
        try {
            await discardWorkflowAction(workflow.id);
        } catch {
            alert('처리 중 오류가 발생했습니다.');
        } finally {
            setProcessing(null);
        }
    };

    const handleDeactivate = async () => {
        setProcessing('deactivate');
        try {
            await deactivateWorkflowAction(workflow.id);
        } catch {
            alert('비활성화 중 오류가 발생했습니다.');
        } finally {
            setProcessing(null);
        }
    };

    return (
        <div
            className={`bg-white border rounded-[40px] shadow-2xl shadow-gray-900/5 overflow-hidden flex flex-col transition-all ${
                mode === 'active'
                    ? 'border-green-200 hover:border-green-300'
                    : 'border-gray-100 hover:border-purple-200'
            }`}
        >
            {/* Header */}
            <div
                className={`p-8 border-b flex items-start justify-between gap-4 ${
                    mode === 'active' ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'
                }`}
            >
                <div className="flex items-center gap-4 min-w-0">
                    <div
                        className={`p-3 rounded-2xl shadow-lg flex-shrink-0 ${
                            mode === 'active'
                                ? 'bg-green-600 text-white shadow-green-200'
                                : 'bg-purple-600 text-white shadow-purple-200'
                        }`}
                    >
                        {mode === 'active' ? (
                            <Zap size={20} fill="currentColor" />
                        ) : (
                            <Sparkles size={20} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <span
                            className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 block ${
                                mode === 'active' ? 'text-green-600' : 'text-purple-600'
                            }`}
                        >
                            {mode === 'active' ? 'Active Workflow' : 'AI Suggestion'}
                        </span>
                        <h4 className="text-lg font-black text-gray-900 tracking-tight truncate">
                            {workflow.label}
                        </h4>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div
                        className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                            mode === 'active'
                                ? 'bg-green-600 text-white'
                                : 'bg-purple-100 text-purple-700'
                        }`}
                    >
                        {actions.length} ACTIONS
                    </div>
                </div>
            </div>

            {/* Meta info */}
            <div className="px-8 py-5 flex flex-wrap gap-2 border-b border-gray-50">
                {inputTypes.map((t) => (
                    <span
                        key={t}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-xl text-[10px] font-black text-blue-600 uppercase tracking-wide"
                    >
                        <Tag size={10} />
                        {t}
                    </span>
                ))}
                {reportHint && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-wide">
                        REPORT: {reportHint}
                    </span>
                )}
                {categoryHint && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-wide">
                        {categoryHint}
                    </span>
                )}
            </div>

            {/* Actions list */}
            <div className="px-8 py-5 flex-1">
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="flex items-center gap-2 text-[11px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors mb-4"
                >
                    <ListChecks size={14} />
                    액션 단계 ({actions.length})
                    {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {expanded && (() => {
                    // Group actions by stage
                    const stageMap = new Map<number, typeof actions>();
                    actions.forEach(a => {
                        const s = a.stage ?? 0;
                        if (!stageMap.has(s)) stageMap.set(s, []);
                        stageMap.get(s)!.push(a);
                    });
                    const stages = Array.from(stageMap.entries()).sort(([a], [b]) => a - b);
                    const hasStages = stages.length > 1 || (stages[0]?.[0] ?? 0) > 0;

                    return (
                        <div className="space-y-4">
                            {stages.map(([stageIdx, stageActions]) => (
                                <div key={stageIdx}>
                                    {hasStages && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                                                Stage {stageIdx + 1}
                                            </span>
                                            <div className="flex-1 h-px bg-gray-100" />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        {stageActions.map((action, i) => {
                                            const colorClass =
                                                ACTION_COLORS[action.actionId] ||
                                                'bg-gray-50 border-gray-100 text-gray-600';
                                            const label =
                                                ACTION_LABELS[action.actionId] || action.actionId;
                                            const paramNode = renderActionParams(action.params);
                                            return (
                                                <div
                                                    key={i}
                                                    className={`flex items-start gap-3 p-4 rounded-[20px] border ${colorClass}`}
                                                >
                                                    <span className="text-[9px] font-black mt-0.5 opacity-40 flex-shrink-0">
                                                        {String(i + 1).padStart(2, '0')}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[10px] font-black uppercase tracking-widest mb-1">
                                                            {label}
                                                        </div>
                                                        {paramNode && (
                                                            <div className="text-[10px] font-medium opacity-70 leading-relaxed break-words space-y-0.5">
                                                                {paramNode}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>

            {/* Footer buttons */}
            <div className="p-8 pt-0 flex items-center gap-4">
                {mode === 'suggested' ? (
                    <>
                        <button
                            onClick={handleActivate}
                            disabled={!!processing}
                            className="flex-1 py-4 bg-gray-900 text-white rounded-[20px] font-black text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-gray-200 hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {processing === 'activate' ? (
                                <Loader2 className="animate-spin" size={16} />
                            ) : (
                                <CheckCircle2 size={16} />
                            )}
                            활성화 (Activate)
                        </button>
                        <button
                            onClick={handleDiscard}
                            disabled={!!processing}
                            className="px-6 py-4 bg-white border border-gray-100 text-gray-400 rounded-[20px] font-black text-[12px] uppercase tracking-[0.2em] hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {processing === 'discard' ? (
                                <Loader2 className="animate-spin" size={16} />
                            ) : (
                                <XCircle size={20} />
                            )}
                        </button>
                    </>
                ) : (
                    <button
                        onClick={handleDeactivate}
                        disabled={!!processing}
                        className="px-6 py-4 bg-white border border-gray-100 text-gray-500 rounded-[20px] font-black text-[12px] uppercase tracking-[0.2em] hover:text-orange-600 hover:border-orange-100 hover:bg-orange-50 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                        {processing === 'deactivate' ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <PauseCircle size={16} />
                        )}
                        비활성화
                    </button>
                )}
            </div>
        </div>
    );
}

export function AICenterWorkflowsClient({
    suggestedWorkflows,
    activeWorkflows,
}: AICenterWorkflowsClientProps) {
    const [tab, setTab] = useState<'suggested' | 'active'>('active');
    const [debugResult, setDebugResult] = useState<any>(null);
    const [debugLoading, setDebugLoading] = useState(false);

    const handleDebugHierarchy = async () => {
        setDebugLoading(true);
        setDebugResult(null);
        try {
            const result = await debugFetchHierarchyAction();
            setDebugResult(result);
        } catch (e: any) {
            setDebugResult({ error: e?.message });
        } finally {
            setDebugLoading(false);
        }
    };

    const displayed = tab === 'suggested' ? suggestedWorkflows : activeWorkflows;

    return (
        <div className="space-y-8">
            {/* Debug: Hierarchy fetch test */}
            <div className="flex items-start gap-4">
                <button
                    onClick={handleDebugHierarchy}
                    disabled={debugLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-purple-600 hover:border-purple-200 hover:bg-purple-50 transition-all disabled:opacity-50"
                >
                    {debugLoading ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />}
                    계층/정책 컨텍스트 테스트
                </button>
            </div>
            {debugResult && (
                <div className="bg-gray-950 text-green-400 rounded-[24px] p-6 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[500px] overflow-y-auto">
                    <pre>{JSON.stringify(debugResult, null, 2)}</pre>
                </div>
            )}

            {/* Tab bar */}
            <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-[20px] w-fit">
                <button
                    onClick={() => setTab('active')}
                    className={`px-6 py-3 rounded-[16px] font-black text-[11px] uppercase tracking-widest transition-all ${
                        tab === 'active'
                            ? 'bg-white text-green-700 shadow-lg shadow-gray-200'
                            : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Zap size={13} />
                        활성 워크플로우 ({activeWorkflows.length})
                    </span>
                </button>
                <button
                    onClick={() => setTab('suggested')}
                    className={`px-6 py-3 rounded-[16px] font-black text-[11px] uppercase tracking-widest transition-all ${
                        tab === 'suggested'
                            ? 'bg-white text-purple-700 shadow-lg shadow-gray-200'
                            : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        <Sparkles size={13} />
                        AI 제안 ({suggestedWorkflows.length})
                    </span>
                </button>
            </div>

            {/* Content */}
            {displayed.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-[40px] p-20 flex flex-col items-center justify-center text-center gap-6">
                    <div className="p-6 bg-white rounded-full shadow-xl shadow-gray-200">
                        {tab === 'suggested' ? (
                            <BrainCircuit size={48} className="text-purple-400" />
                        ) : (
                            <Zap size={48} className="text-green-400" />
                        )}
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                            {tab === 'suggested'
                                ? 'AI 제안 워크플로우가 없습니다.'
                                : '활성화된 워크플로우가 없습니다.'}
                        </h3>
                        <p className="text-gray-500 font-medium max-w-sm">
                            {tab === 'suggested'
                                ? '새로운 데이터가 등록되면 AI가 자동으로 워크플로우 템플릿을 설계하여 여기에 표시합니다.'
                                : 'AI 제안 탭에서 워크플로우를 검토하고 활성화하세요.'}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {displayed.map((wf) => (
                        <WorkflowCard key={wf.id} workflow={wf} mode={tab} />
                    ))}
                </div>
            )}
        </div>
    );
}
