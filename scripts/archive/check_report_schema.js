require('dotenv').config({ path: '.env.local' });
const { getTableSchema } = require('./src/egdesk-helpers');

async function checkSchema() {
    try {
        console.log('--- Scanning "report" table schema ---');
        const schema = await getTableSchema('report');
        console.log(JSON.stringify(schema, null, 2));
    } catch (err) {
        console.error('Failed to get schema:', err.message);
    }
}

checkSchema();
