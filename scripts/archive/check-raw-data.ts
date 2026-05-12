import { queryTable } from './egdesk-helpers';

async function checkRawData() {
    try {
        const depts = await queryTable('department');
        console.log('--- DEPARTMENTS ---');
        console.log(JSON.stringify(depts, null, 2));

        const tasks = await queryTable('action_task');
        console.log('--- ACTION TASKS ---');
        console.log(JSON.stringify(tasks, null, 2));
    } catch (err) {
        console.error('Check failed:', err);
    }
}

checkRawData();
