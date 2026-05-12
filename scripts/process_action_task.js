const fetch = require('node-fetch');
const fs = require('fs');

const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function process() {
  try {
    const dataRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { 
          query: "SELECT * FROM action_task" 
        }
      })
    }).then(res => res.json());
    
    if (!dataRes.result) {
      console.log('Error or empty result:', JSON.stringify(dataRes));
      return;
    }

    const data = JSON.parse(dataRes.result.content[0].text);
    const rows = data.rows || data;
    console.log(`ACTION_TASK_COUNT: ${rows.length} tasks found.`);
    
    fs.writeFileSync('action_task_backup.json', JSON.stringify(rows, null, 2));
    console.log('Saved to action_task_backup.json');

    const schemaRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { 
          query: "SELECT sql FROM sqlite_master WHERE name = 'action_task'" 
        }
      })
    }).then(res => res.json());
    console.log('SCHEMA:', schemaRes.result.content[0].text);

  } catch (e) {
    console.error(e);
  }
}
process();
