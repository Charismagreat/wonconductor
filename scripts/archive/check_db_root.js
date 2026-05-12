const { executeSQL } = require('./egdesk-helpers');

async function check() {
  console.log('--- TABLE SCHEMA ---');
  try {
    const info = await executeSQL('PRAGMA table_info(micro_app_projects)');
    console.log(JSON.stringify(info, null, 2));
    
    console.log('\n--- SAMPLE DATA ---');
    const data = await executeSQL('SELECT id, name, tags FROM micro_app_projects LIMIT 5');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Check failed:', e);
  }
}

check();
