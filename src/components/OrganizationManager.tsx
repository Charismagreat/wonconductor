'use client';

import React, { useState } from 'react';
import { 
    Users, 
    Upload, 
    Download, 
    Search, 
    Building2, 
    UserPlus, 
    User,
    Edit2, 
    Shield, 
    X,
    CheckCircle2,
    AlertCircle,
    Building,
    Briefcase,
    Loader2,
    Plus,
    Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { 
    syncOrganizationExcelAction, 
    createMemberAction, 
    updateMemberAction, 
    deleteMemberAction 
} from '@/app/actions/organization';
import PageHeader from '@/components/PageHeader';

interface OrganizationManagerProps {
    initialDepartments: any[];
    initialMembers: any[];
}

export function OrganizationManager({ initialDepartments, initialMembers }: OrganizationManagerProps) {
    const [departments, setDepartments] = useState(initialDepartments);
    const [members, setMembers] = useState(initialMembers);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [selectedMember, setSelectedMember] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        employeeId: '',
        email: '',
        position: '',
        departmentId: '',
        departmentName: '', // 추가
        role: 'VIEWER'
    });
    const [isDirectInput, setIsDirectInput] = useState(false); // 부서 직접 입력 여부

    // Filtered members
    const filteredMembers = members.filter((m: any) => 
        (m.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.departmentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const downloadSampleTemplate = () => {
        const data = [
            ['부서', '직위', '이름', '사원번호', '이메일'],
            ['개발팀', '팀장', '홍길동', 'EMP2024001', 'hong@example.com'],
            ['경영지원', '과장', '성춘향', 'EMP2024002', 'sung@example.com']
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "OrgTemplate");
        XLSX.writeFile(wb, "organization_master_sample.xlsx");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSyncing(true);
        setSyncResult(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const result = await syncOrganizationExcelAction(jsonData);
            if (result.success) {
                setSyncResult({
                    type: 'success',
                    message: `조직 동기화 완료: 신규 ${result.stats?.inserted}명, 수정 ${result.stats?.updated}명, 부서 ${result.stats?.deptsCreated}개 생성`
                });
                setTimeout(() => window.location.reload(), 2000);
            }
        } catch (err: any) {
            setSyncResult({
                type: 'error',
                message: `동기화 실패: ${err.message}`
            });
        } finally {
            setIsSyncing(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleOpenModal = (mode: 'create' | 'edit', member: any = null) => {
        setModalMode(mode);
        setSelectedMember(member);
        setIsDirectInput(false); // 모달 열 때 초기화
        if (mode === 'edit' && member) {
            setFormData({
                fullName: member.fullName || '',
                employeeId: member.employeeId || '',
                email: member.email || '',
                position: member.position || '',
                departmentId: member.departmentId || '',
                departmentName: '',
                role: member.role || 'VIEWER'
            });
        } else {
            setFormData({
                fullName: '',
                employeeId: '',
                email: '',
                position: '',
                departmentId: '',
                departmentName: '',
                role: 'VIEWER'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmitMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (modalMode === 'create') {
                await createMemberAction(formData);
                setSyncResult({ type: 'success', message: '신규 구성원이 등록되었습니다.' });
            } else {
                await updateMemberAction(selectedMember.id, formData);
                setSyncResult({ type: 'success', message: '구성원 정보가 수정되었습니다.' });
            }
            setIsModalOpen(false);
            setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteMember = async () => {
        if (!selectedMember) return;
        if (!confirm(`${selectedMember.fullName}님을 조직도에서 삭제(비활성화)하시겠습니까?`)) return;

        setIsSubmitting(true);
        try {
            await deleteMemberAction(selectedMember.id);
            setSyncResult({ type: 'success', message: '삭제 처리가 완료되었습니다.' });
            setIsModalOpen(false);
            setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const stats = {
        totalDepts: departments.length,
        totalMembers: members.length,
        admins: members.filter((m: any) => m.role === 'ADMIN').length,
        positions: new Set(members.map((m: any) => m.position).filter(Boolean)).size
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <PageHeader 
                title="ORGANIZATION"
                description="전사 조직도와 구성원 정보를 관리하고 엑셀을 통해 일괄 동기화합니다."
                icon={Users}
                rightElement={
                    <div className="flex flex-wrap items-center gap-4 w-full md:w-fit justify-end">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input 
                                type="text"
                                placeholder="이름, 부서 또는 사원번호 검색..."
                                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-slate-100 rounded-2xl text-[11px] font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <button 
                            onClick={downloadSampleTemplate}
                            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <Download size={14} /> Sample
                        </button>

                        <label className="relative group cursor-pointer">
                            <input 
                                type="file" 
                                className="hidden" 
                                accept=".xlsx, .xls"
                                onChange={handleFileUpload}
                                disabled={isSyncing}
                            />
                            <div className={`px-5 py-2.5 rounded-2xl ${isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-gray-900 text-white hover:bg-black'} text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center gap-2`}>
                                {isSyncing ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                                SYNC EXCEL
                            </div>
                        </label>

                        <button 
                            onClick={() => handleOpenModal('create')}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 flex items-center gap-2 hover:bg-blue-700 transition-all"
                        >
                            <Plus size={14} /> Add Member
                        </button>
                    </div>
                }
            />

            {/* 1. Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: '전체 부서', count: stats.totalDepts, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: '전체 구성원', count: stats.totalMembers, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: '관리자 계정', count: stats.admins, icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: '직무 유형', count: stats.positions, icon: Briefcase, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map((s, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                            <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                        </div>
                        <div className={`${s.bg} ${s.color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
                            <s.icon size={20} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Sync Result Toast */}
            <AnimatePresence>
                {syncResult && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`p-6 rounded-[24px] flex items-center gap-4 border ${syncResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}
                    >
                        <div className={`p-2 rounded-full ${syncResult.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                            {syncResult.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        </div>
                        <span className="text-sm font-bold">{syncResult.message}</span>
                        <button onClick={() => setSyncResult(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={16}/></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 3. Member List Table */}
            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100 font-black text-slate-400 uppercase tracking-widest text-[10px]">
                                <th className="px-10 py-6">Member Information</th>
                                <th className="px-10 py-6">Department</th>
                                <th className="px-10 py-6">Position</th>
                                <th className="px-10 py-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredMembers.map((member: any) => (
                                <motion.tr 
                                    layout
                                    key={member.id}
                                    className="hover:bg-slate-50/50 transition-colors group"
                                >
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center font-black text-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                {member.fullName?.[0]}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[14px] font-black text-slate-900 group-hover:text-blue-600 transition-colors">{member.fullName}</span>
                                                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-md ${
                                                        member.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                        {member.role === 'ADMIN' ? 'ADMIN' : 'MEMBER'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">ID: {member.employeeId || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-2 bg-slate-50 px-4 py-1.5 rounded-full w-fit border border-slate-100 group-hover:border-blue-100 group-hover:bg-blue-50 transition-colors">
                                            <Building2 size={12} className="text-slate-400 group-hover:text-blue-500" />
                                            <span className="text-[11px] font-black text-slate-600 group-hover:text-blue-700 transition-colors uppercase tracking-wider">{member.departmentName || 'MISC'}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                                                <Briefcase size={12} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-700">{member.position || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                        <button 
                                            onClick={() => handleOpenModal('edit', member)}
                                            className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2 ml-auto"
                                        >
                                            <Edit2 size={14} />
                                            Settings
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}

                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-10 py-20 text-center">
                                        <p className="text-slate-400 font-bold">검색 결과가 없습니다.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Member Add/Edit Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden"
                        >
                            <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                        {modalMode === 'create' ? '신규 구성원 등록' : '구성원 정보 수정'}
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                        {modalMode === 'create' ? 'Organization Member Entry' : 'Member Data Refinement'}
                                    </p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-colors">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmitMember} className="p-10 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">성명</label>
                                        <input 
                                            required
                                            className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            value={formData.fullName}
                                            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                                            placeholder="홍길동"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">사원번호</label>
                                        <input 
                                            required
                                            disabled={modalMode === 'edit'}
                                            className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
                                            value={formData.employeeId}
                                            onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                                            placeholder="EMP2024001"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between px-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">부서</label>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    setIsDirectInput(!isDirectInput);
                                                    setFormData({ ...formData, departmentId: '', departmentName: '' });
                                                }}
                                                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md transition-all ${
                                                    isDirectInput ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                                                }`}
                                            >
                                                {isDirectInput ? '선택 취소' : '직접 입력'}
                                            </button>
                                        </div>
                                        {isDirectInput ? (
                                            <input 
                                                autoFocus
                                                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                value={formData.departmentName}
                                                onChange={(e) => setFormData({...formData, departmentName: e.target.value})}
                                                placeholder="신규 부서명 입력"
                                            />
                                        ) : (
                                            <select 
                                                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
                                                value={formData.departmentId}
                                                onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
                                            >
                                                <option value="">부서 선택 없음</option>
                                                {departments.map((d: any) => (
                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">직위</label>
                                        <input 
                                            className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            value={formData.position}
                                            onChange={(e) => setFormData({...formData, position: e.target.value})}
                                            placeholder="팀장"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">이메일</label>
                                    <input 
                                        type="email"
                                        className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        placeholder="user@example.com"
                                    />
                                </div>

                                <div className="pt-6 flex items-center justify-between gap-4">
                                    {modalMode === 'edit' ? (
                                        <button 
                                            type="button"
                                            onClick={handleDeleteMember}
                                            className="px-6 py-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-2"
                                        >
                                            <Trash2 size={16} /> Delete Member
                                        </button>
                                    ) : <div />}

                                    <div className="flex items-center gap-3">
                                        <button 
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="px-10 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2"
                                        >
                                            {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : (modalMode === 'create' ? <Plus size={16} /> : <CheckCircle2 size={16} />)}
                                            {modalMode === 'create' ? 'Register Member' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
