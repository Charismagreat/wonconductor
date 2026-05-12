const fetch = require('node-fetch');

async function run() {
  const apiUrl = 'http://localhost:8080/user-data/tools/call';
  const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

  const res1 = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({
      tool: 'user_data_sql_query',
      arguments: { query: "SELECT name FROM sqlite_master WHERE type='table' AND name='micro_app_config'" }
    })
  }).then(res => res.json());
  
  console.log('Physical table check:', JSON.stringify(res1));
}

run();
