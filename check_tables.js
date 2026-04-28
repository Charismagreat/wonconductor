const fetch = require('node-fetch');

async function run() {
  const apiUrl = 'http://localhost:8080/user-data/tools/call';
  const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({
      tool: 'user_data_sql_query',
      arguments: { query: "SELECT name FROM sqlite_master WHERE type='table'" }
    })
  }).then(res => res.json());

  console.log('Physical tables:');
  const text = res.result.content[0].text;
  const parsed = JSON.parse(text);
  parsed.rows.forEach(r => console.log(r.name));

  const res2 = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({
      tool: 'user_data_sql_query',
      arguments: { query: "SELECT table_name FROM user_tables WHERE table_name = 'micro_app_config'" }
    })
  }).then(res => res.json());
  
  console.log('\nUser tables matching micro_app_config:');
  console.log(res2.result.content[0].text);
}

run();
