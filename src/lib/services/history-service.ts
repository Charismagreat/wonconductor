import { queryTable, insertRows } from '@/egdesk-helpers';

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE';

export class HistoryService {
    private static tableName = 'dashboard_data_history';

    /**
     * 이력 테이블이 존재하는지 확인하고 없으면 생성합니다.
     */
    static async ensureHistoryTable() {
        try {
            await queryTable(this.tableName, { limit: 1 });
        } catch (err: any) {
            const msg = String(err.message || err);
            if (msg.includes('no such table')) {
                const { createTable } = await import('@/egdesk-helpers');
                const tableDef = (await import('@/app/actions/shared')).SYSTEM_TABLES.find(t => t.tableName === this.tableName);
                if (tableDef) {
                    await createTable(tableDef.displayName, tableDef.schema, { tableName: this.tableName });
                }
            }
        }
    }

    /**
     * 특정 행의 변경 이력을 기록합니다.
     */
    static async recordHistory(
        rowId: string,
        oldData: any,
        newData: any,
        changeType: ChangeType,
        userId: string
    ) {
        try {
            await this.ensureHistoryTable();

            const historyData = {
                rowId: String(rowId),
                oldData: typeof oldData === 'string' ? oldData : JSON.stringify(oldData),
                newData: typeof newData === 'string' ? newData : JSON.stringify(newData),
                changeType,
                changedById: String(userId || 'system'),
                changedAt: new Date().toISOString()
            };

            await insertRows(this.tableName, [historyData]);
        } catch (error) {
            console.error('[HistoryService] Failed to record history:', error);
            // 이력 기록 실패가 전체 작업 중단으로 이어지지 않도록 예외 처리
        }
    }
}
