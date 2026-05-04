'use server';

import { revalidatePath } from 'next/cache';
import { 
    queryTable, 
    insertRows, 
    updateRows 
} from '@/egdesk-helpers';
import { getSessionAction } from './auth';
import { getMasterRecords } from './report';
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }, { apiVersion: "v1beta" });

/**
 * AI가 데이터와 맥락을 분석하여 워크플로우 조치(알림, 태스크)를 추천합니다.
 */
export async function recommendWorkflowAction(reportId: string, rowId: string, rowData: any) {
    try {
        // 1. 맥락 데이터 준비
        const reports: any = await getMasterRecords(String(reportId));
        const report = reports[0];
        if (!report) return;

        const users = await queryTable('user', { filters: { isActive: 1 } });
        const userContext = users.map((u: any) => ({
            id: u.id,
            name: u.fullName || u.username,
            role: u.role,
            department: u.department || '미지정'
        }));

        const prompt = `
            당신은 기업용 업무 자동화 지휘관입니다. 신규 등록된 데이터를 분석하여 최적의 '후속 조치'를 추천해야 합니다.
            
            [비즈니스 맥락]
            - 보고서 이름: ${report.name}
            - 신규 등록 데이터: ${JSON.stringify(rowData)}
            - 가용 조직원: ${JSON.stringify(userContext)}
            
            [요구사항]
            1. 분석: 데이커의 내용을 보고 긴급도나 중요도를 판단하세요.
            2. 알림 추천: 이 소식을 반드시 알아야 하는 사람( Recipients)을 가용 조직원 중에서 최소 1명 이상 선택하세요.
            3. 할 일 추천: 이 데이터와 관련하여 다음에 수행해야 할 구체적인 업무(Task)를 정의하세요.
            4. 담당자 배정: 해당 업무를 수행하기에 가장 적절한 조직원을 선택하세요.
            
            [응답 형식]
            반드시 아래 JSON 형식으로만 응답하세요:
            {
              "reasoning": "왜 이 사람들을 선택했고 이 업무를 정의했는지에 대한 한국어 설명",
              "recommendation": {
                "notifyRecipients": ["user_id1", "user_id2"],
                "notificationMessage": "보낼 알림 메시지 내용",
                "task": {
                  "title": "생성할 할 일 제목",
                  "description": "상세 업무 지침",
                  "assigneeId": "배정할 사용자 ID",
                  "dueDays": 3
                }
              }
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) throw new Error("AI 추천 생성 실패");
        
        const aiResult = JSON.parse(jsonMatch[0]);

        // 2. steering 테이블에 저장
        await insertRows('workflow_steering', [{
            
            reportId,
            rowId,
            eventType: 'INSERT',
            recommendation: JSON.stringify(aiResult.recommendation),
            reasoning: aiResult.reasoning,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        }]);

        revalidatePath('/workflow/steering');
    } catch (error) {
        console.error('[Workflow Steering Error]:', error);
    }
}

/**
 * 대기 중인 추천 조치 목록을 가져옵니다.
 */
export async function getPendingSteeringActionsAction() {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        return [];
    }

    const pendings = await queryTable('workflow_steering', { 
        filters: { status: 'PENDING' },
        orderBy: 'createdAt',
        orderDirection: 'DESC'
    });

    // 상세 정보 보정 (Join 대용)
    return await Promise.all(pendings.map(async (p: any) => {
        const reports: any = await getMasterRecords(p.reportId);
        const report = reports[0];
        const [row] = await queryTable('dashboard_data', { filters: { id: p.rowId } });
        return {
            ...p,
            reportName: report?.name || '알 수 없는 보고서',
            rowData: row ? JSON.parse(row.data) : {},
            recommendation: JSON.parse(p.recommendation)
        };
    }));
}

/**
 * 추천 조치를 결정(승인/거부)하고 실행합니다.
 */
export async function decideSteeringActionAction(steeringId: string, decision: 'APPROVED' | 'REJECTED', modifiedRecommendation?: any) {
    const session = await getSessionAction();
    if (!session) throw new Error('인증 불가');

    const [steering] = await queryTable('workflow_steering', { filters: { id: steeringId } });
    if (!steering) throw new Error('항목 없음');

    const finalRec = modifiedRecommendation || JSON.parse(steering.recommendation);

    if (decision === 'APPROVED') {
        const { createInAppNotification } = await import('@/lib/notifications');
        
        // 1. 알림 발송
        if (finalRec.notifyRecipients && Array.isArray(finalRec.notifyRecipients)) {
            for (const uid of finalRec.notifyRecipients) {
                await createInAppNotification({
                    userId: uid,
                    title: `🔔 업무 지휘센터 알림`,
                    message: finalRec.notificationMessage,
                    link: `/report/${steering.reportId}`,
                    type: 'ALERT'
                });
            }
        }

        // 2. 태스크 생성
        if (finalRec.task) {
            const dueAt = finalRec.task.dueDays 
                ? new Date(Date.now() + (finalRec.task.dueDays * 86400000)).toISOString() 
                : null;
            
            await insertRows('action_task', [{
            
                reportId: steering.reportId,
                title: finalRec.task.title,
                description: finalRec.task.description,
                status: 'TODO',
                assigneeId: finalRec.task.assigneeId,
                dueAt: dueAt,
                createdAt: new Date().toISOString()
            }]);
        }
    }

    // 3. 상태 업데이트
    await updateRows('workflow_steering', {
        status: decision,
        decidedById: session.id,
        decidedAt: new Date().toISOString(),
        recommendation: JSON.stringify(finalRec) // 결정 시점의 최종 값 저장
    }, { filters: { id: steeringId } });

    revalidatePath('/workflow/steering');
    revalidatePath('/notifications');
    return { success: true };
}

/**
 * 특정 업무를 수동으로 STEERING HUB로 이동(지휘 요청)시킵니다.
 */
export async function requestSteeringAction(reportId: string, rowId: string, reasoning: string = "관리자에 의해 수동으로 지휘가 요청되었습니다.") {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('권한이 없습니다.');
    }

    try {
        // AI 추천을 먼저 받아온 후 steering 테이블에 저장
        // (기존 recommendWorkflowAction 로직을 활용하되, 수동 요청임을 명시)
        await recommendWorkflowAction(reportId, rowId, { _manualRequest: true });
        
        // 최근 생성된 steering 항목의 reasoning을 업데이트 (수동 사유 추가)
        const [latest] = await queryTable('workflow_steering', {
            filters: { reportId, rowId, status: 'PENDING' },
            orderBy: 'createdAt',
            orderDirection: 'DESC',
            limit: 1
        });

        if (latest) {
            await updateRows('workflow_steering', {
                reasoning: `[수동 지휘 요청] ${reasoning}\n\n시스템 분석: ${latest.reasoning}`
            }, { filters: { id: latest.id } });
        }

        revalidatePath('/workflow/steering');
        return { success: true };
    } catch (error: any) {
        console.error('[Manual Steering Request Error]:', error);
        throw new Error(error.message || '지휘 요청에 실패했습니다.');
    }
}
