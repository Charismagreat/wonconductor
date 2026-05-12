import fs from 'fs';
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = envContent.split('\n').filter(l => l.includes('=')).map(l => l.split('='));
for (const [k, v] of envVars) {
  process.env[k.trim()] = v.trim();
}

import { queryTable } from './egdesk-helpers';

async function run() {
  try {
    const reports = await queryTable('report', { filters: { isDeleted: '0' } });
    console.log('Available Reports in DB:');
    console.log(JSON.stringify(reports.map(r => ({ id: r.id, name: r.name })), null, 2));
  } catch (e) {
    console.error('Error querying report table:', e);
  }
}
run();
