import { queryTable, insertRows } from '@/egdesk-helpers';

/**
 * 워크플로우 템플릿의 변수를 실제 데이터 값으로 치환합니다.
 * 예: "품번 {{part_no}} 입고됨" -> "품번 ABC-123 입고됨"
 */
function substituteVariables(template: string, data: any): string {
    return template.replace(/\{\{(.*?)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();
        return data[trimmedKey] !== undefined ? String(data[trimmedKey]) : match;
    });
}

/**
 * 특정 레포트에 데이터가 추가될 때 워크플로우 분석을 시작합니다.
 * 이제 즉시 실행하지 않고 AI Steering Hub에 추천 조치를 생성합니다.
 */
export async function triggerWorkflow(reportId: string, rowData: any, creatorId: string) {
    console.log(`[Workflow Engine] Initiating AI Steering Analysis for Report: ${reportId}`);
    
    try {
        const { recommendWorkflowAction } = await import('@/app/actions/workflow-steering');
        
        // 1. AI에게 분석 및 조치 추천 요청 (이 로직 내부에서 steering 테이블에 저장됨)
        // rowId를 찾기 위해 queryTable 호출
        const { queryTable } = await import('@/egdesk-helpers');
        const rows = await queryTable('dashboard_data', { 
            filters: { reportId: reportId },
            limit: 1,
            orderBy: 'createdAt',
            orderDirection: 'DESC'
        });
        
        const latestRowId = rows[0]?.id;
        
        if (latestRowId) {
            await recommendWorkflowAction(reportId, latestRowId, rowData);
            console.log(`[Workflow Engine] AI Recommendation request queued for steering.`);
        } else {
            console.warn(`[Workflow Engine] Could not find rowId for report ${reportId}. Skipping recommendation.`);
        }

    } catch (err) {
        console.error('[Workflow Engine] Error during steering initialization:', err);
    }
}
