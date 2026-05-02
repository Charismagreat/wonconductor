'use client';

import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    Trash2, 
    Settings2, 
    ShieldAlert, 
    ShieldCheck, 
    Info, 
    AlertCircle,
    ChevronRight,
    Search,
    Save,
    X,
    Users as UsersIcon,
    Sparkles,
    Loader2
} from 'lucide-react';
import { 
    getGuardrailRulesAction, 
    saveGuardrailRuleAction, 
    deleteGuardrailRuleAction 
} from '@/app/actions/guardrail';
import { updateReportUiConfigAction } from '@/app/actions/report';
import { ReportAccessManager } from './ReportAccessManager';

interface GuardrailSettingsClientProps {
    reports: any[];
    initialRules: any[];
}

export default function GuardrailSettingsClient({ reports, initialRules }: GuardrailSettingsClientProps) {
    const [selectedReportId, setSelectedReportId] = useState<string | null>(reports[0]?.id || null);
    const [rules, setRules] = useState(initialRules);
    const [localReports, setLocalReports] = useState(reports);
    const [isSaving, setIsSaving] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'rules' | 'permissions' | 'ai'>('rules');

    // Selected Report context
    const selectedReport = localReports.find(r => r.id === selectedReportId);
    const reportRules = rules.filter(r => r.reportId === selectedReportId);

    // Parse columns from report schema (assuming it's JSON)
    const columns = React.useMemo(() => {
        if (!selectedReport?.schema) return [];
        try {
            const schema = typeof selectedReport.schema === 'string' 
                ? JSON.parse(selectedReport.schema) 
                : selectedReport.schema;
            return Array.isArray(schema) ? schema : schema.columns || [];
        } catch (e) {
            return [];
        }
    }, [selectedReport]);

    const handleAddRule = () => {
        setEditingRule({
            reportId: selectedReportId,
            columnName: columns[0]?.name || '',
            ruleType: 'RANGE',
            ruleValue: '',
            severity: 'BLOCK',
            errorMessage: '입력 조건에 해당하지 않아 처리가 제한되었습니다.',
            adminAdvice: '데이터 정밀 확인 및 예외 승인 여부를 검토하세요.'
        });
        setIsModalOpen(true);
    };

    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await saveGuardrailRuleAction(editingRule);
            const updatedRules = await getGuardrailRulesAction();
            setRules(updatedRules);
            setIsModalOpen(false);
            setEditingRule(null);
        } catch (err) {
            alert('규칙 저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm('정말로 이 규칙을 삭제하시겠습니까?')) return;
        try {
            await deleteGuardrailRuleAction(id);
            setRules(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            alert('삭제 실패');
        }
    };

    return (
        <div className="flex gap-8 min-h-[600px]">
            {/* 1. Sidebar: Report List */}
            <div className="w-80 space-y-4">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Reports</h3>
                        <div className="p-1.5 bg-slate-100 rounded-lg">
                            <Search size={14} className="text-slate-400" />
                        </div>
                    </div>
                    <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                        {localReports.map((report) => (
                            <button
                                key={report.id}
                                onClick={() => setSelectedReportId(report.id)}
                                className={`w-full p-4 text-left flex items-center justify-between group transition-all ${
                                    selectedReportId === report.id 
                                    ? 'bg-blue-50/50 border-l-4 border-blue-600' 
                                    : 'hover:bg-slate-50'
                                }`}
                            >
                                <div className="min-w-0">
                                    <p className={`text-xs font-black truncate uppercase tracking-tight ${
                                        selectedReportId === report.id ? 'text-blue-600' : 'text-slate-900'
                                    }`}>
                                        {report.name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-bold truncate">
                                        {report.tableName}
                                    </p>
                                </div>
                                <ChevronRight 
                                    size={14} 
                                    className={`transition-transform ${
                                        selectedReportId === report.id ? 'text-blue-600 translate-x-1' : 'text-slate-200'
                                    }`} 
                                />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 2. Main Content: Rules List */}
            <div className="flex-1 space-y-6">
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-10 min-h-full relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                                <Settings2 className="text-blue-600" size={24} />
                                {selectedReport?.name}
                            </h2>
                            <div className="flex items-center gap-4 mt-3">
                                <button 
                                    onClick={() => setActiveTab('rules')}
                                    className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${
                                        activeTab === 'rules' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    Rules Configuration
                                </button>
                                <button 
                                    onClick={() => setActiveTab('permissions')}
                                    className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${
                                        activeTab === 'permissions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    Input Permissions
                                </button>
                                <button 
                                    onClick={() => setActiveTab('ai' as any)}
                                    className={`text-[11px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${
                                        activeTab === 'ai' as any ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    AI Analysis Rules
                                </button>
                            </div>
                        </div>
                        {activeTab === 'rules' && (
                            <button 
                                onClick={handleAddRule}
                                className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 flex items-center gap-2 transition-all active:scale-95"
                            >
                                <Plus size={16} /> New Rule
                            </button>
                        )}
                    </div>

                    <div className="mt-8 transition-all animate-in fade-in slide-in-from-top-4 duration-500">
                        {activeTab === 'rules' ? (
                            <>
                                {reportRules.length === 0 ? (
                                    <div className="py-20 text-center space-y-4">
                                        <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto text-slate-200">
                                            <ShieldCheck size={40} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">설정된 가드레일이 없습니다.</p>
                                            <p className="text-[10px] text-slate-300 font-bold mt-1 uppercase">이 테이블은 현재 모든 입력을 허용합니다.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {reportRules.map((rule) => (
                                            <div key={rule.id} className="group bg-white border border-slate-100 rounded-3xl p-6 hover:shadow-xl hover:border-blue-500/20 transition-all shadow-sm">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className={`p-3 rounded-2xl ${rule.severity === 'BLOCK' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                                        <ShieldAlert size={20} />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => { setEditingRule(rule); setIsModalOpen(true); }}
                                                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                                        >
                                                            <Settings2 size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteRule(rule.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase tracking-wider">
                                                            {rule.columnName}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                            {rule.ruleType}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-black text-slate-900 leading-tight">
                                                        {rule.severity === 'BLOCK' ? '🔴 입력 차단' : '🟡 검토 보류'} - {rule.ruleValue}
                                                    </h4>
                                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 italic">
                                                        <p className="text-[10px] text-slate-500 font-medium">
                                                            "{rule.errorMessage}"
                                                        </p>
                                                    </div>
                                                    <div className="pt-2 flex items-center gap-1.5 text-blue-600">
                                                        <Info size={12} />
                                                        <p className="text-[9px] font-black uppercase tracking-tight">AI ADVICE: {rule.adminAdvice.length > 30 ? rule.adminAdvice.substring(0, 30) + '...' : rule.adminAdvice}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : activeTab === 'permissions' ? (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                <ReportAccessManager 
                                    reportId={selectedReportId!} 
                                    ownerId={selectedReport?.ownerId} 
                                />
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="space-y-8">
                                    <div className="flex items-center gap-3 p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50">
                                        <Sparkles className="text-blue-600" size={24} />
                                        <div>
                                            <p className="text-xs font-black text-blue-900 uppercase tracking-tight">AI ANALYSIS RULES</p>
                                            <p className="text-[10px] text-blue-700/70 font-bold uppercase mt-0.5">이 테이블에 적용되는 지능형 데이터 추출 규칙을 설정합니다.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {[
                                            { 
                                                id: 'excludeSelf', 
                                                title: '본인 제외 규칙 (Exclude Self)', 
                                                desc: "'애월삼춘', '원컨덕터' 등 본인 회사를 거래처로 인식하지 않고 무시합니다.",
                                                icon: <UsersIcon size={18} />
                                            },
                                            { 
                                                id: 'providerPriority', 
                                                title: '공급자 우선 규칙 (Provider Priority)', 
                                                desc: "문서 내 공급자 정보 박스(도장 찍힌 영역)를 최우선 분석 대상으로 삼습니다.",
                                                icon: <Plus size={18} />
                                            },
                                            { 
                                                id: 'dualFactorMatching', 
                                                title: '이중 검증 매칭 (Dual-Factor Matching)', 
                                                desc: "사업자등록번호와 상호를 동시에 대조하여 거래처ID의 정확도를 극대화합니다.",
                                                icon: <ShieldCheck size={18} />
                                            },
                                            { 
                                                id: 'autoCreateMaster', 
                                                title: '마스터 자동 생성 (Auto-Create Master)', 
                                                desc: "매칭되는 거래처나 제품이 마스터 테이블에 없을 경우 AI가 자동으로 신규 등록합니다.",
                                                icon: <Plus size={18} />
                                            }
                                        ].map(rule => {
                                            const uiConfig = (() => {
                                                try { return JSON.parse(selectedReport?.uiConfig || '{}'); } catch(e) { return {}; }
                                            })();
                                            const aiRules = uiConfig.aiRules || {};
                                            const isActive = !!aiRules[rule.id];

                                            return (
                                                <button 
                                                    key={rule.id}
                                                    onClick={async () => {
                                                        const newAiRules = { ...aiRules, [rule.id]: !isActive };
                                                        const newConfig = { ...uiConfig, aiRules: newAiRules };
                                                        
                                                        // 로컬 상태 즉시 업데이트 (Optimistic UI)
                                                        setLocalReports(prev => prev.map(r => 
                                                            r.id === selectedReportId 
                                                                ? { ...r, uiConfig: JSON.stringify(newConfig) } 
                                                                : r
                                                        ));

                                                        // 서버 저장 (배경에서 실행)
                                                        try {
                                                            await updateReportUiConfigAction(selectedReportId!, { aiRules: newAiRules });
                                                        } catch (error) {
                                                            console.error('Failed to save AI rules:', error);
                                                            // 실패 시 롤백 (선택 사항)
                                                        }
                                                    }}
                                                    className={`group w-full flex items-center justify-between p-6 rounded-3xl border transition-all text-left ${
                                                        isActive ? 'bg-white border-blue-500 shadow-xl shadow-blue-500/5' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-5">
                                                        <div className={`p-4 rounded-2xl transition-all ${
                                                            isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-slate-400'
                                                        }`}>
                                                            {rule.icon}
                                                        </div>
                                                        <div>
                                                            <h4 className={`text-sm font-black tracking-tight ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                                                                {rule.title}
                                                            </h4>
                                                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase leading-relaxed">
                                                                {rule.desc}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-14 h-8 rounded-full p-1 transition-all ${isActive ? 'bg-blue-600' : 'bg-slate-200'}`}>
                                                        <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Rule Editor Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="bg-white w-full max-w-xl rounded-[48px] shadow-2xl relative z-10 overflow-hidden border border-slate-100 scale-in-center">
                        <div className="flex items-center justify-between p-10 border-b border-slate-50 bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                                    <ShieldAlert className="text-blue-600" size={24} />
                                    Rule Editor
                                </h3>
                                <p className="text-xs text-slate-400 font-bold mt-1">입력 제한 조건을 상세 설정합니다.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white text-slate-400 hover:text-slate-900 rounded-2xl shadow-sm transition-all border border-slate-100">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSaveRule} className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Column</label>
                                    <select 
                                        value={editingRule.columnName}
                                        onChange={(e) => setEditingRule({...editingRule, columnName: e.target.value})}
                                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        {columns.map((col: any) => (
                                            <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Rule Type</label>
                                    <select 
                                        value={editingRule.ruleType}
                                        onChange={(e) => setEditingRule({...editingRule, ruleType: e.target.value})}
                                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="RANGE">범위 체크 (Range)</option>
                                        <option value="REGEX">형식 체크 (Regex)</option>
                                        <option value="MUST_MATCH">정확히 일치 (Exact)</option>
                                        <option value="FORBIDDEN">금지어 확인 (Forbidden)</option>
                                        <option value="DUPLICATE">중복 체크 (Duplicate)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Condition Value</label>
                                <input 
                                    type="text"
                                    value={editingRule.ruleValue}
                                    onChange={(e) => setEditingRule({...editingRule, ruleValue: e.target.value})}
                                    placeholder="예: 5000000 (숫자) 또는 ^[0-9]{10}$ (정규식)"
                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20"
                                />
                                <p className="text-[9px] text-slate-400 pl-1 font-medium">검증의 기준이 될 값을 입력하세요.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Severity & Logic</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setEditingRule({...editingRule, severity: 'BLOCK'})}
                                        className={`flex items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${
                                            editingRule.severity === 'BLOCK' ? 'bg-red-50 border-red-500 text-red-600 shadow-lg shadow-red-500/10' : 'bg-white border-slate-100 text-slate-400'
                                        }`}
                                    >
                                        <AlertCircle size={16} /> BLOCK (차단)
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setEditingRule({...editingRule, severity: 'WARN'})}
                                        className={`flex items-center justify-center gap-2 py-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${
                                            editingRule.severity === 'WARN' ? 'bg-amber-50 border-amber-500 text-amber-600 shadow-lg shadow-amber-500/10' : 'bg-white border-slate-100 text-slate-400'
                                        }`}
                                    >
                                        <Info size={16} /> WARN (경보)
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Error Message (For Employee)</label>
                                <textarea 
                                    value={editingRule.errorMessage}
                                    onChange={(e) => setEditingRule({...editingRule, errorMessage: e.target.value})}
                                    rows={2}
                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 resize-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">AI Recommendation (For Admin)</label>
                                <textarea 
                                    value={editingRule.adminAdvice}
                                    onChange={(e) => setEditingRule({...editingRule, adminAdvice: e.target.value})}
                                    rows={2}
                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 resize-none"
                                />
                            </div>
                        </form>

                        <div className="p-10 bg-slate-50/50 border-t border-slate-50 flex gap-4">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveRule}
                                disabled={isSaving}
                                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                                Save Guardrail
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

