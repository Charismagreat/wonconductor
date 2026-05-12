const fetch = require('node-fetch');
const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function check() {
  const tableName = process.argv[2] || 'workspace_item';
  try {
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { query: `SELECT sql FROM sqlite_master WHERE name = '${tableName}'` }
      })
    }).then(res => res.json());
    console.log('SCHEMA:', r.result.content[0].text);
  } catch (e) {
    console.error(e);
  }
}
check();
