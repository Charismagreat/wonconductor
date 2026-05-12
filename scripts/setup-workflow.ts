import { insertRows, queryTable } from './egdesk-helpers';

async function setupTestWorkflow() {
    try {
        console.log('--- Setting up Workflow Template ---');
        
        // 1. Find Quality Report ID (if exists, or use a dummy)
        const reports = await queryTable('report', { limit: 100 });
        // Let's assume a report ID or create a dummy rule for report with 'system' ownership
        const targetReportId = reports[0]?.id || 'report-123';

        const template = {
            id: 'wf-tpl-quality-issue',
            name: '현장 품질 이슈 자동 대응',
            triggerReportId: targetReportId,
            triggerCondition: '*', // 모든 입력에 트리거
            tasks: JSON.stringify([
                {
                    title: '신규 품질 이슈 확인 요청: {{name}}',
                    description: '현장에서 새 이슈가 등록되었습니다. [{{memo}}] 내용을 확인하고 조치 바랍니다.',
                    type: 'ISSUE',
                    assigneeId: 'lee-team-leader',
                    assigneeRole: 'MANAGER',
                    dueDays: 2
                }
            ]),
            createdAt: new Date().toISOString()
        };

        await insertRows('workflow_template', [template]);
        console.log(`✓ Workflow template created for Report ID: ${targetReportId}`);
        console.log('--- Setup Complete ---');
    } catch (err) {
        console.error('Failed to setup workflow:', err);
    }
}

setupTestWorkflow();
