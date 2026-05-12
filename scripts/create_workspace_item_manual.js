
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
  return resultBody;
}

async function createWorkspaceItemTable() {
  const schema = [
    { name: 'id', type: 'TEXT', notNull: true },
    { name: 'creatorId', type: 'TEXT' },
    { name: 'imageUrl', type: 'TEXT' },
    { name: 'originalText', type: 'TEXT' },
    { name: 'suggestedTitle', type: 'TEXT' },
    { name: 'suggestedSummary', type: 'TEXT' },
    { name: 'status', type: 'TEXT', defaultValue: 'pending' },
    { name: 'reportId', type: 'TEXT' },
    { name: 'rowId', type: 'TEXT' },
    { name: 'createdAt', type: 'TEXT', notNull: true },
    { name: 'updatedAt', type: 'TEXT', notNull: true }
  ];

  try {
    console.log('--- Creating workspace_item table ---');
    const result = await callUserDataTool('user_data_create_table', {
      displayName: 'Workspace Image Items',
      schema: schema,
      tableName: 'workspace_item'
    });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

createWorkspaceItemTable();
