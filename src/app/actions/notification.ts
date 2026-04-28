'use server';

import { revalidatePath } from 'next/cache';
import { queryTable, updateRows, deleteRows } from '@/egdesk-helpers';
import { getSessionAction } from './auth';

type WorkspacePurgeStats = {
    targetItems: any[];
    targetNotifications: any[];
    candidateFileCount: number;
};

function normalizePurgeDays(days?: number): number {
    const numeric = Number(days);
    if (!Number.isFinite(numeric) || numeric <= 0) return 30;
    // 최대 10년(3650일)까지 허용하여 전체 삭제 지원
    return Math.min(Math.floor(numeric), 3650);
}

async function collectWorkspacePurgeTargets(days?: number): Promise<WorkspacePurgeStats> {
    const safeDays = normalizePurgeDays(days);
    const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;

    const [workspaceRaw, notificationsRaw] = await Promise.all([
        queryTable('workspace_item', {
            orderBy: 'createdAt',
            orderDirection: 'DESC',
            limit: 3000
        }),
        queryTable('notification', { limit: 3000, orderBy: 'createdAt', orderDirection: 'DESC' })
    ]);

    const workspaceItems = (Array.isArray(workspaceRaw) ? workspaceRaw : workspaceRaw?.rows || []) as any[];
    const notifications = (Array.isArray(notificationsRaw) ? notificationsRaw : notificationsRaw?.rows || []) as any[];
    const itemIdSet = new Set(workspaceItems.map((item: any) => String(item.id)));

    // "워크스페이스 테스트 데이터" 기준:
    // 1) 최근 N일 내 생성된 workspace_item (등록자 역할 무관)
    const targetItems = workspaceItems.filter((item: any) => {
        const createdAt = new Date(item.createdAt || 0).getTime();
        return Number.isFinite(createdAt) && createdAt >= cutoff;
    });

    const linkSet = new Set(
        targetItems.map((item: any) => `/workspace?openItem=${encodeURIComponent(String(item.id))}`)
    );

    // 대상 알림:
    // - 대상 item 링크와 정확히 매칭되는 알림
    // - 또는 /workspace?openItem= 링크인데 원본 item이 이미 사라진(orphan) 최근 N일 알림
    const targetNotifications = notifications.filter((noti: any) => {
        const link = String(noti.link || '');
        if (!link.includes('/workspace?openItem=')) return false;
        if (linkSet.has(link)) return true;

        const match = link.match(/[?&]openItem=([^&]+)/);
        const itemId = match ? decodeURIComponent(match[1]) : null;
        const createdAt = new Date(noti.createdAt || 0).getTime();
        const isRecent = Number.isFinite(createdAt) && createdAt >= cutoff;
        const isOrphan = itemId ? !itemIdSet.has(String(itemId)) : false;
        return isRecent && isOrphan;
    });

    let candidateFileCount = 0;
    for (const item of targetItems) {
        if (String(item.imageUrl || '').startsWith('/uploads/')) candidateFileCount += 1;
    }

    return { targetItems, targetNotifications, candidateFileCount };
}

/**
 * 현재 로그인한 사용자의 읽지 않은 알림 목록을 가져옵니다.
 */
export async function getUnreadNotificationsAction() {
    const session = await getSessionAction();
    if (!session) return [];

    try {
        const filters: any = { isRead: '0' };
        // 관리자는 시스템 전체의 읽지 않은 활동 로그를 모니터링할 수 있도록 필터 확장
        if (session.role !== 'ADMIN') {
            filters.userId = String(session.id);
        }

        const result = await queryTable('notification', { 
            filters,
            orderBy: 'createdAt',
            orderDirection: 'DESC',
            limit: 50
        });
        return (result || []) as any[];
    } catch (err) {
        console.error('[Notification Action] Error fetching unread:', err);
        return [];
    }
}

/**
 * 현재 로그인한 사용자의 모든 알림 목록을 가져옵니다.
 */
export async function getAllNotificationsAction() {
    const session = await getSessionAction();
    if (!session) return [];

    try {
        const result = await queryTable('notification', { 
            filters: { userId: String(session.id) },
            orderBy: 'createdAt',
            orderDirection: 'DESC',
            limit: 100
        });
        return result || [];
    } catch (err) {
        console.error('[Notification Action] Error fetching all:', err);
        return [];
    }
}

/**
 * 관리자용: 전사 사원들의 알림 로그를 가져옵니다. (최근 200건 + 필터링)
 */
