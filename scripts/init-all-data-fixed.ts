import { insertRows, queryTable } from './egdesk-helpers';

async function initAllDataFixed() {
    try {
        console.log('--- Starting Targeted Data Initialization ---');
        
        // 1. Departments (Ensure no overlap)
        const depts = [
            { id: 'dept-sales', name: '영업팀', description: '고객사 관리 및 신규 영업', createdAt: new Date().toISOString() },
            { id: 'dept-quality', name: '품질관리팀', description: '제품 품질 검사 및 이슈 대응', createdAt: new Date().toISOString() },
            { id: 'dept-production', name: '생산관리팀', description: '생산 공정 및 납품 관리', createdAt: new Date().toISOString() }
        ];
        await insertRows('department', depts).catch(e => console.log('Dept insert warning:', e.message));

        // 2. Lee Team Leader's Action Tasks (Including mandatory instanceId)
        const tasks = [
            {
                id: 'task-issue-band-discoloration',
                instanceId: 'manual-trigger',
                title: '밴드 0.15 제품 변색 제거 작업',
                description: '샤든코리아, 인텍 납품 전 밴드 변색 제거 필요',
                type: 'ISSUE',
                status: 'TODO',
                assigneeId: 'lee-team-leader',
                assigneeRole: 'MANAGER',
                dueAt: new Date(Date.now() + 86400000).toISOString()
            },
            {
                id: 'task-hyosung-misdelivery',
                instanceId: 'manual-trigger',
                title: '효성 X568914 미납 건 조치',
                description: '효성 미납 이슈 확인 및 긴급 대응',
                type: 'ISSUE',
                status: 'TODO',
                assigneeId: 'lee-team-leader',
                assigneeRole: 'MANAGER',
                dueAt: new Date(Date.now() + 86400000).toISOString()
            }
        ];

        await insertRows('action_task', tasks).catch(e => console.log('Task insert warning:', e.message));
        
        console.log('--- Initialization Complete ---');
    } catch (err) {
        console.error('Failed to init data:', err);
    }
}

initAllDataFixed();
