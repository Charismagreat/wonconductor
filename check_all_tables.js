const fetch = require('node-fetch');

async function run() {
  const apiUrl = 'http://localhost:8080/user-data/tools/call';
  const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

  const res1 = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({
      tool: 'user_data_sql_query',
      arguments: { query: "SELECT name FROM sqlite_master WHERE type='table'" }
    })
  }).then(res => res.json());
  
  const tables = res1.result?.content?.[0]?.text;
  if (tables) {
      const parsed = JSON.parse(tables);
      console.log('Physical tables containing micro_app:', parsed.rows.filter(r => r.name.includes('micro_app')));
  } else {
      console.log('Failed:', res1);
  }
}

run();
