import { listTables, renameTable, queryTable, updateRows } from './egdesk-helpers';

async function fixAllSuffixedTables() {
    console.log('--- Fixing All Suffixed Tables ---');

    const res = await listTables();
    const tables = res.tables || [];

    for (const t of tables) {
        const tn = t.tableName;
        if (tn.startsWith('tb_')) {
            // Check if it matches the pattern tb_..._suffix
            const lastUnderscoreIndex = tn.lastIndexOf('_');
            if (lastUnderscoreIndex === -1) continue;

            let originalName = '';
            if (tn.startsWith('tb_rep-')) {
                // tb_rep-tpl_xxx_yyyyyy -> tpl_xxx
                const middle = tn.replace(/^tb_rep-/, '');
                const lastIdx = middle.lastIndexOf('_');
                originalName = middle.substring(0, lastIdx);
            } else if (tn.startsWith('tb_tb_')) {
                // tb_tb_69f498a1_pvh_x1dnq -> tb_69f498a1_pvh
                 const middle = tn.substring(3);
                 const lastIdx = middle.lastIndexOf('_');
                 originalName = middle.substring(0, lastIdx);
            } else {
                // tb_hometax_xxx_yyyyyy -> hometax_xxx
                const middle = tn.substring(3);
                const lastIdx = middle.lastIndexOf('_');
                originalName = middle.substring(0, lastIdx);
            }

            if (!originalName) continue;

            console.log(`Renaming ${tn} -> ${originalName}`);
            try {
                await renameTable(tn, originalName);
                console.log(`Successfully renamed to ${originalName}`);

                // Update metadata
                await updateMetadata(tn, originalName);
            } catch (err) {
                console.error(`Failed to handle ${tn}:`, err);
            }
        }
    }

    console.log('--- Fix All Complete ---');
}

async function updateMetadata(oldTn: string, newTn: string) {
    // table_master
    try {
        const res = await updateRows('table_master', {
            tableName: newTn,
            updatedAt: new Date().toISOString()
        }, { filters: { tableName: oldTn } });
        if (res.rowsAffected > 0) console.log(`Updated table_master: ${oldTn} -> ${newTn}`);
    } catch (e) {}

    // dashboard_master
    try {
        const res = await updateRows('dashboard_master', {
            tableName: newTn,
            updatedAt: new Date().toISOString()
        }, { filters: { tableName: oldTn } });
        if (res.rowsAffected > 0) console.log(`Updated dashboard_master: ${oldTn} -> ${newTn}`);
    } catch (e) {}
}

fixAllSuffixedTables();
