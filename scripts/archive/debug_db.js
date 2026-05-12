
const { executeSQL } = require('./src/egdesk-helpers');

async function debug() {
  try {
    console.log('--- DB Tables ---');
    const tables = await executeSQL("SELECT name FROM sqlite_master WHERE type='table'");
    console.log(JSON.stringify(tables, null, 2));

    console.log('--- Bank Transactions Sample ---');
    const sample = await executeSQL("SELECT * FROM finance_bank_transactions LIMIT 1");
    console.log(JSON.stringify(sample, null, 2));

    console.log('--- Table Info ---');
    const info = await executeSQL("PRAGMA table_info(finance_bank_transactions)");
    console.log(JSON.stringify(info, null, 2));

  } catch (err) {
    console.error('DEBUG ERROR:', err.message);
  }
}

debug();
