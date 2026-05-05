/**
 * One-time seed: create a 경영지원팀 VIEWER user
 * Run with: npx tsx scripts/seed-gyeong-user.ts
 */
import { insertRows, queryTable } from '../egdesk-helpers';

async function main() {
    // Check if already exists
    const existing = await queryTable('user', { filters: { username: 'gyeong_jiwon' } });
    const existingList = Array.isArray(existing) ? existing : (existing as any)?.rows ?? [];
    if (existingList.length > 0) {
        console.log('User already exists:', existingList[0]);
        return;
    }

    const result = await insertRows('user', [{
        username: 'gyeong_jiwon',
        role: 'VIEWER',
        fullName: '김지원',
        employeeId: 'EMP-301',
        department: '경영지원팀',
        isActive: 1,
        createdAt: new Date().toISOString(),
    }]);

    console.log('✅ Created 경영지원팀 user:', result);
}

main().catch(console.error);
