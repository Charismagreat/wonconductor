
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

async function getTableSchema(tableName) {
  try {
    console.log(`--- Checking schema for: ${tableName} ---`);
    const schema = await callUserDataTool('user_data_get_schema', { tableName });
    console.log(JSON.stringify(schema, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

const tableName = process.argv[2];
if (!tableName) {
  console.log('Usage: node get_table_schema.js <table_name>');
  process.exit(1);
}

getTableSchema(tableName);
