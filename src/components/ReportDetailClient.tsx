'use client';

import React, { useState } from 'react';
import { ReportHeader } from './ReportHeader';
import { BulkUpload } from './BulkUpload';
import { ReportDataEditor } from './ReportDataEditor';
import { DynamicTable } from './DynamicTable';
import { X, FileSpreadsheet } from 'lucide-react';
import { ReportAccessManager } from './ReportAccessManager';
import { AIPhotoImportSection } from './AIPhotoImportSection';
import { StatusModal } from './StatusModal';

interface ReportDetailClientProps {
    report: any;
    user: any;
    columns: any[];
    rows: any[];
    isOwner: boolean;
    isAdmin: boolean;
    canEdit: boolean;
    isReadOnly?: boolean;
    id: string;
    multiSortConfig?: { key: string; direction: 'asc' | 'desc' }[];
}

export function ReportDetailClient({ 
    report, 
    user, 
    columns, 
    rows, 
    isOwner, 
    isAdmin, 
    canEdit,
    isReadOnly = false,
    id,
    multiSortConfig
}: ReportDetailClientProps) {
    const [showAddRecordForm, setShowAddRecordForm] = useState(false);
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [showAccessManager, setShowAccessManager] = useState(false); // Added missing state for access manager

    // 공통 상태 모달 관리 (자식 컴포넌트들에게 공유)
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

    return (
        <main className="max-w-[1600px] mx-auto space-y-10 pb-32">
            <ReportHeader 
                reportId={id} 
                initialName={report.name} 
                sheetName={report.sheetName} 
                createdAt={report.createdAt}
                isOwner={isOwner}
                isAdmin={isAdmin}
                canEdit={canEdit}
                isReadOnly={isReadOnly || report.isReadOnly}
                initialColumns={columns}
                rowCount={rows.length}
                onToggleAccessManager={() => setShowAccessManager(true)}
            />

            {/* Toggled Sections (Inline) */}
            <div className="space-y-10">
                {showAddRecordForm && canEdit && (
                    <div className="animate-in fade-in slide-in-from-top-6 zoom-in-95 duration-700">
                        <ReportDataEditor 
                            reportId={report.id} 
                            columns={columns} 
                            onStatusShow={showStatus}
                        />
                    </div>
                )}
            </div>

            {/* Data List Section */}
            <section className="space-y-6">
                {/* Redundant section header removed as requested */}
                <div className="bg-white p-4 rounded-[40px] border border-slate-100 shadow-2xl shadow-slate-900/5 overflow-hidden">
                    <DynamicTable 
                        reportId={id} 
                        columns={columns} 
                        data={rows} 
                        isOwner={isOwner} 
                        canEdit={canEdit} 
                        isReadOnly={isReadOnly || report.isReadOnly}
                        userRole={user?.role}
                        currentUserId={user?.id}
                        initialSortConfig={multiSortConfig}
                        initialItemsPerPage={report.itemsPerPage || 10}
                        onToggleAddRecord={() => {
                            setShowAddRecordForm(!showAddRecordForm);
                            setShowBulkUpload(false);
                            setShowAIModal(false);
                        }}
                        onToggleBulkUpload={() => {
                            setShowBulkUpload(true);
                            setShowAddRecordForm(false);
                            setShowAIModal(false);
                        }}
                        onToggleAIImport={() => {
                            setShowAIModal(true);
                            setShowAddRecordForm(false);
                            setShowBulkUpload(false);
                        }}
                        onStatusShow={showStatus}
                    />
                </div>
            </section>

            {/* AI Photo Import Section (Modal Overlay) */}
            {showAIModal && canEdit && (
                <AIPhotoImportSection 
                    reportId={report.id} 
                    columns={columns} 
                    onClose={() => setShowAIModal(false)} 
                    onStatusShow={showStatus}
                />
            )}

            {/* Bulk Upload Modal (Overlay) */}
            {showBulkUpload && canEdit && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-green-600 p-8 text-white flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-2xl">
                                    <FileSpreadsheet size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black tracking-tight uppercase tracking-widest">Excel Bulk Import</h3>
                                    <p className="text-green-100 text-[10px] font-bold uppercase tracking-widest opacity-80">Sync entire dataset in seconds</p>
                                </div>
                            </div>
                            <button onClick={() => setShowBulkUpload(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-90">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-10">
                            <BulkUpload 
                                reportId={report.id} 
                                columns={columns} 
                                onStatusShow={(title, message, type) => {
                                    // 1. 상태 모달 표시
                                    showStatus(title, message, type);
                                    // 2. 성공 시에만 페이지 리로드
                                    if (type === 'success') {
                                        setTimeout(() => window.location.reload(), 1500);
                                    }
                                }} 
                            />
                        </div>
                        <div className="bg-gray-50 p-6 text-center border-t border-gray-100">
                            <button 
                                onClick={() => setShowBulkUpload(false)}
                                className="px-8 py-3 bg-white border border-gray-200 text-gray-500 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-95"
                            >
                                CANCEL & CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Access Manager Modal placeholder if needed */}
            {showAccessManager && (isAdmin || isOwner) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <h3 className="text-xl font-black tracking-tight uppercase tracking-widest">Report Access Management</h3>
                            </div>
                            <button onClick={() => setShowAccessManager(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-90">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10">
                            <ReportAccessManager reportId={report.id} />
                        </div>
                    </div>
                </div>
            )}

            {/* 공통 상태 알림 모달 */}
            <StatusModal 
                isOpen={modalStatus.isOpen}
                onClose={() => setModalStatus(prev => ({ ...prev, isOpen: false }))}
                title={modalStatus.title}
                message={modalStatus.message}
                type={modalStatus.type} 
            />
        </main>
    );
}