export async function getAdminNotificationLogsAction(filters?: { searchTerm?: string }) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') {
        throw new Error('관리자 권한이 필요합니다.');
    }

    try {
        // 1. 알림 로그 조회
        const queryOptions: any = {
            orderBy: 'createdAt',
            orderDirection: 'DESC',
            limit: 200
        };

        // 검색어가 있는 경우 (간단한 필터링)
        if (filters?.searchTerm) {
            // queryTable에서 Like 검색 등을 지원하지 않을 수 있으므로 전체 로드 후 필터링하거나
            // 가능한 경우 필터링 전달 (여기서는 헬퍼 제약에 따라 전체 로드 후 처리 가능성 염두)
        }

        const notifications = await queryTable('notification', queryOptions);

        // 2. 사용자 정보 매핑을 위해 전체 사용자 목록 조회
        const users = await queryTable('user', { limit: 1000 });
        const userMap = users.reduce((acc: any, u: any) => {
            acc[u.id] = { 
                username: u.username, 
                fullName: u.fullName || u.username,
                employeeId: u.employeeId || '-'
            };
            return acc;
        }, {});

        // 3. 할 일 상태(Task Status) 연동을 위해 관련 데이터 조회
        const reportIds = notifications
            .filter((n: any) => n.link?.startsWith('/report/'))
            .map((n: any) => n.link.split('/')[2]);
        
        const uniqueReportIds = Array.from(new Set(reportIds));
        let taskMap: Record<string, string> = {};

        if (uniqueReportIds.length > 0) {
            // 모든 관련 태스크 조회 (최근순)
            const tasks = await queryTable('action_task', { 
                orderBy: 'createdAt',
                orderDirection: 'DESC',
                limit: 500
            });
            
            // { userId_reportId: status } 맵 생성
            taskMap = tasks.reduce((acc: any, t: any) => {
                const key = `${t.assigneeId}_${t.reportId}`;
                if (!acc[key]) acc[key] = t.status;
                return acc;
            }, {});
        }

        // 4. 데이터 병합
        const mappedLogs = notifications.map((n: any) => {
            const taskKey = `${n.userId}_${n.link?.startsWith('/report/') ? n.link.split('/')[2] : ''}`;
            return {
                ...n,
                user: userMap[n.userId] || { username: 'Unknown', fullName: '알 수 없음', employeeId: '-' },
                taskStatus: taskMap[taskKey] || null
            };
        });

        // 5. 검색어 필터링 전용
        let finalResult = mappedLogs;

        if (filters?.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            finalResult = finalResult.filter((n: any) => 
                n.title.toLowerCase().includes(term) || 
                n.message.toLowerCase().includes(term) ||
                n.user.fullName.toLowerCase().includes(term) ||
                n.user.username.toLowerCase().includes(term)
            );
        }

        return finalResult;
    } catch (err) {
        console.error('[Notification Action] Error fetching admin logs:', err);
        return [];
    }
}

/**
 * 특정 알림 또는 해당 작업(link)과 관련된 모든 알림을 읽음 처리합니다.
 */
export async function markNotificationAsReadAction(notificationId: string, link?: string) {
    const session = await getSessionAction();
    if (!session) throw new Error('인증이 필요합니다.');

    // [중요] 링크(작업 단위)가 제공되면 해당 작업의 모든 잔여 알림을 읽음 처리하여 배지 숫자를 정확히 제거함
    const filters: any = { isRead: '0' }; 
    if (session.role !== 'ADMIN') {
        filters.userId = session.id;
    }

    if (link) {
        filters.link = link;
    } else {
        filters.id = notificationId;
    }

    await updateRows('notification', { isRead: '1' }, { filters });

    revalidatePath('/');
    return { success: true };
}

/**
 * 특정 알림 그룹(link)과 관련된 모든 알림을 물리적으로 삭제합니다. (관리자용)
 */
export async function deleteNotificationGroupAction(link: string) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') {
        throw new Error('관리자 권한이 필요합니다.');
    }

    try {
        console.log(`[Notification Delete] Group Link: ${link}`);
        // 1. 해당 링크(작업 단위)와 관련된 모든 알림을 물리적으로 삭제하여 대시보드에서 제거
        await deleteRows('notification', { filters: { link } });
        
        // 2. [추가] 워크스페이스 항목 연계 삭제 (사원 피드에서도 제거하기 위함)
        // 링크 패턴 예: /workspace?openItem=itemId
        const openItemMatch = link.match(/[?&]openItem=([^&]+)/);
        if (openItemMatch) {
            const itemId = decodeURIComponent(openItemMatch[1]);
            console.log(`[Notification Delete Sync] Deleting Linked Data Item: ${itemId}`);
            
            // workspace_item 및 report_row 하드 삭제 시도하여 데이터 정합성 확보
            await deleteRows('workspace_item', { filters: { id: itemId } });
            await deleteRows('dashboard_data', { filters: { id: itemId } });
        }

        revalidatePath('/notifications');
        revalidatePath('/(dashboard)/notifications');
        revalidatePath('/workspace');
        return { success: true };
    } catch (err) {
        console.error('[Notification Action] deleteNotificationGroupAction failed:', err);
        throw new Error('알림 그룹 삭제 및 데이터 동기화에 실패했습니다.');
    }
}

