
import { createTable } from './egdesk-helpers';

async function setup() {
    console.log('--- Setting up Guardrail Table ---');
    try {
        await createTable('Input Guardrails', [
            { name: 'id', type: 'TEXT', notNull: true },
            { name: 'reportId', type: 'TEXT', notNull: true },
            { name: 'columnName', type: 'TEXT', notNull: true },
            { name: 'ruleType', type: 'TEXT', notNull: true },
            { name: 'ruleValue', type: 'TEXT' },
            { name: 'severity', type: 'TEXT', notNull: true },
            { name: 'errorMessage', type: 'TEXT' },
            { name: 'adminAdvice', type: 'TEXT' },
            { name: 'createdAt', type: 'DATE' }
        ], {
            tableName: 'input_guardrail',
            description: '관리자가 설정한 데이터 입력 제한 규칙 테이블'
        });
        console.log('Success: input_guardrail table created.');
    } catch (err) {
        console.error('Error creating table:', err.message);
    }
}

setup();
