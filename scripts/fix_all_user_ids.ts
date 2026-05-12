import { queryTable, updateRows } from './egdesk-helpers';

async function fixUserIds() {
  console.log('Fixing User ID references (1 -> 21)...');

  const oldId = '1';
  const newId = '21';

  const updates = [
    { table: 'dashboard_chart', field: 'userId' },
    { table: 'micro_app_projects', field: 'createdBy' },
    { table: 'dashboard_master', field: 'ownerId' },
    { table: 'workspace_item', field: 'userId' },
    { table: 'notification', field: 'userId' }
  ];

  for (const up of updates) {
    try {
      console.log(`Checking ${up.table}.${up.field}...`);
      const rows = await queryTable(up.table, { filters: { [up.field]: oldId } });
      if (rows.length > 0) {
        console.log(`  Updating ${rows.length} rows in ${up.table}...`);
        for (const row of rows) {
          await updateRows(up.table, {
            [up.field]: newId
          }, { filters: { id: String(row.id) } });
        }
      }
    } catch (err: any) {
      console.error(`Failed to update ${up.table}:`, err.message);
    }
  }

  // Also update __creator_id for all tables in table_master if it's '1' or null
  // But for now, let's just do these.
  
  console.log('User ID fix completed.');
}

fixUserIds();
