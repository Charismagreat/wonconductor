const fetch = require('node-fetch');
const fs = require('fs');

const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function extractMap() {
  try {
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { 
          query: "SELECT id, reportId FROM report" 
        }
      })
    }).then(res => res.json());
    
    const data = JSON.parse(r.result.content[0].text);
    const rows = data.rows || data;
    
    const map = {};
    rows.forEach(row => {
      map[row.reportId] = row.id;
    });
    
    fs.writeFileSync('report_id_map.json', JSON.stringify(map, null, 2));
    console.log(`Successfully mapped ${rows.length} reports to report_id_map.json`);
  } catch (e) {
    console.error(e);
  }
}
extractMap();
