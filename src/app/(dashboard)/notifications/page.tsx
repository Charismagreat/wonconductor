import React from 'react';
import { Metadata } from 'next';
import { Bell } from 'lucide-react';
import BusinessWorkflowHub from '@/components/NotificationPageClient';
import { getAllNotificationsAction, getAdminNotificationLogsAction } from '@/app/actions/notification';
import { getSessionAction } from '@/app/actions/auth';
import PageHeader from '@/components/PageHeader';
import { queryTable } from '@/egdesk-helpers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
    title: '전사 업무 관제 허브 | Workflow Hub',
    description: '전사 사원들의 업무 흐름과 시스템 상태를 실시간으로 모니터링합니다.',
};

export default async function NotificationsPage() {
    const user = await getSessionAction();
    if (!user) {
        redirect('/login');
    }

    // [DIAGNOSTIC] Verify module resolution before rendering
    console.log('🔍 [RUNTIME DIAGNOSTIC] BusinessWorkflowHub component type:', typeof BusinessWorkflowHub);
    const isComponentValid = BusinessWorkflowHub && (typeof BusinessWorkflowHub === 'function' || typeof BusinessWorkflowHub === 'object');

    // 기본 본인 알림 로드
    const myNotifications = await getAllNotificationsAction();
    
    // 관리자인 경우 전사 로그 로드
    let adminLogs: any[] = [];
    if (user.role === 'ADMIN') {
        adminLogs = await getAdminNotificationLogsAction();
    }

    // 부서 목록 로드 (필터용)
    let departments: any[] = [];
    try {
        const deptRes = await queryTable('department', { orderBy: 'name' });
        departments = Array.isArray(deptRes) ? deptRes : (deptRes?.rows || []);
    } catch (err) {
        console.error('Failed to fetch departments for filter:', err);
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <main className="max-w-[1600px] mx-auto px-8 md:px-12 pt-6 pb-12 space-y-6">


                {!isComponentValid ? (
                    <div className="p-20 bg-red-50 border-2 border-dashed border-red-200 rounded-[32px] text-center">
                        <p className="text-red-600 font-black uppercase tracking-tight">Component Resolution Failure</p>
                        <p className="text-red-400 text-xs mt-2 font-bold">BusinessWorkflowHub is undefined. Please check export/import consistency.</p>
                    </div>
                ) : (
                    <BusinessWorkflowHub 
                        user={user}
                        initialNotifications={myNotifications} 
                        initialAdminLogs={adminLogs}
                        departments={departments}
                    />
                )}
            </main>
        </div>
    );
}
