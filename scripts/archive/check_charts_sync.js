const fetch = require('node-fetch');
const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function check() {
  try {
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { 
          query: "SELECT id, userId FROM dashboard_chart" 
        }
      })
    }).then(res => res.json());
    if (r.result && r.result.content) {
      console.log('CHART_SYNC_RESULT:', r.result.content[0].text);
    } else {
      console.log('API_ERROR:', JSON.stringify(r, null, 2));
    }
  } catch (e) {
    console.error(e);
  }
}
check();
