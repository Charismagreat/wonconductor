'use client';

import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Check, X, Users, Search, Loader2 } from 'lucide-react';
import { getUsersAction } from '@/app/actions/user';
import { updateReportAccessAction, getReportAccessListAction } from '@/app/actions/report';
import { getOrganizationDataAction } from '@/app/actions/organization';

interface User {
    id: string;
    username: string;
    fullName: string | null;
    role: string;
    departmentId?: string;
}

interface Department {
    id: string;
    name: string;
}

interface ReportAccessManagerProps {
    reportId: string;
    ownerId: string;
}

export function ReportAccessManager({ reportId, ownerId }: ReportAccessManagerProps) {
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allDepts, setAllDepts] = useState<Department[]>([]);
    const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
    const [blockedDeptIds, setBlockedDeptIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'users' | 'departments'>('users');
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const [users, accessData, orgData] = await Promise.all([
                    getUsersAction(),
                    getReportAccessListAction(reportId),
                    getOrganizationDataAction()
                ]);
                
                const viewerUsers = users.filter((u: any) => u.role === 'VIEWER');
                setAllUsers(viewerUsers);
                setAllDepts(orgData.departments || []);
                
                // getReportAccessListAction은 이제 isBlocked: 1인 항목만 반환함
                setBlockedUserIds(accessData.users.map((u: any) => u.id));
                setBlockedDeptIds(accessData.departments.map((d: any) => d.id));
            } catch (error) {
                console.error('Failed to load access data:', error);
                setMessage({ text: '데이터를 불러오는 데 실패했습니다.', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [reportId]);

    const handleToggleUser = (userId: string) => {
        setBlockedUserIds(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId) 
                : [...prev, userId]
        );
    };

    const handleToggleDept = (deptId: string) => {
        setBlockedDeptIds(prev => 
            prev.includes(deptId) 
                ? prev.filter(id => id !== deptId) 
                : [...prev, deptId]
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            await updateReportAccessAction(reportId, blockedUserIds, blockedDeptIds);
            setMessage({ text: '차단 설정이 성공적으로 업데이트되었습니다.', type: 'success' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            setMessage({ text: error.message || '저장에 실패했습니다.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const filteredUsers = allUsers.filter(u => 
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.fullName && u.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <Loader2 className="animate-spin mb-2" size={32} />
                <span>데이터 로딩 중...</span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">데이터 입력 차단 관리</h3>
                        <p className="text-sm text-gray-500">기본적으로 모든 사원이 접근 가능합니다. 입력을 제한할 사원을 선택하세요.</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md active:scale-95"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    {isSaving ? '저장 중...' : '차단 설정 저장'}
                </button>
            </div>

            <div className="p-6">
                {message && (
                    <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                        message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                        {message.type === 'success' ? <Check size={20} /> : <X size={20} />}
                        <span className="font-medium">{message.text}</span>
                    </div>
                )}

                <div className="flex items-center gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${
                            activeTab === 'users' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        차단된 사원 ({blockedUserIds.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('departments')}
                        className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${
                            activeTab === 'departments' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        차단된 부서 ({blockedDeptIds.length})
                    </button>
                </div>

                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder={activeTab === 'users' ? "이름 또는 아이디로 검색..." : "부서 이름으로 검색..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {activeTab === 'users' ? (
                        filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => {
                                const isBlocked = blockedUserIds.includes(user.id);
                                return (
                                    <div
                                        key={user.id}
                                        onClick={() => handleToggleUser(user.id)}
                                        className={`relative group cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                                            isBlocked 
                                                ? 'border-rose-500 bg-rose-50/50 shadow-sm' 
                                                : 'border-gray-100 bg-white hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${
                                                isBlocked ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {(user.fullName || user.username).charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 leading-tight">
                                                    {user.fullName || user.username}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {isBlocked ? '입력 차단됨' : '입력 허용됨'}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className={`w-6 h-6 flex items-center justify-center rounded-full border-2 transition-all ${
                                            isBlocked 
                                                ? 'bg-rose-500 border-rose-500 text-white' 
                                                : 'border-gray-200 text-transparent'
                                        }`}>
                                            <X size={14} />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400">
                                <Users size={48} className="mb-3 opacity-20" />
                                <p>검색 결과가 없거나 등록된 실무자가 없습니다.</p>
                            </div>
                        )
                    ) : (
                        allDepts.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 ? (
                            allDepts
                                .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map((dept) => {
                                    const isBlocked = blockedDeptIds.includes(dept.id);
                                    return (
                                        <div
                                            key={dept.id}
                                            onClick={() => handleToggleDept(dept.id)}
                                            className={`relative group cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                                                isBlocked 
                                                    ? 'border-rose-500 bg-rose-50/50 shadow-sm' 
                                                    : 'border-gray-100 bg-white hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${
                                                    isBlocked ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    <Users size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 leading-tight">
                                                        {dept.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {isBlocked ? '부서 전체 차단' : '부서 허용'}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className={`w-6 h-6 flex items-center justify-center rounded-full border-2 transition-all ${
                                                isBlocked 
                                                    ? 'bg-rose-500 border-rose-500 text-white' 
                                                    : 'border-gray-200 text-transparent'
                                            }`}>
                                                <X size={14} />
                                            </div>
                                        </div>
                                    );
                                })
                        ) : (
                            <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400">
                                <Users size={48} className="mb-3 opacity-20" />
                                <p>등록된 부서가 없거나 검색 결과가 없습니다.</p>
                            </div>
                        )
                    )}
                </div>

                <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-sm text-amber-800 flex items-start gap-2">
                        <Shield className="shrink-0 mt-0.5" size={16} />
                        <span>
                            관리자(ADMIN)와 편집자(EDITOR) 계정은 이 설정과 관계없이 모든 보고서에 접근할 수 있습니다. 
                            이곳에서는 <strong>실무자(VIEWER)</strong> 권한을 가진 사용자에 대해 기본 허용된 접근 권한을 <strong>개별적으로 제한(차단)</strong>합니다.
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}

