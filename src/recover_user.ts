import { createTable, deleteTable, insertRows, updateRows } from './egdesk-helpers.ts';
import fs from 'fs';

async function recoverUser() {
    try {
        console.log("Recovering user table...");
        
        // 1. Schema definition
        const schema: any = [
            { name: 'username', type: 'TEXT', notNull: true },
            { name: 'email', type: 'TEXT' },
            { name: 'password', type: 'TEXT' },
            { name: 'role', type: 'TEXT', notNull: true, defaultValue: 'VIEWER' },
            { name: 'fullName', type: 'TEXT' },
            { name: 'employeeId', type: 'TEXT' },
            { name: 'departmentId', type: 'TEXT' },
            { name: 'position', type: 'TEXT' },
            { name: 'isActive', type: 'INTEGER', defaultValue: 1 },
            { name: 'metadata', type: 'TEXT' },
            { name: 'createdAt', type: 'TEXT', notNull: true },
            { name: '__created_at', type: 'TEXT' },
            { name: '__updated_at', type: 'TEXT' },
            { name: '__creator_id', type: 'TEXT' }
        ];

        // 2. Delete current 'user' table (it's broken)
        try {
            await deleteTable('user');
            console.log("Deleted broken user table.");
        } catch (e) {
            console.log("User table might not exist or failed to delete.");
        }

        // 3. Create 'user' table with full schema
        await createTable('사용자 관리 (System)', schema, { tableName: 'user' });
        console.log("Created user table with full schema.");

        // 4. Load data from backup
        const userData = JSON.parse(fs.readFileSync('user_backup.json', 'utf8'));
        const rowsToInsert = userData.map((u: any) => {
            const { id, ...rest } = u;
            return {
                ...rest,
                __created_at: rest.createdAt || new Date().toISOString(),
                __updated_at: new Date().toISOString(),
                __creator_id: 'system'
            };
        });

        await insertRows('user', rowsToInsert);
        console.log(`Inserted ${rowsToInsert.length} users from backup.`);

        // 5. Update dashboard_master
        const finalColumns = schema.map((s: any) => ({
            name: s.name,
            displayName: s.name, // Simplified for now
            type: s.type.toLowerCase() === 'text' ? 'string' : s.type.toLowerCase(),
            isSystem: s.name.startsWith('__')
        }));
        
        // Fix display names for system columns
        finalColumns.forEach((c: any) => {
            if (c.name === '__created_at') c.displayName = '생성일시';
            if (c.name === '__updated_at') c.displayName = '수정일시';
            if (c.name === '__creator_id') c.displayName = '작성자';
        });

        await updateRows('dashboard_master', { 
            columns: JSON.stringify(finalColumns),
            tableName: 'user'
        }, { filters: { reportId: 'user' } });
        console.log("Updated dashboard_master for user report.");

    } catch (err) {
        console.error("Recovery failed:", err);
    }
}

recoverUser();
