const fetch = require('node-fetch');
const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function list() {
  try {
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { 
          query: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_eg%' AND name NOT LIKE 'hometax_%' AND name NOT LIKE 'bank_%' AND name NOT LIKE 'card_%'" 
        }
      })
    }).then(res => res.json());
    console.log('USER_DATA_TABLES:', r.result.content[0].text);
  } catch (e) {
    console.error(e);
  }
}
list();
