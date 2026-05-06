import { queryTable, updateRows, listTables, createTable, insertRows, getTableSchema, executeSQL, deleteTable } from '@/egdesk-helpers';
import { SYSTEM_TABLES } from '@/app/actions/shared';

export interface SystemSettings {
    id: string;
    companyName: string;
    logoUrl: string;
    themeColor: string;
    businessContext: string;
    isInitialized: boolean;
    updatedAt: string;
}

/**
 * Service to manage system-wide settings for white-labeling and onboarding.
 */
export class SystemConfigService {
    private static readonly SETTINGS_ID = 'global-settings';

    /**
     * Retrieve the global system settings.
     */
    static async getSettings(): Promise<SystemSettings | null> {
        try {
            // First, check if the table exists to avoid unnecessary 500 logs during setup
            const result = await listTables();
            const tables = Array.isArray(result) ? result : (result?.tables || []);
            const tableExists = tables.some((t: any) => 
                (typeof t === 'string' && t === 'system_settings') || 
                (t.tableName === 'system_settings') ||
                (t.name === 'system_settings')
            );

            if (!tableExists) {
                // Table doesn't exist yet, which is expected during initial setup
                return null;
            }

            const queryResult: any = await queryTable('system_settings', { 
                filters: { legacyId: this.SETTINGS_ID } 
            });
            
            const rows = Array.isArray(queryResult) ? queryResult : (queryResult?.rows || []);
            const settings = rows[0] || null;
            if (settings) {
                // SQLite uses 0/1 for booleans; convert to native boolean
                settings.isInitialized = Number(settings.isInitialized) === 1;
                settings.backupScheduleEnabled = Number(settings.backupScheduleEnabled) === 1;
            }
            return settings;
        } catch (error) {
            // Only log if it's not a missing table issue (already handled above)
            // But we keep this catch for other potential connection issues
            console.error('[SystemConfigService] Could not fetch settings. Error details:', error);
            return null;
        }
    }

    /**
     * Ensures all core system tables exist.
     */
    static async ensureSystemTables(): Promise<void> {
        let result;
        try {
            result = await listTables();
        } catch (e: any) {
            throw new Error(`listTables failed: ${e.message}`);
        }

        const currentTables = Array.isArray(result) ? result : (result?.tables || []);
        const tableNames = new Set(currentTables.map((t: any) => 
            (typeof t === 'string' ? t : (t.tableName || t.name))?.toLowerCase()
        ));

        // 1. Ensure system_settings table exists
        if (!tableNames.has('system_settings')) {
            console.log('[SystemConfigService] system_settings table missing, creating...');
            await createTable('System Settings', [
                { name: 'legacyId', type: 'TEXT' },
                { name: 'companyName', type: 'TEXT' },
                { name: 'logoUrl', type: 'TEXT' },
                { name: 'themeColor', type: 'TEXT' },
                { name: 'businessContext', type: 'TEXT' },
                { name: 'isInitialized', type: 'INTEGER', defaultValue: 0 },
                { name: 'backupScheduleEnabled', type: 'INTEGER', defaultValue: 0 },
                { name: 'backupScheduleDays', type: 'TEXT', defaultValue: '1,2,3,4,5,6' },
                { name: 'backupScheduleTime', type: 'TEXT', defaultValue: '03:00' },
                { name: 'backupRetentionCount', type: 'INTEGER', defaultValue: 10 },
                { name: 'updatedAt', type: 'TEXT' }
            ], { tableName: 'system_settings' });
        }

        // 2. Ensure all other SYSTEM_TABLES exist
        for (const table of SYSTEM_TABLES) {
            if (!tableNames.has(table.tableName.toLowerCase())) {
                try {
                    await createTable(table.displayName, table.schema, { tableName: table.tableName });
                    console.log(`[SystemConfigService] Created table: ${table.tableName}`);
                } catch (e: any) {
                    console.warn(`[SystemConfigService] Failed to create table ${table.tableName}:`, e.message);
                }
            } else {
                // [Self-Healing] 컬럼 누락 체크 (특히 report 테이블의 id 컬럼)
                try {
                    const schema = await getTableSchema(table.tableName).catch(() => []);
                    const hasId = schema.some((c: any) => c.name.toLowerCase() === 'id');
                    
                    if (!hasId && table.tableName === 'dashboard_master') {
                        console.log(`[SystemConfigService] Migrating 'dashboard_master' table to include 'id' column...`);
                        
                        // 1. 기존 데이터 백업
                        const oldRows = await queryTable('dashboard_master', { limit: 10000 }).catch(() => []);
                        
                        // 2. 기존 테이블 삭제
                        await deleteTable('dashboard_master').catch(() => {});
                        
                        // 3. 신규 테이블 생성 (id 포함)
                        await createTable(table.displayName, table.schema, { tableName: table.tableName });
                        
                        // 4. 데이터 복구
                        if (oldRows.length > 0) {
                            await insertRows('dashboard_master', oldRows);
                        }
                        console.log(`[SystemConfigService] Migration of 'dashboard_master' table completed successfully.`);
                    }

                    // [Self-Healing] dashboard_data 테이블의 contentHash 컬럼 누락 체크
                    const hasContentHash = schema.some((c: any) => c.name.toLowerCase() === 'contenthash');
                    if (!hasContentHash && table.tableName === 'dashboard_data') {
                        console.log(`[SystemConfigService] Migrating 'dashboard_data' table to include 'contentHash' column...`);
                        
                        // 1. 기존 데이터 백업
                        const oldRows = await queryTable('dashboard_data', { limit: 50000 }).catch(() => []);
                        
                        // 2. 기존 테이블 삭제
                        await deleteTable('dashboard_data').catch(() => {});
                        
                        // 3. 신규 테이블 생성 (필수 컬럼 포함)
                        const schemaWithoutId = table.schema.filter((c: any) => c.name.toLowerCase() !== 'id');
                        await createTable(table.displayName, schemaWithoutId, { tableName: table.tableName });
                        
                        // 4. 데이터 복구 (기존에 데이터가 있었다면 다시 삽입)
                        if (oldRows.length > 0) {
                            // contentHash가 없는 데이터들이므로, RowService를 통해 복구하는 로직은 별도 스크립트로 실행하거나 
                            // 여기서는 기본값 null로 삽입 (이후 등록되는 데이터부터 정상 작동)
                            await insertRows('dashboard_data', oldRows.map((r: any) => ({
                                ...r,
                                contentHash: r.contentHash || null
                            })));
                        }
                        console.log(`[SystemConfigService] Migration of 'dashboard_data' table completed successfully.`);
                    }
                } catch (err: any) {
                    console.warn(`[SystemConfigService] Schema check failed for ${table.tableName}:`, err.message);
                }
            }
        }
    }

