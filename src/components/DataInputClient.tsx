'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    Plus,
    Sparkles,
    FileSpreadsheet,
    ArrowLeft,
    Database,
    ShieldAlert,
    X,
    LayoutDashboard,
    ListFilter,
    Loader2
} from 'lucide-react';
import Link from 'next/link';
import { DataEntryForm } from './DataEntryForm';
import { BulkUpload } from './BulkUpload';
import { AIPhotoImportSection } from './AIPhotoImportSection';
import { StatusModal } from './StatusModal';
import { DynamicTable } from './DynamicTable';
import LogoutButton from './LogoutButton';

/**
 * 🛡️ SafeIcon: Ensures we never pass an undefined component to React JSX.
 */
const SafeIcon = ({ icon: Icon, isMounted, ...props }: any) => {
    if (!isMounted || !Icon) return null;
    const isComponent = typeof Icon === 'function' || typeof Icon === 'object';
    if (!isComponent) return <div className="w-4 h-4 rounded-full bg-slate-300 opacity-50" />;
    try {
        return <Icon {...props} />;
    } catch (err) {
        return null;
    }
};

interface DataInputClientProps {
    report: any;
    session: any;
    columns: any[];
    rows: any[];
}

export function DataInputClient({ report, session, columns, rows }: DataInputClientProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [showExcelModal, setShowExcelModal] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [showAddRecordForm, setShowAddRecordForm] = useState(true);
    const formRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsMounted(true);
        console.log('[DIAGNOSTIC] DataInputClient module mounted');
    }, []);

    // 상태 모달 관리
    const [modalStatus, setModalStatus] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showStatus = (title: string, message: string, type: 'success' | 'error' | 'info') => {
        setModalStatus({ isOpen: true, title, message, type });
    };

    const isManagement = session.role === 'ADMIN' || session.role === 'EDITOR' || report.ownerId === session.id;

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 🛡️ Pre-hydration Guard
    if (!isMounted) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center">
                <SafeIcon icon={Loader2} isMounted={true} size={32} className="animate-spin text-blue-500" />
                <p className="mt-4 text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Initializing Terminal...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 md:p-12 font-[family-name:var(--font-geist-sans)] animate-in fade-in duration-700">
            {/* Header / Nav */}
            <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div className="flex items-center gap-6">
                    {isManagement && (
                        <>
                            <Link
                                href={`/report/${report.id}`}
                                className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-100 rounded-2xl text-[11px] font-black text-gray-400 hover:text-blue-600 hover:border-blue-100 transition-all shadow-sm hover:shadow-md active:scale-95"
                            >
                                <SafeIcon icon={ArrowLeft} isMounted={isMounted} size={16} className="group-hover:-translate-x-1 transition-transform" />
                                BACK TO TABLE
                            </Link>
                            <div className="h-6 w-px bg-gray-200" />
                        </>
                    )}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-0.5">
                            <SafeIcon icon={Database} isMounted={isMounted} size={12} />
                            <span>Target Database</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-sm font-black text-gray-900">{report.name}</h2>
                            {report.tableName && (
                                <span className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest bg-slate-900 text-white shadow-sm">
                                    Source: {report.tableName}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4 bg-white px-5 py-2.5 border border-gray-100 rounded-full shadow-sm text-xs font-bold text-gray-700">
                        <SafeIcon icon={ShieldAlert} isMounted={isMounted} size={16} className="text-orange-500" />
                        <span>Logged in as <span className="text-gray-900">{session.username}</span></span>
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[9px] uppercase tracking-wider text-gray-500">{session.role}</span>
                    </div>
                    <LogoutButton />
                </div>
            </header>

            <main className="max-w-6xl mx-auto space-y-16 pb-32">
                {/* Upper Action Bar */}
                <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20">
                            <SafeIcon icon={Plus} isMounted={isMounted} size={28} strokeWidth={3} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">새로운 데이터 추가</h1>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Direct Entry terminal</p>
                        </div>
                    </div>

                    {isManagement && (
                        <div className="flex items-center gap-3 w-full md:w-auto animate-in fade-in slide-in-from-right-4 duration-500">
                            <button
                                onClick={() => setShowExcelModal(true)}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 text-white font-black rounded-[20px] hover:bg-green-700 shadow-xl shadow-green-500/10 transition-all text-xs tracking-widest uppercase active:scale-95 group"
                            >
                                <SafeIcon icon={FileSpreadsheet} isMounted={isMounted} size={16} className="group-hover:rotate-12 transition-transform" />
                                엑셀 파일로 일괄 등록
                            </button>
                            <button
                                onClick={() => setShowAIModal(true)}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white font-black rounded-[20px] hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all text-xs tracking-widest uppercase active:scale-95 group"
                            >
                                <SafeIcon icon={Sparkles} isMounted={isMounted} size={16} className="group-hover:scale-110 transition-transform text-yellow-300" />
                                AI 사진으로 일괄 등록
                            </button>
                        </div>
                    )}
                </div>

                {/* Main Content Area - focused on Manual Entry */}
                <div className="flex flex-col items-center" ref={formRef}>
                    {showAddRecordForm && (
                        <div className="w-full max-w-4xl bg-white rounded-[40px] border border-gray-100 shadow-2xl shadow-gray-900/5 overflow-hidden group animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-blue-600 px-10 py-6 text-white flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                                    <h3 className="text-sm font-black uppercase tracking-widest">방법 1. 직접 하나씩 입력하기</h3>
                                </div>
                                <div className="flex items-center gap-2 opacity-60">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Manual Entry Terminal</span>
                                    <div className="h-3 w-px bg-white/30" />
                                    <div className="px-2 py-0.5 bg-white/10 rounded text-[8px] font-black tracking-tighter uppercase whitespace-nowrap">Live Auth</div>
                                </div>
                            </div>

                            <div className="p-10 md:p-14">
                                <DataEntryForm reportId={report.id} columns={columns} onSuccess={(warning) => {
                                    if (warning) {
                                        showStatus('부분 완료 (동기화 실패)', warning, 'error');
                                    } else {
                                        showStatus('추가 완료', '데이터가 성공적으로 추가되었습니다.', 'success');
                                    }
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Floating Info Pill - Only shown for management and if form is visible */}
                    {isManagement && showAddRecordForm && (
                        <div className="mt-8 flex items-center gap-4 px-6 py-2.5 bg-white border border-gray-100 rounded-2xl shadow-sm text-[10px] font-black text-gray-400 uppercase tracking-widest animate-in fade-in slide-in-from-bottom-2 duration-700 font-bold italic">
                            <SafeIcon icon={LayoutDashboard} isMounted={isMounted} size={14} className="text-blue-500" />
                            <span>대량의 데이터는 상단의 <span className="text-green-600">엑셀</span> 또는 <span className="text-indigo-600">AI 일괄 등록</span> 기능을 이용하세요</span>
                        </div>
                    )}
                </div>

                {/* Data History Section - Crucial for User Self-Management */}
                <section className="space-y-6 pt-12 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-gray-900 text-white rounded-xl shadow-lg">
                                <SafeIcon icon={ListFilter} isMounted={isMounted} size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900 tracking-tight">나의 입력 및 기록 관리</h2>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Edit or delete your previously submitted records</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-2 rounded-[32px] border border-gray-100 shadow-2xl shadow-gray-900/5 overflow-hidden">
                        <DynamicTable
                            reportId={report.id}
                            columns={columns}
                            data={rows}
                            isOwner={report.ownerId === session.id}
                            userRole={session.role}
                            currentUserId={session.id}
                            onToggleAddRecord={() => {
                                setShowAddRecordForm(!showAddRecordForm);
                                setShowExcelModal(false);
                                setShowAIModal(false);
                                scrollToTop();
                            }}
                            onToggleBulkUpload={() => {
                                setShowExcelModal(true);
                                setShowAIModal(false);
                                scrollToTop();
                            }}
                            onToggleAIImport={() => {
                                setShowAIModal(true);
                                setShowExcelModal(false);
                                scrollToTop();
                            }}
                            onStatusShow={showStatus}
                        />
                    </div>
                </section>

                <footer className="pt-24 pb-10 text-center text-gray-300">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] mb-2">Secure User input terminal v1.5</p>
                    <div className="flex justify-center gap-4 text-[9px] font-bold text-gray-400">
                        <span>AES-256 ENCRYPTION</span>
                        <span>•</span>
                        <span>ROLE-BASED ACCESS CONTROL</span>
                        <span>•</span>
                        <span>AUDIT READY</span>
                    </div>
                </footer>
            </main>

            {/* Excel Upload Modal */}
            {showExcelModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                        <div className="bg-green-600 p-8 text-white flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-2xl">
                                    <SafeIcon icon={FileSpreadsheet} isMounted={isMounted} size={24} />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-xl font-black tracking-tight">엑셀 파일로 일괄 등록</h3>
                                    <p className="text-green-100 text-[10px] font-bold uppercase tracking-widest">Bulk Import via Excel</p>
                                </div>
                            </div>
                            <button onClick={() => setShowExcelModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                                <SafeIcon icon={X} isMounted={isMounted} size={24} />
                            </button>
                        </div>
                        <div className="p-10">
                            <BulkUpload
                                reportId={report.id}
                                columns={columns}
                                onStatusShow={showStatus}
                            />
                        </div>
                        <div className="bg-gray-50 p-6 text-center border-t border-gray-100">
                            <button
                                onClick={() => setShowExcelModal(false)}
                                className="px-8 py-3 bg-white border border-gray-200 text-gray-500 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Photo Modal */}
            {showAIModal && (
                <AIPhotoImportSection
                    reportId={report.id}
                    columns={columns}
                    onClose={() => setShowAIModal(false)}
                    onStatusShow={showStatus}
                />
            )}

            {/* Global Status Modal */}
            <StatusModal
                isOpen={modalStatus.isOpen}
                onClose={() => setModalStatus(prev => ({ ...prev, isOpen: false }))}
                title={modalStatus.title}
                message={modalStatus.message}
                type={modalStatus.type}
            />
        </div>
    );
}
