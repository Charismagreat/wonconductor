import { queryTable, updateRows, listTables, createTable, insertRows, getTableSchema, executeSQL, deleteTable } from '@/egdesk-helpers';
import { SYSTEM_TABLES } from '@/app/actions/shared';
import * as fs from 'fs';
import * as path from 'path';

export interface SystemSettings {
    id: string;
    companyName: string;
    logoUrl: string;
    themeColor: string;
    businessContext: string;
    geminiApiKey?: string;
    isInitialized: boolean;
    updatedAt: string;
}

/**
 * Service to manage system-wide settings for white-labeling and onboarding.
 */
export class SystemConfigService {
    private static readonly SETTINGS_ID = 'global-settings';
    // 시스템 설치 완료 여부를 저장하는 고속 메모리 캐시 필드
    private static isSetupCompleted: boolean | null = null;

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
        console.log(`[SystemConfigService] Discovered ${currentTables.length} tables in DB.`);
        
        const tableNames = new Set(currentTables.map((t: any) => 
            (typeof t === 'string' ? t : (t.tableName || t.name || t.id))?.toLowerCase()
        ));
        
        console.log(`[SystemConfigService] Existing tables:`, Array.from(tableNames));

        // 1. Ensure system_settings table exists
        if (!tableNames.has('system_settings')) {
            console.log('[SystemConfigService] system_settings table missing, creating...');
            await createTable('System Settings', [
                { name: 'legacyId', type: 'TEXT' },
                { name: 'companyName', type: 'TEXT' },
                { name: 'logoUrl', type: 'TEXT' },
                { name: 'themeColor', type: 'TEXT' },
                { name: 'businessContext', type: 'TEXT' },
                { name: 'geminiApiKey', type: 'TEXT' },
                { name: 'isInitialized', type: 'INTEGER', defaultValue: 0 },
                { name: 'backupScheduleEnabled', type: 'INTEGER', defaultValue: 0 },
                { name: 'backupScheduleDays', type: 'TEXT', defaultValue: '1,2,3,4,5,6' },
                { name: 'backupScheduleTime', type: 'TEXT', defaultValue: '03:00' },
                { name: 'backupRetentionCount', type: 'INTEGER', defaultValue: 10 },
                { name: 'updatedAt', type: 'TEXT' }
            ], { tableName: 'system_settings' });
        } else {
            // [Self-Healing] geminiApiKey 컬럼 누락 체크 및 마이그레이션
            try {
                const schemaRes = await getTableSchema('system_settings').catch(() => []);
                const schema = Array.isArray(schemaRes) ? schemaRes : (schemaRes as any)?.columns || (schemaRes as any)?.schema || [];
                const hasGeminiKey = schema.some((c: any) => (c.name || "").toLowerCase() === 'geminiapikey');
                
                if (!hasGeminiKey) {
                    console.log('[SystemConfigService] geminiApiKey column missing. Migrating system_settings table...');
                    
                    // 1. 기존 데이터 백업
                    const queryResult: any = await queryTable('system_settings').catch(() => []);
                    const rows = Array.isArray(queryResult) ? queryResult : (queryResult?.rows || []);
                    
                    // 2. 기존 테이블 삭제
                    await deleteTable('system_settings').catch(() => {});
                    
                    // 3. 신규 스키마로 테이블 생성
                    await createTable('System Settings', [
                        { name: 'legacyId', type: 'TEXT' },
                        { name: 'companyName', type: 'TEXT' },
                        { name: 'logoUrl', type: 'TEXT' },
                        { name: 'themeColor', type: 'TEXT' },
                        { name: 'businessContext', type: 'TEXT' },
                        { name: 'geminiApiKey', type: 'TEXT' },
                        { name: 'isInitialized', type: 'INTEGER', defaultValue: 0 },
                        { name: 'backupScheduleEnabled', type: 'INTEGER', defaultValue: 0 },
                        { name: 'backupScheduleDays', type: 'TEXT', defaultValue: '1,2,3,4,5,6' },
                        { name: 'backupScheduleTime', type: 'TEXT', defaultValue: '03:00' },
                        { name: 'backupRetentionCount', type: 'INTEGER', defaultValue: 10 },
                        { name: 'updatedAt', type: 'TEXT' }
                    ], { tableName: 'system_settings' });
                    
                    // 4. 데이터 복구 (새 컬럼은 null로 들어감)
                    if (rows.length > 0) {
                        await insertRows('system_settings', rows);
                        console.log(`[SystemConfigService] Restored ${rows.length} rows to system_settings`);
                    }
                    console.log('[SystemConfigService] Migration of system_settings completed successfully.');
                }
            } catch (err: any) {
                console.warn('[SystemConfigService] Failed to migrate system_settings:', err.message);
            }
        }

