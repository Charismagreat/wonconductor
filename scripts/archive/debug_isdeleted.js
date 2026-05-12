const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '7a406902-a90d-4aef-a983-c64320c77084',
};

async function checkRowData() {
  const headers = { 'Content-Type': 'application/json', 'X-Api-Key': EGDESK_CONFIG.apiKey };
  const callRaw = async (tool, args) => {
    const res = await fetch(`${EGDESK_CONFIG.apiUrl}/user-data/tools/call`, {
      method: 'POST', headers, body: JSON.stringify({ tool, arguments: args })
    });
    const json = await res.json();
    return JSON.parse(json.result.content[0].text);
  };

  try {
    const virtualRes = await callRaw('user_data_query', { 
        tableName: 'report_row', 
        filters: { reportId: 'ffb88ec7-6fdc-43cb-b18d-20b47539d433' },
        limit: 5
    });
    const rows = Array.isArray(virtualRes) ? virtualRes : (virtualRes.rows || []);
    console.log('Sample rows from virtual:');
    rows.forEach(r => {
      console.log(`- ID: ${r.id}, isDeleted: [${r.isDeleted}] (Type: ${typeof r.isDeleted})`);
    });

  } catch (e) {
    console.error('Check failed:', e.message);
  }
}
checkRowData();
