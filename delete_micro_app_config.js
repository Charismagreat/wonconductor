const fetch = require('node-fetch');

async function run() {
  const apiUrl = 'http://localhost:8080/user-data/tools/call';
  const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

  const res1 = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({
      tool: 'user_data_sql_query',
      arguments: { query: "DELETE FROM user_tables WHERE table_name='micro_app_config'" }
    })
  }).then(res => res.json());
  console.log('Delete from user_tables:', JSON.stringify(res1));

  const res2 = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({
      tool: 'user_data_sql_query',
      arguments: { query: "DROP TABLE IF EXISTS micro_app_config" }
    })
  }).then(res => res.json());
  console.log('Drop table micro_app_config:', JSON.stringify(res2));
}

run();
