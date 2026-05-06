'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Rocket, 
    CheckCircle2, 
    Building2, 
    Sparkles, 
    ArrowRight, 
    Database, 
    LayoutDashboard,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { createScaffoldTableAction, checkSetupRequiredAction } from '@/app/actions/setup';

export default function SetupPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    
    React.useEffect(() => {
        const checkSetup = async () => {
            const isRequired = await checkSetupRequiredAction();
            if (!isRequired) {
                router.push('/');
            }
        };
        checkSetup();
    }, []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        companyName: '',
        logoUrl: '',
        themeColor: '#2563eb',
        businessContext: '',
        adminUsername: '',
        adminPassword: ''
    });

    const [aiSchema, setAiSchema] = useState<any>(null);
    const [suggestedTableName, setSuggestedTableName] = useState('');
    const [tableCreated, setTableCreated] = useState(false);

    const handleAnalyzeExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError('');
        const formDataPayload = new FormData();
        formDataPayload.append('file', file);

        try {
            const apiUrl = window.location.pathname.replace(/\/setup\/?$/, '/api/setup/analyze-excel');
            const res = await fetch(apiUrl, {
                method: 'POST',
                body: formDataPayload
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setAiSchema(data.schema);
            setSuggestedTableName(data.tableName);
            setStep(4); // Move to review step
        } catch (err: any) {
            setError('엑셀 분석 중 오류가 발생했습니다: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateScaffold = async () => {
        if (!suggestedTableName || !aiSchema) return;
        
        setLoading(true);
        setError('');
        
        try {
            const res = await createScaffoldTableAction(suggestedTableName, aiSchema);
            if (!res.success) throw new Error(res.error);
            
            setTableCreated(true);
            setStep(3); // To Summary
        } catch (err: any) {
            setError('테이블 생성 중 오류가 발생했습니다: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInitialize = async () => {
        setLoading(true);
        setError('');
        
        try {
            const apiUrl = window.location.pathname.replace(/\/setup\/?$/, '/api/setup/initialize');
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Initialization failed');

            router.push('/');
            router.refresh();
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] overflow-hidden">
            {/* Header / Logo */}
            <div className="mb-12 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="bg-primary p-3 rounded-2xl text-white shadow-xl shadow-primary/30">
                    <Rocket size={32} />
                </div>
                <h1 className="text-3xl font-black tracking-tighter text-slate-900 italic">EGDesk SETUP</h1>
            </div>

            <main className="w-full max-w-xl bg-white border border-slate-100 rounded-[48px] shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in zoom-in duration-500">
                {/* Progress Bar */}
                <div className="flex h-1.5 w-full bg-slate-100">
                    <div 
                        className="bg-primary transition-all duration-500" 
                        style={{ width: `${(step / 4) * 100}%` }}
                    />
                </div>

                <div className="p-12 space-y-8">
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">회사의 이름을 알려주세요</h2>
                                <p className="text-sm text-slate-400 font-medium leading-relaxed">준비된 기업 환경에서 당신의 비즈니스를 시작해 보세요.</p>
                            </div>
                            
                            <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-primary tracking-widest pl-1">COMPANY NAME</label>
                                    <input 
                                        type="text"
                                        placeholder="예: 원컨덕터 (OneConductor)"
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary font-bold placeholder:text-slate-300 transition-all"
                                        value={formData.companyName}
                                        onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={() => setStep(2)}
                                disabled={!formData.companyName}
                                className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary transition-all active:scale-95 disabled:opacity-30"
                            >
                                NEXT STEP <ArrowRight size={20} />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">시스템을 어떻게 시작할까요?</h2>
                                <p className="text-sm text-slate-400 font-medium leading-relaxed">준비된 데이터를 연결하거나, 업종별 전문 템플릿으로 즉시 시작하세요.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {/* Option 1: AI Analytics */}
                                <div 
                                    className="flex items-center gap-6 border-2 border-slate-100 rounded-[32px] p-6 hover:border-primary/30 transition-all group cursor-pointer relative"
                                    onClick={() => { /* This trigger handled by input file below */ }}
                                >
                                    <input 
                                        type="file" 
                                        accept=".xlsx, .xls, .csv"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleAnalyzeExcel}
                                    />
                                    <div className="bg-slate-50 p-4 rounded-2xl text-slate-300 group-hover:text-primary group-hover:bg-primary/10 transition-all">
                                        <Database size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-black text-slate-900">기본 데이터 연결 (Excel/CSV)</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">AI가 파일 구조를 분석하여 테이블을 구축합니다</p>
                                    </div>
                                    <ChevronRight className="text-slate-200 group-hover:text-primary transition-all" />
                                </div>

                                {/* Option 2: Full Industry Suite (Demo Mode) */}
                                <div 
                                    className="flex items-center gap-6 border-2 border-slate-100 rounded-[32px] p-6 hover:border-primary/30 transition-all group cursor-pointer"
                                    onClick={async () => {
                                        setLoading(true);
                                        try {
                                            const { initializeDemoSetupAction } = await import('@/lib/services/demo-service');
                                            await initializeDemoSetupAction();
                                            setTableCreated(true);
                                            setStep(3);
                                        } catch (err: any) {
                                            setError('시스템 구축 중 오류 발생: ' + err.message);
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                >
                                    <div className="bg-primary/5 p-4 rounded-2xl text-primary group-hover:bg-primary/20 transition-all">
                                        <Sparkles size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-black text-slate-900">전문 업종별 풀 세트 설치</p>
                                        <p className="text-[10px] font-bold text-primary uppercase tracking-tight">100개 이상의 필수 테이블과 샘플 데이터를 즉시 구축합니다</p>
                                    </div>
                                    {loading ? <Loader2 size={24} className="text-primary animate-spin" /> : <ChevronRight className="text-slate-200 group-hover:text-primary transition-all" />}
                                </div>
                            </div>

                            <button 
                                onClick={() => setStep(3)}
                                className="w-full py-5 text-slate-400 font-black uppercase tracking-widest hover:text-slate-900 transition-all"
                            >
                                건너뛰고 빈 시스템으로 시작하기
                            </button>
                        </div>
                    )}


                    {step === 4 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">AI 분석 설계도</h2>
                                    <div className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">GEMINI 2.0</div>
                                </div>
                                <p className="text-sm text-slate-400 font-medium leading-relaxed">AI가 업로드한 파일을 분석하여 최적의 테이블 스펙을 제안했습니다.</p>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                {aiSchema?.map((col: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-[10px] font-black text-primary border">
                                                {col.type.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter leading-none">{col.name}</p>
                                                <p className="font-bold text-slate-800">{col.displayName}</p>
                                            </div>
                                        </div>
                                        <div className="text-[10px] font-black opacity-30 uppercase">{col.type}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setStep(2)}
                                    className="px-6 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    RETRY
                                </button>
                                <button 
                                    onClick={handleCreateScaffold}
                                    disabled={loading}
                                    className="flex-1 py-5 bg-primary text-white rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {loading ? '생성 중...' : '테이블 구축 승인'} <CheckCircle2 size={20} />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">마지막 단계: 관리자 계정 생성</h2>
                                <p className="text-sm text-slate-400 font-medium leading-relaxed">시스템을 관리할 첫 번째 마스터 계정을 생성해 주세요.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-primary tracking-widest pl-1">ADMIN USERNAME</label>
                                    <input 
                                        type="text"
                                        placeholder="아이디 (예: admin)"
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary font-bold placeholder:text-slate-300 transition-all"
                                        value={formData.adminUsername}
                                        onChange={(e) => setFormData({...formData, adminUsername: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-primary tracking-widest pl-1">ADMIN PASSWORD</label>
                                    <input 
                                        type="password"
                                        placeholder="비밀번호"
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary font-bold placeholder:text-slate-300 transition-all"
                                        value={formData.adminPassword}
                                        onChange={(e) => setFormData({...formData, adminPassword: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-[32px] border border-dashed space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border">
                                        <Building2 size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">COMPANY</p>
                                        <p className="text-md font-black text-slate-900 uppercase tracking-tight">{formData.companyName}</p>
                                    </div>
                                </div>
                                {tableCreated && (
                                    <div className="flex items-center gap-4 pt-4 border-t border-slate-200">
                                        <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500">
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest leading-none mb-1">DATA ASSET</p>
                                            <p className="text-xs font-bold text-slate-700">지능형 테이블 구축 완료</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {error && <p className="text-red-500 text-[10px] font-black p-4 bg-red-50 rounded-2xl text-center italic">{error}</p>}

                            <button 
                                onClick={handleInitialize}
                                disabled={loading || !formData.adminUsername || !formData.adminPassword}
                                className="w-full py-6 bg-slate-900 text-white rounded-[40px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:scale-[1.02] shadow-xl shadow-slate-900/30 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? 'Launching...' : 'LAUNCH DASHBOARD'} <LayoutDashboard size={24} />
                            </button>
                        </div>
                    )}
                </div>
            </main>

            <footer className="mt-12 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] opacity-30 flex items-center gap-2">
                POWERED BY EGDesk AI ARCHITECTURE <Sparkles size={12} />
            </footer>
        </div>
    );
}
