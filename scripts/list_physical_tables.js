
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

const EGDESK_CONFIG = {
  apiUrl: process.env.NEXT_PUBLIC_EGDESK_API_URL || 'http://localhost:8080',
  apiKey: process.env.NEXT_PUBLIC_EGDESK_API_KEY,
};

async function callUserDataTool(toolName, args = {}) {
  const body = JSON.stringify({ tool: toolName, arguments: args });
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': EGDESK_CONFIG.apiKey
  };

  const response = await fetch(`${EGDESK_CONFIG.apiUrl}/user-data/tools/call`, {
    method: 'POST',
    headers,
    body
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const resultBody = await response.json();
  if (!resultBody.success) {
    throw new Error(resultBody.error || 'Tool call failed');
  }

  const content = resultBody.result?.content?.[0]?.text;
  if (!content) return null;
  
  try {
     return JSON.parse(content);
  } catch(e) {
     return content;
  }
}

async function listPhysicalTables() {
  try {
    console.log('--- Listing all physical tables ---');
    const result = await callUserDataTool('user_data_list_tables', {});
    
    if (!result || !result.tables) {
       console.log('No tables found or invalid response:', result);
       return;
    }

    console.log(`Found ${result.tables.length} tables:\n`);
    
    // Sort tables by name for readability
    const sortedTables = result.tables.sort((a, b) => a.tableName.localeCompare(b.tableName));

    for (const table of sortedTables) {
       // Also try to get row count for each table
       let rowCount = 'Unknown';
       try {
           const countRes = await callUserDataTool('user_data_aggregate', {
               tableName: table.tableName,
               column: '*',
               function: 'COUNT'
           });
           rowCount = countRes?.value ?? countRes ?? '0';
       } catch (e) {
           rowCount = 'Error';
       }
       
       console.log(`Table: ${table.tableName.padEnd(30)} | Display: ${table.displayName.padEnd(20)} | Rows: ${rowCount}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

listPhysicalTables();
