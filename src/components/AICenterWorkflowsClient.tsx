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
    Pencil,
    Plus,
} from 'lucide-react';
import {
    activateWorkflowAction,
    discardWorkflowAction,
    deactivateWorkflowAction,
    debugFetchHierarchyAction,
    updateWorkflowFullAction,
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

// ─── Edit-state types ──────────────────────────────────────────────────────────

type DueMode = 'days' | 'ref';

interface CreateTaskBlock {
    rowId?: string; type: 'create_task';
    title: string; role: string;
    dueMode: DueMode; dueDays: string; deadlineRef: string;
}
interface ApproveBlock {
    rowId?: string; type: 'approve';
    title: string; approvalChain: { role: string }[];
}
interface UpdateStatusBlock {
    rowId?: string; type: 'update_status'; value: string;
}
type ActionBlock = CreateTaskBlock | ApproveBlock | UpdateStatusBlock;
interface EditStage { actions: ActionBlock[]; }

const STATUS_OPTIONS = ['정상진행중', '반려중', '정상완료', '취소완료'] as const;
const STATUS_ACTIVE: Record<string, string> = {
    '정상진행중': 'bg-teal-500 text-white',
    '반려중': 'bg-orange-500 text-white',
    '정상완료': 'bg-green-500 text-white',
    '취소완료': 'bg-gray-500 text-white',
};
const STATUS_INACTIVE: Record<string, string> = {
    '정상진행중': 'bg-teal-50 text-teal-600 hover:bg-teal-100 border border-teal-100',
    '반려중': 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-100',
    '정상완료': 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-100',
    '취소완료': 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200',
};

function parseBlock(a: any): ActionBlock {
    const p = a.params || {};
    if (a.actionId === 'create_task') {
        return {
            rowId: a.rowId, type: 'create_task',
            title: p.title || '',
            role: p.role || p.assigneeRole || '',
            dueMode: p.deadline?.ref ? 'ref' : 'days',
            dueDays: String(p.dueDays ?? '1'),
            deadlineRef: p.deadline?.ref || '',
        };
    }
    if (a.actionId === 'approve') {
        return {
            rowId: a.rowId, type: 'approve',
            title: p.title || '',
            approvalChain: Array.isArray(p.approvalChain) ? p.approvalChain : [],
        };
    }
    return { rowId: a.rowId, type: 'update_status', value: p.value || '정상진행중' };
}

function blockToParams(b: ActionBlock): Record<string, any> {
    if (b.type === 'create_task') {
        const p: Record<string, any> = { title: b.title, role: b.role };
        if (b.dueMode === 'days' && b.dueDays !== '') p.dueDays = Number(b.dueDays);
        else if (b.dueMode === 'ref' && b.deadlineRef) p.deadline = { ref: b.deadlineRef };
        return p;
    }
    if (b.type === 'approve') return { title: b.title, approvalChain: b.approvalChain };
    return { value: b.value };
}

function buildStages(workflow: any): EditStage[] {
    const flat: any[] = (workflow.actions || []).slice()
        .sort((a: any, b: any) => (a.stage ?? 0) - (b.stage ?? 0) || (a.position ?? 0) - (b.position ?? 0));
    if (flat.length === 0) return [{ actions: [] }];
    const map = new Map<number, any[]>();
    for (const a of flat) {
        const s = a.stage ?? 0;
        if (!map.has(s)) map.set(s, []);
        map.get(s)!.push(a);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
        .map(([, acts]) => ({ actions: acts.map(parseBlock) }));
}

function createDefaultBlock(type: 'create_task' | 'approve' | 'update_status'): ActionBlock {
    if (type === 'create_task') return { type, title: '', role: '', dueMode: 'days', dueDays: '1', deadlineRef: '' };
    if (type === 'approve') return { type, title: '', approvalChain: [{ role: '' }] };
    return { type, value: '정상진행중' };
}

const BLOCK_TYPES = [
    { type: 'create_task' as const, label: '태스크 생성', desc: '역할에게 업무 배정', border: 'border-indigo-200', bg: 'hover:bg-indigo-50', text: 'text-indigo-700' },
    { type: 'approve' as const, label: '결재', desc: '순차 결재선 승인', border: 'border-violet-200', bg: 'hover:bg-violet-50', text: 'text-violet-700' },
    { type: 'update_status' as const, label: '상태 변경', desc: '런 상태 업데이트', border: 'border-teal-200', bg: 'hover:bg-teal-50', text: 'text-teal-700' },
];

// ─── Tag editor sub-component ──────────────────────────────────────────────────

function TagEditor({ label: lbl, tags, placeholder, onAdd, onRemove, chipClass }: {
    label: string; tags: string[]; placeholder: string;
    onAdd: (t: string) => void; onRemove: (t: string) => void;
    chipClass: string;
}) {
    const [val, setVal] = useState('');
    const commit = () => { const t = val.trim(); if (t) { onAdd(t); setVal(''); } };
    return (
        <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">{lbl}</span>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[1.75rem]">
                {tags.map(t => (
                    <span key={t} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black border ${chipClass}`}>
                        {t}
                        <button onClick={() => onRemove(t)} className="hover:text-red-500 transition-colors ml-0.5"><XCircle size={10} /></button>
                    </span>
                ))}
                {tags.length === 0 && <span className="text-[10px] text-gray-300 self-center">없음</span>}
            </div>
            <div className="flex gap-1.5">
                <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && commit()}
                    placeholder={placeholder}
                    className="flex-1 border border-gray-200 rounded-[10px] px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-none focus:border-purple-300" />
                <button onClick={commit} className="px-3 py-1.5 bg-gray-800 text-white rounded-[10px] text-[10px] font-black hover:bg-black transition-colors">+</button>
            </div>
        </div>
    );
}

// ─── Inline block editors ──────────────────────────────────────────────────────

function CreateTaskEditor({ block, idx, onUpdate, onRemove }: {
    block: CreateTaskBlock; idx: number;
    onUpdate: (p: Partial<CreateTaskBlock>) => void; onRemove: () => void;
}) {
    return (
        <div className="rounded-[18px] border border-indigo-100 bg-indigo-50/70 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-indigo-100/80">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-indigo-300">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">태스크 생성</span>
                </div>
                <button onClick={onRemove} className="p-0.5 text-indigo-300 hover:text-red-500 transition-colors"><XCircle size={13} /></button>
            </div>
            <div className="p-3 space-y-2.5">
                <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1 block">제목</label>
                    <input type="text" value={block.title} onChange={e => onUpdate({ title: e.target.value })}
                        placeholder="예: 운행기록 대조, 실사용자 확인"
                        className="w-full bg-white border border-indigo-100 rounded-[9px] px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-none focus:border-indigo-300" />
                </div>
                <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1 block">담당 역할</label>
                    <input type="text" value={block.role} onChange={e => onUpdate({ role: e.target.value })}
                        placeholder="예: 경영지원팀 사원"
                        className="w-full bg-white border border-indigo-100 rounded-[9px] px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-none focus:border-indigo-300" />
                </div>
                <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1.5 block">마감</label>
                    <div className="flex gap-1.5 mb-2">
                        {(['days', 'ref'] as DueMode[]).map(m => (
                            <button key={m} onClick={() => onUpdate({ dueMode: m })}
                                className={`px-2.5 py-1 rounded-[8px] text-[9px] font-black transition-colors ${block.dueMode === m ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-500 border border-indigo-100 hover:border-indigo-300'}`}>
                                {m === 'days' ? 'N일 후' : '필드 참조'}
                            </button>
                        ))}
                    </div>
                    {block.dueMode === 'days' ? (
                        <div className="flex items-center gap-2">
                            <input type="number" value={block.dueDays} onChange={e => onUpdate({ dueDays: e.target.value })} min={1}
                                className="w-16 bg-white border border-indigo-100 rounded-[9px] px-3 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-300" />
                            <span className="text-[10px] text-indigo-400 font-medium">일 후</span>
                        </div>
                    ) : (
                        <input type="text" value={block.deadlineRef} onChange={e => onUpdate({ deadlineRef: e.target.value })}
                            placeholder="입력 필드명 (예: 납부기한)"
                            className="w-full bg-white border border-indigo-100 rounded-[9px] px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-none focus:border-indigo-300" />
                    )}
                </div>
            </div>
        </div>
    );
}

function ApproveEditor({ block, idx, onUpdate, onRemove }: {
    block: ApproveBlock; idx: number;
    onUpdate: (p: Partial<ApproveBlock>) => void; onRemove: () => void;
}) {
    const setChain = (chain: { role: string }[]) => onUpdate({ approvalChain: chain });
    return (
        <div className="rounded-[18px] border border-violet-100 bg-violet-50/70 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-violet-100/80">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-violet-300">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">결재</span>
                </div>
                <button onClick={onRemove} className="p-0.5 text-violet-300 hover:text-red-500 transition-colors"><XCircle size={13} /></button>
            </div>
            <div className="p-3 space-y-2.5">
                <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-violet-400 mb-1 block">결재 제목</label>
                    <input type="text" value={block.title} onChange={e => onUpdate({ title: e.target.value })}
                        placeholder="예: 과태료 납부 승인"
                        className="w-full bg-white border border-violet-100 rounded-[9px] px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-none focus:border-violet-300" />
                </div>
                <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-violet-400 mb-1.5 block">결재선 (하→상)</label>
                    <div className="space-y-1.5">
                        {block.approvalChain.map((item, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black text-violet-300 w-4 text-right flex-shrink-0">{i + 1}.</span>
                                <input type="text" value={item.role}
                                    onChange={e => setChain(block.approvalChain.map((a, ai) => ai === i ? { role: e.target.value } : a))}
                                    placeholder="역할명"
                                    className="flex-1 bg-white border border-violet-100 rounded-[9px] px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-none focus:border-violet-300" />
                                <button onClick={() => setChain(block.approvalChain.filter((_, ai) => ai !== i))}
                                    className="p-0.5 text-violet-300 hover:text-red-500 transition-colors"><XCircle size={12} /></button>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setChain([...block.approvalChain, { role: '' }])}
                        className="mt-1.5 flex items-center gap-1 text-[10px] font-black text-violet-500 hover:text-violet-700 transition-colors">
                        <Plus size={10} /> 결재자 추가
                    </button>
                </div>
            </div>
        </div>
    );
}

function UpdateStatusEditor({ block, idx, onUpdate, onRemove }: {
    block: UpdateStatusBlock; idx: number;
    onUpdate: (p: Partial<UpdateStatusBlock>) => void; onRemove: () => void;
}) {
    return (
        <div className="rounded-[18px] border border-teal-100 bg-teal-50/70 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-teal-100/80">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-teal-300">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-teal-700">상태 변경</span>
                </div>
                <button onClick={onRemove} className="p-0.5 text-teal-300 hover:text-red-500 transition-colors"><XCircle size={13} /></button>
            </div>
            <div className="p-3">
                <label className="text-[9px] font-black uppercase tracking-widest text-teal-400 mb-2 block">변경할 상태 선택</label>
                <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map(v => (
                        <button key={v} onClick={() => onUpdate({ value: v })}
                            className={`px-3 py-1.5 rounded-[10px] text-[10px] font-black transition-all ${block.value === v ? STATUS_ACTIVE[v] : STATUS_INACTIVE[v]}`}>
                            {v}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── WorkflowEditModal ────────────────────────────────────────────────────────

function WorkflowEditModal({ workflow, onClose }: { workflow: any; onClose: () => void }) {
    const [label, setLabel] = useState(workflow.label || '');
    const [triggerTable, setTriggerTable] = useState(workflow.triggerTable || '');
    const [inputs, setInputs] = useState<string[]>(workflow.inputTypes || []);
    const [notify, setNotify] = useState<string[]>(Array.isArray(workflow.notify) ? workflow.notify : []);
    const [stages, setStages] = useState<EditStage[]>(() => buildStages(workflow));
    const [addingToStage, setAddingToStage] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    const patchBlock = (si: number, bi: number, patch: Partial<ActionBlock>) =>
        setStages(prev => prev.map((s, _si) => _si !== si ? s : {
            ...s, actions: s.actions.map((b, _bi) => _bi !== bi ? b : { ...b, ...patch } as ActionBlock)
        }));
    const removeBlock = (si: number, bi: number) =>
        setStages(prev => prev.map((s, _si) => _si !== si ? s : { ...s, actions: s.actions.filter((_, _bi) => _bi !== bi) }));
    const appendBlock = (si: number, block: ActionBlock) =>
        setStages(prev => prev.map((s, _si) => _si !== si ? s : { ...s, actions: [...s.actions, block] }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const originalRowIds = new Set((workflow.actions || []).map((a: any) => a.rowId).filter(Boolean));
            const retainedRowIds = new Set(stages.flatMap(s => s.actions).map(b => b.rowId).filter(Boolean));
            const actionsToRemove = [...originalRowIds].filter(id => !retainedRowIds.has(id)) as string[];
            const actionsToAdd = stages.flatMap((s, si) =>
                s.actions.filter(b => !b.rowId).map((b, pi) => ({
                    actionId: b.type, params: blockToParams(b), stage: si, position: pi,
                }))
            );
            await updateWorkflowFullAction(workflow.id, {
                label, inputTypes: inputs,
                triggerTable: triggerTable || null,
                notify, actionsToRemove, actionsToAdd,
            });
            onClose();
        } catch (e: any) {
            alert('저장 중 오류: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

                {/* Header — label inline editable */}
                <div className="px-8 pt-7 pb-5 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-widest text-purple-500 mb-1 block">워크플로우 편집</span>
                            <input value={label} onChange={e => setLabel(e.target.value)}
                                className="w-full text-lg font-black text-gray-900 tracking-tight bg-transparent border-0 border-b-2 border-gray-200 focus:border-purple-400 focus:outline-none pb-0.5" />
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 flex-shrink-0 mt-1">
                            <XCircle size={18} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 px-8 py-6 space-y-7">

                    {/* TriggerTable */}
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">트리거 테이블 (triggerTable)</label>
                        <input type="text" value={triggerTable} onChange={e => setTriggerTable(e.target.value)}
                            placeholder="이 워크플로우를 실행할 테이블명 (비워두면 매뉴얼 실행)"
                            className="w-full border border-gray-200 rounded-[12px] px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-purple-300" />
                    </div>

                    {/* Inputs + Notify */}
                    <div className="grid grid-cols-2 gap-5">
                        <TagEditor label="입력 필드 (inputs)" tags={inputs} placeholder="예: 납부기한"
                            onAdd={t => !inputs.includes(t) && setInputs([...inputs, t])}
                            onRemove={t => setInputs(inputs.filter(x => x !== t))}
                            chipClass="bg-blue-50 border-blue-100 text-blue-600" />
                        <TagEditor label="알림 역할 (notify)" tags={notify} placeholder="예: 경영지원팀 사원"
                            onAdd={t => !notify.includes(t) && setNotify([...notify, t])}
                            onRemove={t => setNotify(notify.filter(x => x !== t))}
                            chipClass="bg-amber-50 border-amber-100 text-amber-700" />
                    </div>

                    {/* Stages */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">실행 단계</span>
                            <span className="text-[9px] text-gray-300 font-medium">단계 간 순차 · 단계 내 병렬</span>
                        </div>

                        <div className="space-y-1">
                            {stages.map((stage, si) => (
                                <div key={si}>
                                    {/* Stage container */}
                                    <div className="rounded-[20px] border border-gray-100 bg-gray-50/60 overflow-hidden">
                                        {/* Stage header bar */}
                                        <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Stage {si + 1}</span>
                                                {stage.actions.length > 1 && (
                                                    <span className="text-[9px] bg-white/20 text-white/80 px-2 py-0.5 rounded-full font-bold">병렬 {stage.actions.length}개</span>
                                                )}
                                            </div>
                                            <button onClick={() => setStages(prev => prev.filter((_, _si) => _si !== si))}
                                                className="text-[9px] font-black text-white/40 hover:text-red-400 transition-colors uppercase tracking-widest">
                                                삭제
                                            </button>
                                        </div>

                                        {/* Blocks */}
                                        <div className="p-3 space-y-2">
                                            {stage.actions.length === 0 && (
                                                <div className="py-5 text-center text-[10px] text-gray-300 font-medium">액션 없음</div>
                                            )}
                                            {stage.actions.map((block, bi) => {
                                                const commonProps = { idx: bi, onRemove: () => removeBlock(si, bi) };
                                                if (block.type === 'create_task') return (
                                                    <CreateTaskEditor key={bi} block={block} {...commonProps}
                                                        onUpdate={p => patchBlock(si, bi, p)} />
                                                );
                                                if (block.type === 'approve') return (
                                                    <ApproveEditor key={bi} block={block} {...commonProps}
                                                        onUpdate={p => patchBlock(si, bi, p)} />
                                                );
                                                return (
                                                    <UpdateStatusEditor key={bi} block={block} {...commonProps}
                                                        onUpdate={p => patchBlock(si, bi, p)} />
                                                );
                                            })}

                                            {/* Type picker */}
                                            {addingToStage === si ? (
                                                <div className="mt-1 p-3 bg-white rounded-[14px] border border-gray-200">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">추가할 액션 선택</p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {BLOCK_TYPES.map(opt => (
                                                            <button key={opt.type}
                                                                onClick={() => { appendBlock(si, createDefaultBlock(opt.type)); setAddingToStage(null); }}
                                                                className={`p-2.5 rounded-[12px] border text-left transition-all bg-white ${opt.border} ${opt.bg}`}>
                                                                <div className={`text-[10px] font-black mb-0.5 ${opt.text}`}>{opt.label}</div>
                                                                <div className="text-[9px] text-gray-400">{opt.desc}</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <button onClick={() => setAddingToStage(null)}
                                                        className="mt-2 text-[9px] text-gray-400 hover:text-gray-600 font-black uppercase tracking-widest">취소</button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setAddingToStage(si)}
                                                    className="flex items-center gap-1 text-[10px] font-black text-gray-400 hover:text-gray-700 transition-colors mt-1 px-1">
                                                    <Plus size={11} /> 액션 추가
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Arrow between stages */}
                                    {si < stages.length - 1 && (
                                        <div className="flex justify-center py-1">
                                            <ChevronDown size={14} className="text-gray-300" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button onClick={() => setStages(prev => [...prev, { actions: [] }])}
                            className="mt-3 w-full py-3 border-2 border-dashed border-gray-200 rounded-[16px] text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-all flex items-center justify-center gap-1.5">
                            <Plus size={12} /> 단계 추가
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-gray-100 flex gap-3 flex-shrink-0">
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-3.5 bg-gray-900 text-white rounded-[18px] font-black text-[12px] uppercase tracking-[0.15em] shadow-xl shadow-gray-200 hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        저장
                    </button>
                    <button onClick={onClose}
                        className="px-7 py-3.5 bg-white border border-gray-100 text-gray-400 rounded-[18px] font-black text-[12px] uppercase tracking-[0.15em] hover:bg-gray-50 transition-all">
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
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
    const [editOpen, setEditOpen] = useState(false);

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
                            onClick={() => setEditOpen(true)}
                            disabled={!!processing}
                            className="px-6 py-4 bg-white border border-gray-100 text-gray-400 rounded-[20px] font-black text-[12px] uppercase tracking-[0.2em] hover:text-purple-600 hover:border-purple-100 hover:bg-purple-50 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Pencil size={18} />
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
                    <>
                        <button
                            onClick={() => setEditOpen(true)}
                            disabled={!!processing}
                            className="flex-1 py-4 bg-white border border-gray-100 text-gray-500 rounded-[20px] font-black text-[12px] uppercase tracking-[0.2em] hover:text-purple-600 hover:border-purple-100 hover:bg-purple-50 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Pencil size={16} />
                            편집
                        </button>
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
                    </>
                )}
            </div>

            {editOpen && (
                <WorkflowEditModal
                    workflow={workflow}
                    onClose={() => setEditOpen(false)}
                />
            )}
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