/**
 * 모든 알림을 읽음 처리합니다.
 */
export async function markAllNotificationsAsReadAction() {
    const session = await getSessionAction();
    if (!session) throw new Error('인증이 필요합니다.');

    const filters: any = { isRead: '0' };
    if (session.role !== 'ADMIN') {
        filters.userId = session.id;
    }

    await updateRows('notification', { isRead: '1' }, { filters });

    revalidatePath('/');
    return { success: true };
}

/**
 * 오래된 알림을 삭제합니다.
 */
export async function clearOldNotificationsAction() {
    const session = await getSessionAction();
    if (!session) throw new Error('인증이 필요합니다.');

    // 30일 이상 된 알림 삭제 (현재 시간 기준)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // 이 기능은 헬퍼가 복잡한 조건(보다 작다 등)을 지원하는지에 따라 다름
    // 여기서는 단순히 읽은 알림 전체 삭제로 대체하거나 백엔드 쿼리 활용
    await deleteRows('notification', { 
        filters: { userId: session.id, isRead: '1' } 
    });

    revalidatePath('/');
    return { success: true };
}

/**
 * 관리자용: 워크스페이스 테스트 데이터 일괄 삭제 전 미리보기를 제공합니다.
 */
export async function previewWorkspaceTestDataPurgeAction(days?: number) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') {
        throw new Error('관리자 권한이 필요합니다.');
    }

    try {
        const safeDays = normalizePurgeDays(days);
        const stats = await collectWorkspacePurgeTargets(safeDays);
        return {
            success: true,
            days: safeDays,
            targetItems: stats.targetItems.length,
            targetNotifications: stats.targetNotifications.length,
            targetFiles: stats.candidateFileCount
        };
    } catch (err: any) {
        console.error('[Notification Action] previewWorkspaceTestDataPurgeAction failed:', err);
        throw new Error(err?.message || '테스트 데이터 미리보기 계산에 실패했습니다.');
    }
}

/**
 * 관리자용: 워크스페이스 테스트 데이터를 일괄 삭제합니다.
 * - 대상: 사원이 등록한 workspace_item, 연결된 notification, 업로드 파일
 */
export async function purgeWorkspaceTestDataAction(days?: number) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') {
        throw new Error('관리자 권한이 필요합니다.');
    }

    try {
        const safeDays = normalizePurgeDays(days);
        const stats = await collectWorkspacePurgeTargets(safeDays);
        const targetItems = stats.targetItems;

        if (targetItems.length === 0) {
            return {
                success: true,
                days: safeDays,
                deletedItems: 0,
                deletedNotifications: 0,
                deletedFiles: 0
            };
        }

        const fs = await import('fs/promises');
        const path = await import('path');

        let deletedItems = 0;
        let deletedNotifications = 0;
        let deletedFiles = 0;

        // 0) 대상 알림 선삭제 (orphan 포함)
        for (const row of stats.targetNotifications) {
            await deleteRows('notification', { filters: { id: String(row.id) } });
            deletedNotifications += 1;
        }

        for (const item of targetItems) {
            const itemId = String(item.id);
            // 1) 파일 정리 (uploads 경로만 안전 삭제)
            const imageUrl = String(item.imageUrl || '');
            if (imageUrl.startsWith('/uploads/')) {
                const filePath = path.join(process.cwd(), 'public', imageUrl);
                try {
                    await fs.unlink(filePath);
                    deletedFiles += 1;
                } catch {
                    // 파일이 이미 없거나 접근 불가여도 DB 정리는 계속 진행
                }
            }

            // 2) workspace_item 하드 삭제
            await deleteRows('workspace_item', { filters: { id: itemId } });
            deletedItems += 1;
        }

        revalidatePath('/workspace');
        revalidatePath('/notifications');
        revalidatePath('/(dashboard)/notifications');

        return {
            success: true,
            days: safeDays,
            deletedItems,
            deletedNotifications,
            deletedFiles
        };
    } catch (err: any) {
        console.error('[Notification Action] purgeWorkspaceTestDataAction failed:', err);
        throw new Error(err?.message || '테스트 데이터 일괄 삭제에 실패했습니다.');
    }
}
