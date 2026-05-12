const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '3931f0ae-064f-41f4-b63d-367dbf249e37',
};

async function callTool(tool, args) {
  const body = JSON.stringify({ tool, arguments: args });
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': EGDESK_CONFIG.apiKey
  };
  const response = await fetch(`${EGDESK_CONFIG.apiUrl}/user-data/tools/call`, {
    method: 'POST',
    headers,
    body
  });
  const result = await response.json();
  const text = result.result.content[0].text;
  return JSON.parse(text);
}

async function debug() {
  try {
    const reports = await callTool('user_data_query', { tableName: 'report' });
    console.log('--- Report Registry ---');
    console.log(JSON.stringify(reports, null, 2));

    const allTables = await callTool('user_data_list_tables', {});
    console.log('\n--- All Tables ---');
    console.log(JSON.stringify(allTables, null, 2));
  } catch (err) {
    console.error(err);
  }
}

debug();
