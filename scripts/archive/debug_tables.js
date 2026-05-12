const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: '3931f0ae-064f-41f4-b63d-367dbf249e37',
};

async function checkDb() {
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': EGDESK_CONFIG.apiKey
  };

  const callRaw = async (tool, args) => {
    const res = await fetch(`${EGDESK_CONFIG.apiUrl}/user-data/tools/call`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tool, arguments: args })
    });
    const result = await res.json();
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: JSON.parse(result.result.content[0].text) };
  };

  try {
    console.log('Testing filters on report_row...');
    
    const resString = await callRaw('user_data_query', {
      tableName: 'report_row',
      filters: { isDeleted: '0' },
      limit: 1
    });
    console.log(`Filter isDeleted: '0' (string) -> ${resString.success ? 'Success, count: ' + (resString.data.rows?.length || 0) : 'Failed: ' + resString.error}`);

    const resNumber = await callRaw('user_data_query', {
      tableName: 'report_row',
      filters: { isDeleted: 0 },
      limit: 1
    });
    console.log(`Filter isDeleted: 0 (number) -> ${resNumber.success ? 'Success, count: ' + (resNumber.data.rows?.length || 0) : 'Failed: ' + resNumber.error}`);

    // Check if crypto is available in the environment
    try {
        const uuid = require('crypto').randomUUID();
        console.log('Crypto randomUUID check:', uuid);
    } catch (e) {
        console.log('Crypto randomUUID check: FAILED', e.message);
    }
    
  } catch (e) {
    console.error('Check failed:', e.message);
  }
}

checkDb();
