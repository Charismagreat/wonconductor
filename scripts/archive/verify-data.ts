import { queryTable, listTables } from './egdesk-helpers';

async function verifyData() {
    try {
        console.log('--- Verifying System Data ---');
        
        const tables = await listTables();
        console.log('Available Tables:', tables.map((t: any) => t.name).join(', '));

        const depts = await queryTable('department');
        console.log('Departments Count:', depts.length);
        if (depts.length > 0) console.log('Sample Dept:', depts[0].name);

        const tasks = await queryTable('action_task');
        console.log('Tasks Count:', tasks.length);

        const templates = await queryTable('workflow_template');
        console.log('Templates Count:', templates.length);

        const instances = await queryTable('workflow_instance');
        console.log('Instances Count:', instances.length);

        console.log('--- Verification Complete ---');
    } catch (err) {
        console.error('Verification Failed:', err);
    }
}

verifyData();
