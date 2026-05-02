import { queryTable } from './egdesk-helpers.ts';

async function check() {
    try {
        const reports = await queryTable('dashboard_master', { filters: { reportId: 'user' } });
        console.log("User Report in Master:", reports);
        
        const allReports = await queryTable('dashboard_master');
        const userReport = allReports.find((r: any) => r.reportId === 'user' || r.tableName === 'user' || r.name.includes('User'));
        console.log("Found User Report:", userReport);
    } catch (err) {
        console.error("Failed to query dashboard_master:", err);
    }
}

check();
