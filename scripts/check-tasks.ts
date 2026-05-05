import { queryTable, updateRows } from '../egdesk-helpers';

async function main() {
    const raw = await queryTable('action_task', { orderBy: 'createdAt', orderDirection: 'DESC', limit: 20 });
    const tasks = Array.isArray(raw) ? raw : (raw as any)?.rows ?? [];
    console.log('Tasks:', JSON.stringify(tasks, null, 2));

    // Fix tasks with null assigneeId — assign to gyeong_jiwon (id=11)
    const nullTasks = tasks.filter((t: any) => !t.assigneeId);
    if (nullTasks.length > 0) {
        for (const t of nullTasks) {
            await updateRows('action_task', { assigneeId: '11' }, { filters: { id: String(t.id) } });
            console.log(`✅ Assigned task id=${t.id} "${t.title}" to gyeong_jiwon`);
        }
    } else {
        console.log('No null-assignee tasks found.');
    }
}

main().catch(console.error);
