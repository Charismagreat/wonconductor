'use server';

import { revalidatePath } from 'next/cache';
import { queryTable, insertRows, updateRows, deleteRows } from '@/egdesk-helpers';
import { getSessionAction } from './auth';

/**
 * 전사 보고서(테이블) 목록을 가져옵니다. (설정 대상 선택용)
 */
export async function getReportsAction() {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') {
        throw new Error('관리자 권한이 필요합니다.');
    }

    try {
        const reports = await queryTable('dashboard_master', { limit: 1000 });
        return reports || [];
    } catch (err) {
        console.error('[Guardrail Action] Error fetching reports:', err);
        return [];
    }
}

/**
 * 특정 보고서 혹은 전체 가드레일 규칙을 가져옵니다.
 */
export async function getGuardrailRulesAction(reportId?: string) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') {
        throw new Error('관리자 권한이 필요합니다.');
    }

    try {
        const filters: any = {};
        if (reportId) filters.reportId = reportId;

        const rules = await queryTable('input_guardrail', {
            filters,
            orderBy: 'createdAt',
            orderDirection: 'DESC'
        });
        return rules || [];
    } catch (err) {
        console.error('[Guardrail Action] Error fetching rules:', err);
        return [];
    }
}

/**
 * 가드레일 규칙을 저장(생성/수정)합니다.
 */
export async function saveGuardrailRuleAction(data: any) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') {
        throw new Error('관리자 권한이 필요합니다.');
    }

    try {
        const { id, ...ruleData } = data;
        
        if (id) {
            // 수정
            await updateRows('input_guardrail', ruleData, { filters: { id: String(id) } });
        } else {
            // 신규 생성
            const newId = `gr-${Date.now()}`;
            await insertRows('input_guardrail', [{
                ...ruleData,
                id: newId,
                createdAt: new Date().toISOString()
            }]);
        }

        revalidatePath('/admin/guardrails');
        return { success: true };
    } catch (err) {
        console.error('[Guardrail Action] Error saving rule:', err);
        throw err;
    }
}

/**
 * 가드레일 규칙을 삭제합니다.
 */
export async function deleteGuardrailRuleAction(ruleId: string) {
    const session = await getSessionAction();
    if (!session || session.role !== 'ADMIN') {
        throw new Error('관리자 권한이 필요합니다.');
    }

    try {
        await deleteRows('input_guardrail', { filters: { id: ruleId } });
        revalidatePath('/admin/guardrails');
        return { success: true };
    } catch (err) {
        console.error('[Guardrail Action] Error deleting rule:', err);
        throw err;
    }
}
