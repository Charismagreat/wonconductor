import { listTables, renameTable, queryTable, updateRows, deleteRows } from './egdesk-helpers';

async function fixTemplateTables() {
    console.log('--- Fixing Template Tables ---');

    const res = await listTables();
    const tables = res.tables || [];

    for (const t of tables) {
        const tn = t.tableName;
        if (tn.startsWith('tb_rep-tpl_')) {
            // Extract the original template name
            // Format: tb_rep-tpl_xxx_yyyyyy
            const parts = tn.split('_');
            // parts[0] = tb
            // parts[1] = rep-tpl
            // ... middle parts ...
            // parts[last] = suffix
            
            // Reconstruct middle part: remove 'tb_rep-' from start and the last '_suffix'
            const originalNameWithSuffix = tn.replace(/^tb_rep-/, '');
            const lastUnderscoreIndex = originalNameWithSuffix.lastIndexOf('_');
            const originalName = originalNameWithSuffix.substring(0, lastUnderscoreIndex);

            console.log(`Renaming ${tn} -> ${originalName}`);
            
            try {
                await renameTable(tn, originalName);
                console.log(`Successfully renamed to ${originalName}`);
            } catch (err) {
                console.error(`Failed to rename ${tn}:`, err);
            }
        }
    }

    // Now update table_master and dashboard_master to use the fixed names
    console.log('--- Updating Metadata ---');
    
    const allTableMaster = await queryTable('table_master');
    const tmToFix = allTableMaster.filter((t: any) => t.tableName.startsWith('tb_rep-tpl_'));
    
    for (const t of tmToFix) {
        const tn = t.tableName;
        const originalNameWithSuffix = tn.replace(/^tb_rep-/, '');
        const lastUnderscoreIndex = originalNameWithSuffix.lastIndexOf('_');
        const originalName = originalNameWithSuffix.substring(0, lastUnderscoreIndex);
        
        console.log(`Updating table_master entry: ${tn} -> ${originalName}`);
        try {
            await updateRows('table_master', {
                tableName: originalName,
                updatedAt: new Date().toISOString()
            }, { filters: { tableName: tn } });
        } catch (err) {
            console.error(`Failed to update table_master for ${tn}:`, err);
        }
    }

    const allDashboardMaster = await queryTable('dashboard_master');
    const dmToFix = allDashboardMaster.filter((t: any) => String(t.tableName).startsWith('tb_rep-tpl_'));
    
    for (const t of dmToFix) {
        const tn = t.tableName;
        const originalNameWithSuffix = tn.replace(/^tb_rep-/, '');
        const lastUnderscoreIndex = originalNameWithSuffix.lastIndexOf('_');
        const originalName = originalNameWithSuffix.substring(0, lastUnderscoreIndex);
        
        console.log(`Updating dashboard_master entry for report ${t.id}: ${tn} -> ${originalName}`);
        try {
            await updateRows('dashboard_master', {
                tableName: originalName,
                updatedAt: new Date().toISOString()
            }, { filters: { id: String(t.id) } });
        } catch (err) {
            console.error(`Failed to update dashboard_master for ${t.id}:`, err);
        }
    }

    console.log('--- Fix Template Tables Complete ---');
}

fixTemplateTables();
