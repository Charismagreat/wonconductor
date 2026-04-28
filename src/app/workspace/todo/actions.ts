'use server';

import { getSessionAction } from '@/app/actions/auth';
import { queryTable, updateRows, insertRows } from '@/egdesk-helpers';
import { revalidatePath } from 'next/cache';

/**
 * 로그인한 사용자의 모든 할 일(To-Do) 목록을 가져옵니다.
 */
export async function getTodoListAction() {
    const session = await getSessionAction();
    if (!session) return [];

    try {
        const tasks = await queryTable('action_task', {
            filters: { 
                assigneeId: String(session.id)
            },
            orderBy: 'createdAt',
            orderDirection: 'DESC'
        });
        
        return Array.isArray(tasks) ? tasks : [];
    } catch (err) {
        console.error('[Todo Action] Failed to fetch tasks:', err);
        return [];
    }
}

/**
 * 할 일의 상태를 변경하고 이력을 기록합니다.
 */
export async function updateTaskStatusAction(taskId: string, newStatus: string) {
    const session = await getSessionAction();
    if (!session) throw new Error('인증이 필요합니다.');

    try {
        // 1. 기존 상태 확인
        const tasks = await queryTable('action_task', { filters: { id: taskId } });
        const task = tasks[0];
        if (!task) throw new Error('업무를 찾을 수 없습니다.');
        
        const oldStatus = task.status;

        // 2. 상태 업데이트
        const updateData: any = {
            status: newStatus,
            updatedAt: new Date().toISOString()
        };

        if (newStatus === 'COMPLETED') {
            updateData.completedAt = new Date().toISOString();
        } else {
            updateData.completedAt = null;
        }

        await updateRows('action_task', updateData, {
            filters: { id: taskId }
        });

        // 3. 이력 기록
        // 테이블 자동 생성 보장을 위해 HistoryService와 유사한 로직 사용
        try {
            const { createTable } = await import('@/egdesk-helpers');
            const { SYSTEM_TABLES } = await import('@/app/actions/shared');
            const tableDef = SYSTEM_TABLES.find(t => t.tableName === 'action_task_history');
            
            // 테이블 체크 (에러 발생 시 catch에서 생성 시도)
            try {
                await queryTable('action_task_history', { limit: 1 });
            } catch (e: any) {
                if (String(e.message).includes('no such table') && tableDef) {
                    await createTable(tableDef.displayName, tableDef.schema, { tableName: 'action_task_history' });
                }
            }

            await insertRows('action_task_history', [{
                taskId: String(taskId),
                oldStatus: oldStatus,
                newStatus: newStatus,
                changedById: String(session.id),
                changedAt: new Date().toISOString()
            }]);
        } catch (historyErr) {
            console.error('[Todo Action] History logging failed:', historyErr);
        }
        
        revalidatePath('/workspace/todo');
        revalidatePath('/workspace');
        return { success: true };
    } catch (err) {
        console.error('[Todo Action] Failed to update task:', err);
        return { success: false, message: '상태 변경에 실패했습니다.' };
    }
}

/**
 * 특정 업무의 상태 변경 이력을 가져옵니다.
 */
export async function getTaskHistoryAction(taskId: string) {
    try {
        const histories = await queryTable('action_task_history', {
            filters: { taskId: String(taskId) },
            orderBy: 'changedAt',
            orderDirection: 'DESC'
        });

        const historyList = Array.isArray(histories) ? histories : [];
        if (historyList.length === 0) return [];

        // 대상을 알기 위해 유저 정보도 매칭 (필요시)
        const userIds = Array.from(new Set(historyList.map((h: any) => h.changedById)));
        const users = await queryTable('user', { filters: { id: userIds } });
        const userMap = new Map((users as any[]).map(u => [String(u.id), u.fullName || u.username]));

        return historyList.map((h: any) => ({
            ...h,
            changedByName: userMap.get(String(h.changedById)) || '알 수 없음'
        }));
    } catch (err) {
        console.error('[Todo Action] Failed to fetch history:', err);
        return [];
    }
}
