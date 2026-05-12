const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '3931f0ae-064f-41f4-b63d-367dbf249e37',
};

async function testActions() {
  const headers = { 'Content-Type': 'application/json', 'X-Api-Key': EGDESK_CONFIG.apiKey };
  const callRaw = async (tool, args) => {
    const res = await fetch(`${EGDESK_CONFIG.apiUrl}/user-data/tools/call`, {
      method: 'POST', headers, body: JSON.stringify({ tool, arguments: args })
    });
    return await res.json();
  };

  try {
    // 1. Get a row ID to test with
    const rowsRes = await callRaw('user_data_query', { tableName: 'report_row', limit: 1, filters: { isDeleted: '0' } });
    if (!rowsRes.success || !rowsRes.result?.content) {
        console.error('Failed to get a row', rowsRes);
        return;
    }
    const row = JSON.parse(rowsRes.result.content[0].text).rows[0];
    if (!row) {
        console.log('No rows found');
        return;
    }
    console.log('Testing with RowId:', row.id);

    // 2. Simulate updateSingleRowAction
    console.log('--- Simulating updateSingleRowAction ---');
    const updateRes = await callRaw('user_data_update_rows', {
        tableName: 'report_row',
        updates: { updatedAt: new Date().toISOString() },
        filters: { id: String(row.id) }
    });
    console.log('Update report_row:', updateRes.success ? 'Success' : `Error: ${updateRes.error}`);

    // Simulate History insert
    const historyId = require('crypto').randomUUID();
    const historyInsert = await callRaw('user_data_insert_rows', {
        tableName: 'report_row_history',
        rows: [{
            id: historyId,
            rowId: String(row.id),
            oldData: row.data,
            newData: row.data,
            changeType: 'UPDATE',
            changedById: 'admin-uuid-001',
            changedAt: new Date().toISOString()
        }]
    });
    console.log('Insert History:', historyInsert.success ? 'Success' : `Error: ${historyInsert.error}`);

    // 3. Simulate getRowHistoryAction
    console.log('--- Simulating getRowHistoryAction ---');
    const getHistory = await callRaw('user_data_query', {
        tableName: 'report_row_history',
        filters: { rowId: String(row.id) },
        orderBy: 'changedAt',
        orderDirection: 'DESC'
    });
    console.log('Get History:', getHistory.success ? 'Success' : `Error: ${getHistory.error}`);
    if (getHistory.success) {
        console.log('History records found:', JSON.parse(getHistory.result.content[0].text).rows.length);
    }

  } catch(e) {
    console.error('Script Failed:', e.message);
  }
}
testActions();
