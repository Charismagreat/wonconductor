import { insertRows, queryTable } from './egdesk-helpers';

async function initAllData() {
    try {
        console.log('--- Starting Data Initialization ---');
        
        // 1. Departments Init
        const existingDepts = await queryTable('department');
        if (existingDepts.length === 0) {
            const depts = [
                { id: 'dept-sales', name: '영업팀', description: '고객사 관리 및 신규 영업', createdAt: new Date().toISOString() },
                { id: 'dept-quality', name: '품질관리팀', description: '제품 품질 검사 및 이슈 대응', createdAt: new Date().toISOString() },
                { id: 'dept-production', name: '생산관리팀', description: '생산 공정 및 납품 관리', createdAt: new Date().toISOString() }
            ];
            await insertRows('department', depts);
            console.log('✓ Departments created.');
        } else {
            console.log('- Departments already exist.');
        }

        // 2. Lee Team Leader's Action Tasks (From message)
        const tasks = [
            {
                id: 'task-issue-band-discoloration',
                title: '밴드 0.15 제품 변색 제거 작업',
                description: '샤든코리아, 인텍 납품 전 밴드 변색 제거 필요',
                type: 'ISSUE',
                status: 'TODO',
                assigneeId: 'lee-team-leader',
                assigneeRole: 'MANAGER',
                dueAt: new Date(Date.now() + 86400000).toISOString() // Tomorrow
            },
            {
                id: 'task-hyosung-misdelivery',
                title: '효성 X568914 미납 건 조치',
                description: '효성 미납 이슈 확인 및 긴급 대응',
                type: 'ISSUE',
                status: 'TODO',
                assigneeId: 'lee-team-leader',
                assigneeRole: 'MANAGER',
                dueAt: new Date(Date.now() + 86400000).toISOString()
            },
            {
                id: 'task-hyosung-meeting',
                title: '효성 구매/개발팀 미팅 진행',
                description: '납품 후 구매팀, 개발팀 미팅 (김래현 이사 동행)',
                type: 'MEETING',
                status: 'TODO',
                assigneeId: 'lee-team-leader',
                assigneeRole: 'MANAGER',
                dueAt: '2026-04-10T07:30:00Z'
            },
            {
                id: 'task-ls-terminal',
                title: 'LS일렉트릭 터미널 제품 적용 컨택',
                description: '정재호 매니저와 터미널 제품 적용 진행 중',
                type: 'SALES',
                status: 'IN_PROGRESS',
                assigneeId: 'lee-team-leader',
                assigneeRole: 'MANAGER'
            }
        ];

        // 중복 방지를 위해 기존 과업 확인 후 삽입 (생략 가능하나 안전을 위해)
        await insertRows('action_task', tasks);
        console.log('✓ Initial tasks for Lee Team Leader created.');
        
        console.log('--- Initialization Complete ---');
    } catch (err) {
        console.error('Failed to init data:', err);
    }
}

initAllData();
