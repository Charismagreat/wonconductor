const fs = require('fs');
const path = require('path');

// Read .env.local manually
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

async function checkData() {
    try {
        console.log('--- Scanning "report" table data ---');
        const body = JSON.stringify({
            tool: 'user_data_query',
            arguments: { tableName: 'report', limit: 20 }
        });

        const response = await fetch(`${apiUrl}/user-data/tools/call`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey
            },
            body
        });

        const result = await response.json();
        const content = JSON.parse(result.result.content[0].text);
        console.log(JSON.stringify(content.rows, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkData();
