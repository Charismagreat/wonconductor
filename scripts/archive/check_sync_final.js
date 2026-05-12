const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '7a406902-a90d-4aef-a983-c64320c77084',
};

async function checkFinalSyncStatus() {
  const headers = { 'Content-Type': 'application/json', 'X-Api-Key': EGDESK_CONFIG.apiKey };
  const callRaw = async (tool, args) => {
    const res = await fetch(`${EGDESK_CONFIG.apiUrl}/user-data/tools/call`, {
      method: 'POST', headers, body: JSON.stringify({ tool, arguments: args })
    });
    const json = await res.json();
    if (!json.success) return { success: false, error: json.error };
    return { success: true, data: JSON.parse(json.result.content[0].text) };
  };

  try {
    const rRes = await callRaw('user_data_query', { tableName: 'report' });
    const reports = Array.isArray(rRes.data) ? rRes.data : (rRes.data?.rows || []);
    const r = reports[0];
    if (!r) { console.log('No reports.'); return; }
    
    console.log(`Report: ${r.name} (T: ${r.tableName})`);
    
    const vRes = await callRaw('user_data_query', { tableName: 'report_row' });
    const virtualRows = Array.isArray(vRes.data) ? vRes.data : (vRes.data?.rows || []);
    console.log(`Total Virtual rows (including deleted): ${virtualRows.length}`);
    
    if (r.tableName) {
        const pRes = await callRaw('user_data_query', { tableName: r.tableName });
        const physicalRows = Array.isArray(pRes.data) ? pRes.data : (pRes.data?.rows || []);
        console.log(`Total Physical rows: ${physicalRows.length}`);
    }
  } catch (e) {
    console.error('Check script error:', e.message);
  }
}
checkFinalSyncStatus();
