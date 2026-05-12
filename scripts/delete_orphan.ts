import { queryTable, deleteRows } from './egdesk-helpers';

async function clean() {
  const reportId = 'a2404261-e09b-40f6-aaaf-f0b24c7a52f0';
  const allRows = await queryTable('report_row', { filters: { reportId } });
  const rowToDelete = (allRows.rows || allRows).find((r: any) => r.data && r.data.includes('DID-000120'));
  if (rowToDelete) {
     console.log('Found row to delete:', rowToDelete.id);
     await deleteRows('report_row', { filters: { id: rowToDelete.id }});
     console.log('Deleted successfully.');
  } else {
     console.log('Not found');
  }
}
clean().catch(console.error);
