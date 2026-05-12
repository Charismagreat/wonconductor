import { queryTable, deleteRows, updateRows } from './egdesk-helpers';

async function clean() {
  const report = { id: 'a2404261-e09b-40f6-aaaf-f0b24c7a52f0', tableName: 'sheet1' };
  
  const allRows = await queryTable('report_row', { filters: { reportId: report.id }, limit: 10000 });
  const virtualRows = (allRows.rows || allRows).filter((r: any) => !r.isDeleted || r.isDeleted === '0' || r.isDeleted === 0 || r.isDeleted === false);
  
  const pRows = await queryTable(report.tableName, { limit: 10000 });
  const physicalRows = pRows.rows || pRows;
  
  const idColName = '데이터ID';
  const physicalIds = new Set<string>();
  physicalRows.forEach((row: any) => {
      if (row[idColName]) physicalIds.add(String(row[idColName]));
  });

  const rowToDelete = virtualRows.find((row) => {
      try {
          const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          return data?.[idColName] && !physicalIds.has(String(data[idColName]));
      } catch (e) {
          return false;
      }
  });

  if (rowToDelete) {
     console.log('Found orphaned row to logical delete:', rowToDelete.id);
     await deleteRows('report_row', { filters: { id: rowToDelete.id } });
     console.log('Deleted successfully.');
  } else {
     console.log('Orphan not found');
  }
}

clean().catch(console.error);
