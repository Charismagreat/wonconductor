'use server';

import { 
    createTable, 
    insertRows, 
    queryTable, 
    deleteRows, 
    listTables,
    deleteTable
} from '@/egdesk-helpers';
import { SAMPLE_DEPARTMENTS, SAMPLE_USERS, SAMPLE_TAG } from '@/lib/constants/system-samples';
import { INDUSTRY_TEMPLATES } from '@/lib/constants/industry-templates';
import { DEMO_DASHBOARD_CHARTS } from '@/lib/constants/dashboard-samples';
import { SystemConfigService } from './system-config-service';
import { 
    loadAllPinnedChartsAction, 
    saveAllPinnedChartsAction 
} from '@/lib/services/chart-service';

/**
 * One-click installation of the full industry suite + organizational samples.
 */
export async function initializeDemoSetupAction() {
    console.log('[DemoService] Starting Full Suite Initialization...');
    
    // 0. Ensure system tables exist
    await SystemConfigService.ensureSystemTables();
    
    // 1. Initialize Departments
    console.log('[DemoService] Creating Departments...');
    const deptRows = SAMPLE_DEPARTMENTS.map(d => ({
        ...d,
        metadata: SAMPLE_TAG,
        createdAt: new Date().toISOString()
    }));
    await insertRows('department', deptRows);

    // 2. Initialize Sample Users
    console.log('[DemoService] Creating Sample Users...');
    const userRows = SAMPLE_USERS.map(u => ({
        ...u,
        isActive: 1,
        metadata: SAMPLE_TAG,
        createdAt: new Date().toISOString()
    }));
    await insertRows('user', userRows);

    // 3. Create 100 Industry Tables & Inject Samples
    console.log('[DemoService] Creating Industry Tables and Registering as Reports...');
    for (const tpl of INDUSTRY_TEMPLATES) {
        try {
            // Prepare columns for physical table
            const physicalColumns = tpl.schema.map(col => ({
                name: col.name,
                type: col.type,
                notNull: col.notNull || false
            }));

            // Prepare columns for virtual report mapping
            const reportColumns = tpl.schema.map(col => ({
                id: col.name,
                name: col.displayName,
                type: col.type.toLowerCase() === 'text' ? 'string' : 
                      col.type.toLowerCase() === 'real' ? 'number' : 
                      col.type.toLowerCase() === 'integer' ? 'number' :
                      col.type.toLowerCase(),
                isRequired: col.notNull || false
            }));

            // Ensure mandatory system columns exist for syncing
            if (!physicalColumns.find(c => c.name === 'metadata')) {
                physicalColumns.push({ name: 'metadata', type: 'TEXT', notNull: false });
            }
            if (!physicalColumns.find(c => c.name === 'isDeleted')) {
                physicalColumns.push({ name: 'isDeleted', type: 'INTEGER', notNull: false });
            }

            // Clean Install: 기존 테이블이 있으면 삭제 후 최신 스키마로 재생성
            try {
                await deleteTable(tpl.id);
            } catch (e) {
                // Table might not exist, skip
            }

            // Create Physical Table
            await createTable(
                tpl.displayName, 
                physicalColumns, 
                { tableName: tpl.id }
            );

            // Register as a Report in the system
            const reportId = `rep-${tpl.id.replace('tpl_', '')}`;
            
            // Check if report already exists
            const existing = await queryTable('dashboard_master', { filters: { tableName: tpl.id } });
            const existingRows = Array.isArray(existing) ? existing : (existing?.rows || []);
            
            if (existingRows.length === 0) {
                await insertRows('dashboard_master', [{
                    id: reportId,
                    name: tpl.displayName,
                    sheetName: tpl.category,
                    description: tpl.description,
                    tableName: tpl.id,
                    columns: JSON.stringify(reportColumns),
                    uiConfig: JSON.stringify({ category: tpl.category }),
                    ownerId: 'admin',
                    isDeleted: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastSerial: (tpl.initialData?.length || 0)
                }]);

                // Register in table_master (Physical Registry)
                await insertRows('table_master', [{
                    tableName: tpl.id,
                    displayName: tpl.displayName,
                    category: 'INDUSTRY',
                    schema: JSON.stringify(physicalColumns),
                    rowCount: (tpl.initialData?.length || 0),
                    createdAt: new Date().toISOString()
                }]).catch(() => {});
            }

            // Inject Sample Data if available
            if (tpl.initialData && tpl.initialData.length > 0) {
                const dataWithSysColumns = tpl.initialData.map(row => ({
                    ...row,
                    isDeleted: 0 // Default to not deleted
                }));
                await insertRows(tpl.id, dataWithSysColumns);
            }
        } catch (err) {
            console.warn(`[DemoService] Failed to process table ${tpl.id}:`, err);
        }
    }

    // 4. Inject Demo Dashboard Charts
    console.log('[DemoService] Injecting Demo Dashboard Charts...');
    await injectDemoDashboardChartsAction();

    console.log('[DemoService] Full Suite Initialization Complete!');
    return { success: true };
}

/**
 * Inject Pinned Charts for the Demo Dashboard
 */
export async function injectDemoDashboardChartsAction() {
    const adminId = "1"; // Default admin after setup
    const existingCharts = await loadAllPinnedChartsAction();
    
    const newDemoCharts = DEMO_DASHBOARD_CHARTS.map(demo => ({
        id: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        userId: adminId,
        config: {
            type: demo.type,
            data: [], // Will be hydrated on refresh or initial load
            xAxis: demo.xAxis,
            series: demo.series,
            title: demo.title,
            showLabels: true,
            sourceDescription: demo.description,
            refreshMetadata: demo.refreshMetadata
        },
        layout: { span: demo.span },
        createdAt: new Date().toISOString(),
        isSample: true // Tag for purging
    }));

    await saveAllPinnedChartsAction([...existingCharts, ...newDemoCharts]);
}

/**
 * One-click Purge of all sample data to transition to LIVE mode.
 */
export async function purgeAllSampleDataAction() {
    console.log('[DemoService] Starting Global Sample Purge...');
    
    // 1. Purge Pinned Charts (Demo Widgets)
    const allCharts = await loadAllPinnedChartsAction();
    const filteredCharts = allCharts.filter((c: any) => !c.isSample);
    if (allCharts.length !== filteredCharts.length) {
        await saveAllPinnedChartsAction(filteredCharts);
        console.log(`[DemoService] Purged ${allCharts.length - filteredCharts.length} demo charts.`);
    }

    // 2. Purge Table Data
    const tables = await listTables();
    const results = [];

    for (const table of tables) {
        try {
            const samples = await queryTable(table, {});
            const targetIds = samples
                .filter(row => {
                    try {
                        const meta = JSON.parse(row.metadata || '{}');
                        return meta.is_sample === true;
                    } catch (e) { return false; }
                })
                .map(row => row.id);

            if (targetIds.length > 0) {
                for (const id of targetIds) {
                    await deleteRows(table, { id });
                }
                results.push({ table, deleted: targetIds.length });
            }
        } catch (err) {
            console.warn(`[DemoService] Skipping table ${table} during purge:`, err);
        }
    }

    console.log('[DemoService] Global Sample Purge Complete!', results);
    return { success: true, results };
}
