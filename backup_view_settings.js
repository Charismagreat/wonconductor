const fetch = require('node-fetch');
const fs = require('fs');

const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function backup() {
  try {
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { 
          query: "SELECT * FROM source_view_settings" 
        }
      })
    }).then(res => res.json());
    
    const data = JSON.parse(r.result.content[0].text);
    const rows = data.rows || data;
    fs.writeFileSync('source_view_settings_backup.json', JSON.stringify(rows, null, 2));
    console.log(`Saved ${rows.length} rows to source_view_settings_backup.json`);
  } catch (e) {
    console.error(e);
  }
}
backup();
