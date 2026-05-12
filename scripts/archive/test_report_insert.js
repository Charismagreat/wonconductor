const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        env[match[1]] = value;
    }
});

const apiUrl = env.NEXT_PUBLIC_EGDESK_API_URL;
const apiKey = env.NEXT_PUBLIC_EGDESK_API_KEY;

async function testInsert() {
    try {
        console.log('--- Testing "report" insertion with UUID ---');
        const reportId = 'test-' + Date.now();
        const body = JSON.stringify({
            tool: 'user_data_insert_rows',
            arguments: {
                tableName: 'report',
                rows: [{
                    id: reportId,
                    name: 'Manual Test Report',
                    tableName: 'test_table',
                    columns: '[]',
                    ownerId: 'system',
                    createdAt: new Date().toISOString()
                }]
            }
        });

        const response = await fetch(`${apiUrl}/user-data/tools/call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
            body
        });

        const result = await response.json();
        console.log('API Response:', JSON.stringify(result, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    }
}

testInsert();
