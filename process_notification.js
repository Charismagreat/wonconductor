const fetch = require('node-fetch');
const fs = require('fs');

const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function process() {
  try {
    // 1. 스키마 확인
    const schemaRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { 
          query: "SELECT sql FROM sqlite_master WHERE name = 'notification'" 
        }
      })
    }).then(res => res.json());
    console.log('CURRENT_SCHEMA:', schemaRes.result.content[0].text);

    // 2. 데이터 추출
    const dataRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { 
          query: "SELECT * FROM notification" 
        }
      })
    }).then(res => res.json());
    
    const data = JSON.parse(dataRes.result.content[0].text);
    const rows = data.rows || data;
    console.log(`DATA_RECEIVED: ${rows.length} rows found.`);
    
    fs.writeFileSync('notification_backup.json', JSON.stringify(rows, null, 2));
    console.log('Saved to notification_backup.json');

  } catch (e) {
    console.error(e);
  }
}
process();