    /**
     * Update the global system settings.
     * Ensures the table and initial row exist before updating.
     */
    static async updateSettings(updates: Partial<SystemSettings>): Promise<boolean> {
        try {
            // 1. Ensure the table exists
            await this.ensureSystemTables();

            // 2. Prepare data for update
            const dataToUpdate: any = { ...updates };
            if (updates.isInitialized !== undefined) {
                dataToUpdate.isInitialized = updates.isInitialized ? 1 : 0;
            }
            if (updates.backupScheduleEnabled !== undefined) {
                dataToUpdate.backupScheduleEnabled = updates.backupScheduleEnabled ? 1 : 0;
            }
            dataToUpdate.updatedAt = new Date().toISOString();

            console.log('[SystemConfigService] Checking for existing record with ID:', this.SETTINGS_ID);
            
            // 3. Check if the record already exists
            let queryResult;
            try {
                queryResult = await queryTable('system_settings', { 
                    filters: { legacyId: this.SETTINGS_ID } 
                });
            } catch (e: any) {
                throw new Error(`queryTable(system_settings) failed: ${e.message}`);
            }

            const rows = Array.isArray(queryResult) ? queryResult : (queryResult?.rows || []);
            
            if (rows && rows.length > 0) {
                console.log('[SystemConfigService] Record exists, updating...');
                // Update existing record
                try {
                    await updateRows('system_settings', dataToUpdate, { 
                        filters: { legacyId: this.SETTINGS_ID } 
                    });
                } catch (e: any) {
                    throw new Error(`updateRows(system_settings) failed: ${e.message}`);
                }
            } else {
                console.log('[SystemConfigService] Record missing, inserting...');
                // Insert new record
                dataToUpdate.legacyId = this.SETTINGS_ID;
                // Add default theme if missing for the first insertion
                if (dataToUpdate.themeColor === undefined) {
                    dataToUpdate.themeColor = '#2563eb';
                }
                try {
                    await insertRows('system_settings', [dataToUpdate]);
                } catch (e: any) {
                    throw new Error(`insertRows(system_settings) failed: ${e.message}`);
                }
            }

            // 스케줄러 업데이트 트리거
            const { BackupScheduler } = await import('./backup-scheduler');
            await BackupScheduler.update();

            return true;
        } catch (error: any) {
            console.error('[SystemConfigService] Failed to update settings:', error);
            return false;
        }
    }

    /**
     * Checks if the system needs initial setup.
     * Required if system_settings table doesn't exist, isInitialized is false, OR no active admin user exists.
     */
    static async isSystemSetupRequired(): Promise<boolean> {
        try {
            const settings = await this.getSettings();
            if (!settings || !settings.isInitialized) {
                return true;
            }

            // Also check if at least one active admin user exists
            const result = await queryTable('user', { filters: { role: 'ADMIN', isActive: 1 }, limit: 1 });
            const admins = Array.isArray(result) ? result : (result?.rows || []);
            return admins.length === 0;
        } catch (error) {
            // If user table doesn't exist, queryTable will throw, which means setup is required
            return true;
        }
    }
}

