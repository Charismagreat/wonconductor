import { queryTable } from './egdesk-helpers.ts';

async function check() {
    try {
        const rows = await queryTable('micro_app_projects', { limit: 10 });
        console.log(JSON.stringify(rows, null, 2));
    } catch (e: any) {
        console.error(e.message);
    }
}

check();