        // 2. Ensure all other SYSTEM_TABLES exist
        for (const table of SYSTEM_TABLES) {
            const tNameLower = table.tableName.toLowerCase();
            if (!tableNames.has(tNameLower)) {
                console.log(`[SystemConfigService] Table '${table.tableName}' missing, creating with schema:`, JSON.stringify(table.schema, null, 2));
                try {
                    await createTable(table.displayName, table.schema, { tableName: table.tableName });
                    console.log(`[SystemConfigService] Created table: ${table.tableName}`);
                } catch (e: any) {
                    console.warn(`[SystemConfigService] Failed to create table ${table.tableName}:`, e.message);
                }
            } else {
                console.log(`[SystemConfigService] Table '${table.tableName}' already exists.`);
                // [Self-Healing] 컬럼 누락 체크 (특히 report 테이블의 id 컬럼)
                try {
                    const schemaRes = await getTableSchema(table.tableName).catch(() => []);
                    const schema = Array.isArray(schemaRes) ? schemaRes : (schemaRes as any)?.columns || (schemaRes as any)?.schema || [];
                    const hasId = schema.some((c: any) => (c.name || c.id || "").toLowerCase() === 'id');
                    
                    if (!hasId && table.tableName === 'dashboard_master') {
                        const backupPath = path.join(process.cwd(), 'dashboard_master_backup.json');
                        const backupExists = fs.existsSync(backupPath);
                        
                        if (backupExists) {
                            console.log(`[SystemConfigService] Migrating 'dashboard_master' table to include 'id' column using backup file...`);
                            
                            // 1. 기존 테이블 삭제
                            await deleteTable('dashboard_master').catch(() => {});
                            
                            // 2. 신규 테이블 생성 (id 포함)
                            await createTable(table.displayName, table.schema, { tableName: table.tableName });
                            
                            // 3. 백업 파일에서 데이터 복구
                            const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
                            if (Array.isArray(backupData) && backupData.length > 0) {
                                await insertRows('dashboard_master', backupData);
                            }
                            console.log(`[SystemConfigService] Migration of 'dashboard_master' table completed successfully from backup file.`);
                        } else {
                            console.warn(`[SystemConfigService] WARNING: 'dashboard_master' schema mismatch but no backup file found. Skipping destructive migration to prevent data loss.`);
                        }
                    }

                    // [Self-Healing] dashboard_data 테이블의 contentHash 컬럼 누락 체크
                    const hasContentHash = schema.some((c: any) => (c.name || "").toLowerCase() === 'contenthash');
                    if (!hasContentHash && table.tableName === 'dashboard_data') {
                        const backupPath = path.join(process.cwd(), 'dashboard_data_backup.json');
                        const backupExists = fs.existsSync(backupPath);

                        if (backupExists) {
                            console.log(`[SystemConfigService] Migrating 'dashboard_data' table to include 'contentHash' column using backup file...`);
                            
                            // 1. 기존 테이블 삭제
                            await deleteTable('dashboard_data').catch(() => {});
                            
                            // 2. 신규 테이블 생성 (필수 컬럼 포함)
                            const schemaWithoutId = table.schema.filter((c: any) => c.name.toLowerCase() !== 'id');
                            await createTable(table.displayName, schemaWithoutId, { tableName: table.tableName });
                            
                            // 3. 백업 파일에서 데이터 복구
                            const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
                            if (Array.isArray(backupData) && backupData.length > 0) {
                                await insertRows('dashboard_data', backupData);
                            }
                            console.log(`[SystemConfigService] Migration of 'dashboard_data' table completed successfully from backup file.`);
                        } else {
                            console.warn(`[SystemConfigService] WARNING: 'dashboard_data' schema mismatch but no backup file found. Skipping destructive migration.`);
                        }
                    }
                    // [Self-Healing] dashboard_chart 테이블의 __is_deleted 및 orderIndex 컬럼 누락 체크 (강화된 감지)
                    const hasIsDeleted = schema.some((c: any) => (c.name || c.id || "").toLowerCase() === '__is_deleted');
                    const hasOrderIndex = schema.some((c: any) => (c.name || "").toLowerCase() === 'orderindex');
                    if ((!hasIsDeleted || !hasOrderIndex) && table.tableName === 'dashboard_chart') {
                        console.log(`[SystemConfigService] 🚨 CRITICAL: 'dashboard_chart' table schema mismatch (missing isDeleted or orderIndex). Starting emergency migration...`);
                        
                        // 1. 기존 데이터 백업
                        const queryResult: any = await queryTable('dashboard_chart').catch(() => []);
                        const rows = Array.isArray(queryResult) ? queryResult : (queryResult?.rows || []);
                        
                        console.log(`[SystemConfigService] Backing up ${rows.length} rows from dashboard_chart.`);
                        
                        // 2. 기존 테이블 삭제
                        await deleteTable('dashboard_chart').catch(() => {});
                        
                        // 3. 신규 테이블 생성
                        await createTable(table.displayName, table.schema, { tableName: table.tableName });
                        
                        // 4. 데이터 복구 (orderIndex 값 순차 부여 및 데이터타입 변환)
                        if (rows.length > 0) {
                            const rowsToInsert = rows.map((r: any, idx: number) => ({
                                ...r,
                                orderIndex: r.orderIndex !== undefined ? Number(r.orderIndex) : idx,
                                isSample: r.isSample !== undefined ? Number(r.isSample) : 0,
                                __is_deleted: r.__is_deleted !== undefined ? Number(r.__is_deleted) : 0
                            }));
                            await insertRows('dashboard_chart', rowsToInsert);
                            console.log(`[SystemConfigService] ✅ Successfully migrated and restored ${rowsToInsert.length} rows to dashboard_chart.`);
                        } else {
                            console.log(`[SystemConfigService] ✅ Recreated empty dashboard_chart table with correct schema.`);
                        }
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

            // 셋업 상태가 변경되었을 수 있으므로 안전하게 캐시 무효화
            this.isSetupCompleted = null;

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
        // 이미 셋업 완료가 확인되었으면 0ms만에 바이패스 처리
        if (this.isSetupCompleted === true) {
            return false;
        }

        try {
            const settings = await this.getSettings();
            if (!settings || !settings.isInitialized) {
                return true;
            }

            // Also check if at least one active admin user exists
            const result = await queryTable('user', { filters: { role: 'ADMIN', isActive: 1 }, limit: 1 });
            const admins = Array.isArray(result) ? result : (result?.rows || []);
            const isRequired = admins.length === 0;

            // 셋업 완료가 확인되면 고속 캐시 활성화
            if (!isRequired) {
                this.isSetupCompleted = true;
                console.log('[SystemConfigService] Cache hit! Setting isSetupCompleted = true');
            }

            return isRequired;
        } catch (error) {
            // If user table doesn't exist, queryTable will throw, which means setup is required
            return true;
        }
    }

    /**
     * Get the Gemini API key, prioritizing the one from the database.
     * Falls back to process.env.GEMINI_API_KEY if not set in DB.
     */
    static async getGeminiApiKey(): Promise<string> {
        const settings = await this.getSettings();
        return settings?.geminiApiKey || process.env.GEMINI_API_KEY || "";
    }
}

