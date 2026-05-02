import { queryTable } from './src/egdesk-helpers';
async function test() {
  try {
    const res = await queryTable('dashboard_master', {limit: 5, orderBy: 'createdAt', orderDirection: 'DESC'});
    const rows = Array.isArray(res) ? res : res.rows;
    if (rows && rows.length > 0) {
      console.log('TableName:', rows[0].tableName);
      console.log('Columns:', rows[0].columns);
    }
  } catch (e) { console.error(e); }
}
test();
