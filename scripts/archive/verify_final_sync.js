const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '7a406902-a90d-4aef-a983-c64320c77084',
};

async function verifySyncStatusCorrected() {
  const headers = { 'Content-Type': 'application/json', 'X-Api-Key': EGDESK_CONFIG.apiKey };
  const callRaw = async (tool, args) => {
    const res = await fetch(`${EGDESK_CONFIG.apiUrl}/user-data/tools/call`, {
      method: 'POST', headers, body: JSON.stringify({ tool, arguments: args })
    });
    const json = await res.json();
    return JSON.parse(json.result.content[0].text);
  };

  try {
    const reportsRes = await callRaw('user_data_query', { tableName: 'report' });
    const reports = Array.isArray(reportsRes) ? reportsRes : (reportsRes.rows || []);
    
    for (const r of reports) {
      console.log(`\nChecking sync for [${r.name}]...`);
      const vRes = await callRaw('user_data_query', { 
        tableName: 'report_row', 
        filters: { reportId: String(r.id) },
        limit: 10000
      });
      const allVirtual = Array.isArray(vRes) ? vRes : (vRes.rows || []);
      // 필터링: 삭제되지 않은(active) 행만 계산
      const activeVirtual = allVirtual.filter(row => !row.isDeleted || row.isDeleted == 0 || row.isDeleted === '0');
      const vCount = activeVirtual.length;
      
      const pRes = await callRaw('user_data_query', { tableName: r.tableName });
      const pCount = Array.isArray(pRes) ? pRes.length : (pRes.rows?.length || 0);
      
      console.log(`- Result: Virtual(Active)=${vCount}, Physical=${pCount}`);
      if (vCount === pCount) {
        console.log('✅ SYNCED!');
      } else {
        console.log('❌ MISMATCH!');
      }
    }
  } catch (e) {
    console.error('Verification failed:', e.message);
  }
}
verifySyncStatusCorrected();
