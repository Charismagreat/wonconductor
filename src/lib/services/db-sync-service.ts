import { queryTable, insertRows, updateRows, deleteRows, createTable, deleteTable, renameTable } from '@/egdesk-helpers';
import { castToPhysicalValue } from '@/lib/db-utils';
import fs from 'fs/promises';

export class DbSyncService {
    private static logPath = 'schema_sync_trace.log';

    private static async log(level: 'INFO' | 'ERROR', msg: string) {
        const entry = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
        await fs.appendFile(this.logPath, entry).catch(() => {});
    }

    /**
     * 데이터를 물리 테이블에 동기화합니다.
     */
    static async syncToPhysicalTable(
        tableName: string,
        data: any,
        columns: any[],
        filters: Record<string, string>
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const physicalData: any = {};
            columns.forEach((col: any) => {
                if (data[col.name] !== undefined) {
                    physicalData[col.name] = castToPhysicalValue(data[col.name], col.type);
                }
            });

            if (Object.keys(filters).length > 0) {
                await updateRows(tableName, physicalData, { filters });
            }
            return { success: true };
        } catch (err: any) {
            console.error(`[DbSyncService] Physical sync failed for ${tableName}:`, err);
            return { success: false, error: err.message };
        }
    }

    /**
     * 물리 테이블에 행을 삽입합니다.
     */
    static async insertToPhysicalTable(
        tableName: string,
        rows: any[],
        columns: any[]
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const physicalRows = rows.map(rowData => {
                const physicalData: any = {};
                columns.forEach((col: any) => {
                    physicalData[col.name] = castToPhysicalValue(rowData[col.name], col.type);
                });
                return physicalData;
            });

            await insertRows(tableName, physicalRows);
            return { success: true };
        } catch (err: any) {
            console.error(`[DbSyncService] Physical insert failed for ${tableName}:`, err);
            return { success: false, error: err.message };
        }
    }

    /**
     * 물리 테이블에서 행을 삭제합니다.
     */
    static async deleteFromPhysicalTable(
        tableName: string,
        filters: Record<string, string>
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await deleteRows(tableName, { filters });
            return { success: true };
        } catch (err: any) {
            console.error(`[DbSyncService] Physical delete failed for ${tableName}:`, err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Blue-Green 마이그레이션 방식으로 스키마를 변경하고 데이터를 이관합니다.
     */
    static async migratePhysicalTable(
        reportId: string,
        reportName: string,
        currentTableName: string,
        oldColumns: any[],
        newColumns: any[],
        newName?: string
    ): Promise<string> { // returns newTableName
        await this.log('INFO', `Starting Blue-Green Migration for report ${reportId}.`);

        // 1) 신규 테이블명 생성
        const suffix = Date.now().toString(36).slice(-5);
        const newTableName = `tb_${reportId}_${suffix}`;
        await this.log('INFO', `Step 1: Generated new table name: ${newTableName}`);

        // 2) 신규 테이블 생성
        const tableSchema = newColumns.map((c: any) => ({
            name: c.name,
            type: ((c.type === 'number' || c.type === 'currency') ? 'INTEGER' : 'TEXT') as 'TEXT' | 'INTEGER'
        }));
        const finalDisplayName = (newName || reportName) + ' (Sync)';
        await createTable(finalDisplayName, tableSchema, { tableName: newTableName });
        await this.log('INFO', `Step 2: Created new table ${newTableName}.`);

        // 3) 기존 데이터 이관
        const existingData = await queryTable(currentTableName, { limit: 100000 });
        if (existingData && existingData.length > 0) {
            const migratedData = existingData.map((row: any) => {
                const newRow: any = {};
                newColumns.forEach((newCol: any) => {
                    const oldCol = oldColumns.find((oc: any) => 
                        (newCol.id && oc.id === newCol.id) || 
                        (!newCol.id && oc.name === newCol.name)
                    );
                    newRow[newCol.name] = oldCol ? row[oldCol.name] : null;
                });
                return newRow;
            });
            
            await insertRows(newTableName, migratedData);
            await this.log('INFO', `Step 3: Migrated ${existingData.length} rows.`);
        }

        // 4) 구 테이블 삭제 시도
        try {
            await deleteTable(currentTableName);
            await this.log('INFO', `Step 4: Deleted old table ${currentTableName}.`);
        } catch (delErr: any) {
            await this.log('ERROR', `Step 4 Warning: Failed to delete old table: ${delErr.message}.`);
        }

        // 5) table_master 업데이트
        try {
            const tableMasterRows = await queryTable('table_master', { filters: { tableName: currentTableName } });
            const tableMasterRow = Array.isArray(tableMasterRows) ? tableMasterRows[0] : (tableMasterRows?.rows?.[0]);
            
            if (tableMasterRow) {
                await updateRows('table_master', {
                    tableName: newTableName,
                    schema: JSON.stringify(newColumns),
                    updatedAt: new Date().toISOString()
                }, { filters: { tableName: currentTableName } });
            } else {
                await insertRows('table_master', [{
                    tableName: newTableName,
                    displayName: reportName,
                    category: 'EXCEL', // Default for migrated tables
                    schema: JSON.stringify(newColumns),
                    createdAt: new Date().toISOString()
                }]);
            }
        } catch (e) {
            await this.log('ERROR', `Step 5 Warning: Failed to update table_master: ${e instanceof Error ? e.message : String(e)}`);
        }

        await this.log('INFO', `Blue-Green Migration COMPLETED for report ${reportId}.`);
        return newTableName;
    }
}
