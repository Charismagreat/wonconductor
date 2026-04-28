const fetch = require('node-fetch');
const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function check() {
  try {
    const tables = ['user_tables'];
    for (const t of tables) {
      const r = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
        body: JSON.stringify({
          tool: 'user_data_sql_query',
          arguments: { query: `SELECT * FROM ${t} LIMIT 1` }
        })
      }).then(res => res.json());
      console.log(`${t}_SAMPLE:`, r.result.content[0].text);
    }
  } catch (e) {
    console.error(e);
  }
}
check();
