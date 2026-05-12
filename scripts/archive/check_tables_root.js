const { executeSQL } = require('./egdesk-helpers');

async function checkPhysicalTables() {
  try {
    const query = "SELECT name FROM sqlite_master WHERE type='table'";
    const res = await executeSQL(query);
    const tables = Array.isArray(res) ? res : (res.rows || []);
    
    const physicalTables = tables.map(t => t.name).filter(name => 
      name.includes('invoice') || 
      name.includes('note') || 
      name.includes('receipt') ||
      name.includes('hometax') ||
      name.includes('finance')
    );
    
    console.log('--- Physical Tables Found ---');
    console.log(JSON.stringify(physicalTables, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkPhysicalTables();
