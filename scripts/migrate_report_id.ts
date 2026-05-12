import { queryTable, deleteTable, createTable, insertRows, getTableSchema } from './egdesk-helpers.ts';

async function migrate() {
    try {
        console.log("Starting report table ID migration using structured tools...");
        
        // 1. 기존 데이터 백업
        const oldReports = await queryTable('report');
        console.log(`Found ${oldReports.length} reports to migrate.`);

        // 2. 기존 테이블 스키마 확인 (다른 컬럼 타입 유지를 위해)
        let oldSchema: any[] = [];
        try {
            oldSchema = await getTableSchema('report');
        } catch (e) {
            console.log("Could not get old schema, using default.");
        }

        // 3. 기존 테이블 삭제
        try {
            await deleteTable('report');
            console.log("Old report table deleted.");
        } catch (e) {
            console.log("Table delete failed or not found, continuing...");
        }

        // 4. 새 테이블 생성 (id: TEXT)
        const newSchema: any[] = [
            { name: 'id', type: 'TEXT', notNull: true },
            { name: 'name', type: 'TEXT', notNull: true },
            { name: 'sheetName', type: 'TEXT' },
            { name: 'description', type: 'TEXT' },
            { name: 'tableName', type: 'TEXT' },
            { name: 'columns', type: 'TEXT' },
            { name: 'uiConfig', type: 'TEXT' },
            { name: 'aiConfig', type: 'TEXT' },
            { name: 'isDeleted', type: 'INTEGER', defaultValue: 0 },
            { name: 'deletedAt', type: 'TEXT' },
            { name: 'ownerId', type: 'TEXT' },
            { name: 'lastSerial', type: 'INTEGER' },
            { name: 'createdAt', type: 'TEXT', notNull: true },
            { name: 'updatedAt', type: 'TEXT' }
        ];

        await createTable('보고서 마스터', newSchema, {
            tableName: 'report',
            uniqueKeyColumns: ['id']
        });
        console.log("New report table created with TEXT ID.");

        // 5. 데이터 이관 (reportId -> id)
        const newRows = oldReports.map((r: any) => {
            const { id, reportId, ...rest } = r;
            // reportId가 "rep-"로 시작하는 논리적 ID면 그것을 id로 사용
            // 없으면 기존 정수 id를 문자열로 변환하여 사용
            const finalId = reportId || String(id);
            return {
                id: finalId,
                ...rest
            };
        });

        if (newRows.length > 0) {
            // 중복 제거 (혹시라도 reportId가 겹치는 경우 대비)
            const uniqueRows = Array.from(new Map(newRows.map(r => [r.id, r])).values());
            await insertRows('report', uniqueRows);
            console.log(`Successfully migrated ${uniqueRows.length} rows.`);
        }

        console.log("Migration completed successfully!");

    } catch (err: any) {
        console.error("Migration failed:", err.message);
        if (err.stack) console.error(err.stack);
    }
}

migrate();
