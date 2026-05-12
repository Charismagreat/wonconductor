const fetch = require('node-fetch');
const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function findColumns() {
  try {
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { 
          query: "SELECT name FROM sqlite_master WHERE type='table' AND (sql LIKE '%reportId%' OR sql LIKE '%report_id%' OR sql LIKE '%ReportId%')" 
        }
      })
    }).then(res => res.json());
    
    const data = JSON.parse(r.result.content[0].text);
    console.log('Tables mentioning reportId:', data.rows.map(r => r.name).join(', '));
    
  } catch (e) {
    console.error(e);
  }
}
findColumns();
