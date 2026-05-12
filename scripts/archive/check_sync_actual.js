const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '7a406902-a90d-4aef-a983-c64320c77084',
};

async function checkActualSyncStatus() {
  const headers = { 'Content-Type': 'application/json', 'X-Api-Key': EGDESK_CONFIG.apiKey };
  const callRaw = async (tool, args) => {
    const res = await fetch(`${EGDESK_CONFIG.apiUrl}/user-data/tools/call`, {
      method: 'POST', headers, body: JSON.stringify({ tool, arguments: args })
    });
    const json = await res.json();
    return JSON.parse(json.result.content[0].text);
  };

  try {
    const reports = await callRaw('user_data_query', { tableName: 'report' });
    const report = reports.rows[0];
    if (!report) {
        console.log('No reports found.');
        return;
    }

    console.log(`Report: ${report.name} (ID: ${report.id}, Table: ${report.tableName})`);

    const virtual = await callRaw('user_data_query', { 
        tableName: 'report_row', 
        filters: { reportId: report.id, isDeleted: 0 } 
    });
    console.log(`Virtual count: ${virtual.rows.length}`);

    const physical = await callRaw('user_data_query', { tableName: report.tableName });
    console.log(`Physical count: ${physical.rows.length}`);

  } catch (e) {
    console.error('Check failed:', e.message);
  }
}
checkActualSyncStatus();
