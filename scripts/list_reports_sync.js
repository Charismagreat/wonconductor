const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '7a406902-a90d-4aef-a983-c64320c77084',
};

async function listAllReports() {
  const headers = { 'Content-Type': 'application/json', 'X-Api-Key': EGDESK_CONFIG.apiKey };
  const callRaw = async (tool, args) => {
    const res = await fetch(`${EGDESK_CONFIG.apiUrl}/user-data/tools/call`, {
      method: 'POST', headers, body: JSON.stringify({ tool, arguments: args })
    });
    const json = await res.json();
    if (!json.success) {
        console.error('Tool fail:', json.error);
        return null;
    }
    return JSON.parse(json.result.content[0].text);
  };

  try {
    const reportsRes = await callRaw('user_data_query', { tableName: 'report' });
    const reports = Array.isArray(reportsRes) ? reportsRes : (reportsRes.rows || []);
    
    console.log(`Total reports: ${reports.length}`);
    for (const r of reports) {
      console.log(`- [${r.name}] ID: ${r.id}, Table: ${r.tableName}`);
      
      const vRes = await callRaw('user_data_query', { tableName: 'report_row', filters: { reportId: r.id, isDeleted: 0 } });
      const vCount = Array.isArray(vRes) ? vRes.length : (vRes.rows?.length || 0);
      
      let pCount = 0;
      if (r.tableName) {
          try {
              const pRes = await callRaw('user_data_query', { tableName: r.tableName });
              pCount = Array.isArray(pRes) ? pRes.length : (pRes.rows?.length || 0);
          } catch (e) {}
      }
      console.log(`  Count: Virtual=${vCount}, Physical=${pCount}`);
    }

  } catch (e) {
    console.error('Failed:', e.message);
  }
}
listAllReports();
