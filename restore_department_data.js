const fetch = require('node-fetch');
const fs = require('fs');

const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function restore() {
  console.log('Restoring department data without IDs...');
  try {
    const rawData = fs.readFileSync('department_backup.json', 'utf8');
    const rows = JSON.parse(rawData);
    
    const cleanedRows = rows.map(row => {
      const { id, ...rest } = row;
      return rest;
    });

    console.log(`Prepared ${cleanedRows.length} rows for insertion.`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_insert_rows',
        arguments: { 
          tableName: 'department',
          rows: cleanedRows
        }
      })
    });
    const r = await response.json();
    console.log('RESTORE_RESULT:', JSON.stringify(r));

    // 결과 확인
    const checkRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { 
          query: "SELECT id, name FROM department" 
        }
      })
    }).then(res => res.json());
    
    console.log('NEW_DATA_CHECK:', checkRes.result.content[0].text);

  } catch (e) {
    console.error(e);
  }
}
restore();
