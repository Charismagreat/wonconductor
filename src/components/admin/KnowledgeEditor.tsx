'use client';

import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Brain, 
    CheckCircle, 
    AlertCircle, 
    History, 
    ChevronRight, 
    Loader2,
    ShieldAlert,
    Database,
    Zap
} from 'lucide-react';
import { 
    getKnowledgeListAction, 
    proposeAIKnowledgeAction, 
    approveKnowledgeAction 
} from '@/app/actions/knowledge';

interface KnowledgeEditorProps {
    initialTargetId?: string;
    initialTargetType?: 'PHYSICAL' | 'VIRTUAL';
}

/**
 * 프로젝트 디자인 스타일에 맞춘 간이 Badge 컴포넌트
 */
function LocalBadge({ children, variant = 'default', className = '' }: { children: React.ReactNode, variant?: 'default' | 'destructive' | 'outline' | 'green', className?: string }) {
    const variants = {
        default: 'bg-slate-900 text-white border-transparent',
        destructive: 'bg-red-50 text-red-600 border-red-100',
        outline: 'bg-white text-slate-400 border-slate-100',
        green: 'bg-emerald-600 text-white border-transparent',
        blue: 'bg-blue-600 text-white border-transparent',
        purple: 'bg-purple-600 text-white border-transparent'
    };
    return (
        <span className={`px-2 py-0.5 border rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
}

export default function KnowledgeEditor({ initialTargetId, initialTargetType = 'PHYSICAL' }: KnowledgeEditorProps) {
    const [tableList, setTableList] = useState<{ physical: any[], view: any[] }>({ physical: [], view: [] });
    const [selectedTarget, setSelectedTarget] = useState({ id: initialTargetId || '', type: initialTargetType });
    const [knowledge, setKnowledge] = useState<any>(null);
    const [proposal, setProposal] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'schema' | 'rules' | 'diff'>('general');
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'PHYSICAL' | 'VIEW'>('ALL');

    // 1. 전체 테이블 목록 로드
    useEffect(() => {
        const fetchList = async () => {
            setLoading(true);
            try {
                const res = await getKnowledgeListAction();
                if (res.success) {
                    setTableList(res.data);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchList();
    }, []);

    // 2. 타겟 선택 시 지식 정보 로드
    const handleSelect = async (id: string, type: 'PHYSICAL' | 'VIRTUAL') => {
        setSelectedTarget({ id, type });
        setLoading(true);
        const res = await getKnowledgeListAction();
        if (res.success) {
            const existing = res.data.knowledge.find((k: any) => k.target_id === id && k.target_type === type);
            setKnowledge(existing || {
                target_id: id,
                target_type: type,
                description: '',
                category: 'General',
                insight: '',
                schema_info: '[]',
                ai_rules: '[]'
            });
            setProposal(null);
            setActiveTab('general');
        }
        setLoading(false);
    };

    const handleProposeAI = async () => {
        if (!selectedTarget.id) return;
        setLoading(true);
        try {
            const res = await proposeAIKnowledgeAction(selectedTarget.id, selectedTarget.type);
            if (res.success) {
                setProposal(res.data);
                setActiveTab('diff');
            }
        } catch (e) {
            alert('AI 분석 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!proposal) return;
        setLoading(true);
        try {
            const res = await approveKnowledgeAction(proposal.id, proposal);
            if (res.success) {
                alert('지식이 성공적으로 업데이트되었습니다.');
                setKnowledge(proposal);
                setProposal(null);
                setActiveTab('general');
            }
        } catch (e) {
            alert('승인 처리 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 필터링된 목록
    const filteredPhysical = tableList.physical.filter(t => t.id.toLowerCase().includes(search.toLowerCase()) || (t.name && t.name.toLowerCase().includes(search.toLowerCase())));
    const filteredViews = tableList.view.filter(t => t.id.toLowerCase().includes(search.toLowerCase()) || (t.name && t.name.toLowerCase().includes(search.toLowerCase())));

    return (
        <div className="flex flex-col gap-10 min-h-screen pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600 rounded-[20px] text-white shadow-xl shadow-blue-500/20">
                            <Brain size={24} />
                        </div>
                        AI Guardrail Center
                    </h1>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-2 ml-1">
                        Intelligence governance & Knowledge base management
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleProposeAI} 
                        disabled={loading || !selectedTarget.id}
                        className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-blue-600" />}
                        AI Profiling
                    </button>
                    <button 
                        onClick={handleApprove} 
                        disabled={loading || !proposal}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Final Approve
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-10 items-start">
                {/* 1. Sidebar: Table List */}
                <div className="w-full lg:w-80 space-y-6 shrink-0">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col max-h-[800px]">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/50 space-y-4">
                            <div className="flex p-1 bg-white border border-slate-100 rounded-xl">
                                {[
                                    { id: 'ALL', label: 'All' },
                                    { id: 'PHYSICAL', label: 'Tables' },
                                    { id: 'VIEW', label: 'Views' }
                                ].map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => setFilterType(f.id as any)}
                                        className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${filterType === f.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <input 
                                    placeholder="SEARCH..." 
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1 divide-y divide-slate-50 custom-scrollbar">
                            {loading && tableList.physical.length === 0 && (
                                <div className="p-10 text-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Loading Sources...</p>
                                </div>
                            )}

                            {!loading && filteredPhysical.length === 0 && filteredViews.length === 0 && (
                                <div className="p-10 text-center">
                                    <AlertCircle className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Tables Found</p>
                                </div>
                            )}

                            {(filterType === 'ALL' || filterType === 'PHYSICAL') && filteredPhysical.length > 0 && (
                                <>
                                    <div className="px-6 py-4 bg-slate-50/30 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Database size={10} /> Physical Tables
                                    </div>
                                    {filteredPhysical.map(t => (
                                        <button 
                                            key={t.id} 
                                            onClick={() => handleSelect(t.id, 'PHYSICAL')}
                                            className={`w-full px-6 py-5 text-left transition-all group flex items-center justify-between ${selectedTarget.id === t.id ? 'bg-blue-50/50 border-l-4 border-blue-600' : 'hover:bg-slate-50'}`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <div className={`text-xs font-black truncate uppercase tracking-tight ${selectedTarget.id === t.id ? 'text-blue-600' : 'text-slate-900'}`}>{t.name || t.id}</div>
                                                    <LocalBadge variant="blue" className="scale-[0.7] origin-left">Table</LocalBadge>
                                                    {t.isProtected && <LocalBadge variant="green" className="scale-[0.7] origin-left">Protected</LocalBadge>}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-bold font-mono">{t.id}</div>
                                            </div>
                                            <ChevronRight size={14} className={`transition-all ${selectedTarget.id === t.id ? 'text-blue-600 translate-x-1' : 'text-slate-200 group-hover:text-slate-400'}`} />
                                        </button>
                                    ))}
                                </>
                            )}

                            {(filterType === 'ALL' || filterType === 'VIEW') && filteredViews.length > 0 && (
                                <>
                                    <div className="px-6 py-4 bg-slate-50/30 text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4 flex items-center gap-2">
                                        <Zap size={10} className="text-indigo-500" /> Table Views
                                    </div>
                                    {filteredViews.map(t => (
                                        <button 
                                            key={t.id} 
                                            onClick={() => handleSelect(t.id, 'VIRTUAL')}
                                            className={`w-full px-6 py-5 text-left transition-all group flex items-center justify-between ${selectedTarget.id === t.id ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : 'hover:bg-slate-50'}`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <div className={`text-xs font-black truncate uppercase tracking-tight ${selectedTarget.id === t.id ? 'text-indigo-600' : 'text-slate-900'}`}>{t.name || t.id}</div>
                                                    <LocalBadge variant="purple" className="scale-[0.7] origin-left">View</LocalBadge>
                                                    {t.isProtected && <LocalBadge variant="green" className="scale-[0.7] origin-left">Protected</LocalBadge>}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-bold font-mono">{t.id}</div>
                                            </div>
                                            <ChevronRight size={14} className={`transition-all ${selectedTarget.id === t.id ? 'text-indigo-600 translate-x-1' : 'text-slate-200 group-hover:text-slate-400'}`} />
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Main Editor Area */}
                <div className="flex-1 w-full min-h-[700px]">
                    {!selectedTarget.id ? (
                        <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-[40px] border border-slate-100 shadow-sm p-20 text-center">
                            <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mb-8 animate-pulse">
                                <Database className="w-10 h-10 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-black text-slate-300 uppercase tracking-tight">Select Target to Manage Knowledge</h3>
                            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">목록에서 테이블을 선택하여 AI 컨텍스트와 보안 규칙을 설정하세요.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden min-h-full flex flex-col relative">
                            {/* Tabs Navigation */}
                            <div className="flex border-b border-slate-50 bg-slate-50/30 px-10 pt-6 gap-8">
                                {[
                                    { id: 'general', label: 'General Info' },
                                    { id: 'schema', label: 'Schema Mapping' },
                                    { id: 'rules', label: 'Guardrail Rules' },
                                    { id: 'diff', label: 'AI Comparison', disabled: !proposal }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        disabled={tab.disabled}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`pb-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${tab.disabled ? 'opacity-30 cursor-not-allowed' : ''} ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {tab.label}
                                        {tab.id === 'diff' && proposal && <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block animate-ping" />}
                                    </button>
                                ))}
                            </div>

                            <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
                                {/* Tab: General */}
                                {activeTab === 'general' && (
                                    <div className="space-y-10 animate-in fade-in duration-500">
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Category</label>
                                                <input 
                                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                                                    value={knowledge?.category || ''}
                                                    onChange={(e) => setKnowledge({ ...knowledge, category: e.target.value })}
                                                    placeholder="e.g. FINANCE, HR, LOGISTICS"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Display Name</label>
                                                <input 
                                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                                                    value={knowledge?.displayName || ''}
                                                    onChange={(e) => setKnowledge({ ...knowledge, displayName: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Table Usage & Definition (Markdown)</label>
                                            <textarea 
                                                className="w-full h-48 bg-slate-50 border-none rounded-3xl px-6 py-5 text-xs font-medium leading-relaxed text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none resize-none"
                                                value={knowledge?.description || ''}
                                                onChange={(e) => setKnowledge({ ...knowledge, description: e.target.value })}
                                                placeholder="Describe what this table represents in business terms..."
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Business Insight & Analysis Tips</label>
                                            <textarea 
                                                className="w-full h-32 bg-blue-50/30 border border-blue-100/50 rounded-3xl px-6 py-5 text-xs font-medium leading-relaxed text-blue-900 focus:ring-2 focus:ring-blue-500/10 transition-all outline-none resize-none italic"
                                                value={knowledge?.insight || ''}
                                                onChange={(e) => setKnowledge({ ...knowledge, insight: e.target.value })}
                                                placeholder="Tips for AI to interpret the data correctly..."
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Tab: Schema */}
                                {activeTab === 'schema' && (
                                    <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50/50 border-b border-slate-50">
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Column Key</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Business Alias</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {(function() {
                                                        try {
                                                            const currentSchema = JSON.parse(knowledge?.schema_info || '[]');
                                                            const proposedSchema = proposal ? JSON.parse(proposal.schema_info || '[]') : [];
                                                            const displaySchema = currentSchema.length > 0 ? currentSchema : proposedSchema;
                                                            
                                                            if (displaySchema.length === 0) return (
                                                                <tr>
                                                                    <td colSpan={3} className="px-8 py-20 text-center">
                                                                        <div className="flex flex-col items-center gap-3">
                                                                            <Brain className="w-8 h-8 text-slate-200" />
                                                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Schema Defined. Run AI Profiling.</p>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );

                                                            return displaySchema.map((col: any, idx: number) => (
                                                                <tr key={idx} className="hover:bg-slate-50/30 transition-colors group">
                                                                    <td className="px-8 py-4">
                                                                        <span className="text-[10px] font-black font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{col.name}</span>
                                                                    </td>
                                                                    <td className="px-8 py-4">
                                                                        <input 
                                                                            className="w-full bg-transparent border-none p-0 text-xs font-bold text-slate-900 focus:ring-0 outline-none"
                                                                            defaultValue={col.displayName}
                                                                        />
                                                                    </td>
                                                                    <td className="px-8 py-4">
                                                                        <input 
                                                                            className="w-full bg-transparent border-none p-0 text-xs font-medium text-slate-400 focus:ring-0 outline-none"
                                                                            defaultValue={col.description}
                                                                        />
                                                                    </td>
                                                                </tr>
                                                            ));
                                                        } catch(e) {
                                                            return <tr><td colSpan={3} className="p-10 text-center text-[10px] font-bold text-red-400 uppercase">Schema parsing error</td></tr>;
                                                        }
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Tab: Rules */}
                                {activeTab === 'rules' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                        <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
                                            <ShieldAlert size={120} className="absolute -right-4 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                                            <div className="relative z-10">
                                                <h4 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 mb-2">
                                                    <ShieldAlert size={18} />
                                                    Hard-Enforced Guardrails
                                                </h4>
                                                <p className="text-[11px] font-bold opacity-80 uppercase leading-relaxed max-w-xl">
                                                    이곳에서 설정한 규칙은 AI가 데이터를 조회할 때 백엔드 엔진에서 물리적으로 적용됩니다. 
                                                    민감 정보 마스킹이나 특정 컬럼 접근 차단을 설정하세요.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex gap-4">
                                                <input 
                                                    placeholder="ADD NEW RULE... (e.g. Mask account_number)" 
                                                    className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-blue-500/20 outline-none" 
                                                />
                                                <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-900/10">Add</button>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 gap-4">
                                                {(function() {
                                                    try {
                                                        const rules = JSON.parse(knowledge?.ai_rules || '[]');
                                                        if (rules.length === 0) return <div className="py-10 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">No active rules defined</div>;
                                                        return rules.map((rule: any, idx: number) => (
                                                            <div key={idx} className="bg-white border border-slate-100 p-6 rounded-3xl flex justify-between items-center group hover:shadow-xl transition-all">
                                                                <div className="flex items-center gap-4">
                                                                    <LocalBadge variant={rule.type === 'mask' ? 'green' : 'destructive'}>{rule.type}</LocalBadge>
                                                                    <div>
                                                                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">
                                                                            {rule.column} <span className="text-slate-400 mx-2">→</span> {rule.pattern || 'FULL'} {rule.type === 'mask' ? 'MASKING' : 'BLOCKING'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <button className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><AlertCircle size={18} /></button>
                                                            </div>
                                                        ));
                                                    } catch(e) { return null; }
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tab: Diff View */}
                                {activeTab === 'diff' && (
                                    <div className="animate-in fade-in zoom-in-95 duration-500">
                                        <div className="grid grid-cols-2 gap-10 min-h-[500px]">
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between pb-4 border-b border-slate-50">
                                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                        <History size={14} /> Current Status
                                                    </h3>
                                                    <LocalBadge variant="outline">Active</LocalBadge>
                                                </div>
                                                <div className="bg-slate-50/50 rounded-3xl p-8 space-y-6 opacity-60">
                                                    <h4 className="text-lg font-black text-slate-900">{knowledge?.displayName || selectedTarget.id}</h4>
                                                    <div className="text-[11px] font-medium leading-relaxed text-slate-500 whitespace-pre-wrap">{knowledge?.description || 'No description yet.'}</div>
                                                </div>
                                            </div>
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between pb-4 border-b border-blue-50">
                                                    <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                                        <Brain size={14} /> AI Recommendation
                                                    </h3>
                                                    <LocalBadge variant="green">95% Confidence</LocalBadge>
                                                </div>
                                                <div className="bg-blue-50/30 border border-blue-100/50 rounded-3xl p-8 space-y-6 shadow-xl shadow-blue-500/5">
                                                    <h4 className="text-lg font-black text-blue-900">{proposal?.displayName || selectedTarget.id}</h4>
                                                    <div className="text-[11px] font-medium leading-relaxed text-blue-900/70 whitespace-pre-wrap">{proposal?.description}</div>
                                                    <div className="pt-6 border-t border-blue-100/50">
                                                        <p className="text-[9px] font-black text-blue-600 uppercase mb-2">AI Reasoning:</p>
                                                        <p className="text-[10px] font-bold text-blue-900 italic leading-relaxed mb-6">"{proposal?.insight}"</p>
                                                        
                                                        <p className="text-[9px] font-black text-blue-600 uppercase mb-3">Proposed Schema Mapping:</p>
                                                        <div className="space-y-2">
                                                            {(function() {
                                                                try {
                                                                    const schema = JSON.parse(proposal?.schema_info || '[]');
                                                                    return schema.map((col: any, i: number) => (
                                                                        <div key={i} className="flex items-center gap-3 bg-white/50 p-3 rounded-xl border border-blue-100/30">
                                                                            <span className="text-[9px] font-black font-mono text-blue-600 bg-blue-100/50 px-2 py-1 rounded-md">{col.name}</span>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-[10px] font-black text-blue-900 truncate uppercase">{col.displayName}</p>
                                                                                <p className="text-[9px] font-medium text-blue-600/60 truncate italic">{col.description}</p>
                                                                            </div>
                                                                        </div>
                                                                    ));
                                                                } catch(e) { return null; }
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Scrollbar Styles */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
}
