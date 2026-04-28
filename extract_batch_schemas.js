const fetch = require('node-fetch');
const fs = require('fs');

const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function process() {
  try {
    const tables = [
      'action_task',
      'action_task_history',
      'workflow_template',
      'workflow_instance',
      'workflow_steering',
      'report_row_history',
      'input_guardrail',
      'source_view_settings'
    ];
    
    const results = {};
    for (const t of tables) {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({
          tool: 'user_data_sql_query',
          arguments: { 
            query: `SELECT sql FROM sqlite_master WHERE name = '${t}'` 
          }
        })
      }).then(res => res.json());
      results[t] = JSON.parse(res.result.content[0].text).rows[0].sql;
    }
    
    fs.writeFileSync('batch_schemas.json', JSON.stringify(results, null, 2));
    console.log('Saved to batch_schemas.json');

  } catch (e) {
    console.error(e);
  }
}
process();
