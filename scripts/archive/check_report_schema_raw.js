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

async function checkSchema() {
    try {
        console.log('--- Scanning "report" table schema (RAW FETCH) ---');
        const body = JSON.stringify({
            tool: 'user_data_get_schema',
            arguments: { tableName: 'report' }
        });

        const response = await fetch(`${apiUrl}/user-data/tools/call`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey
            },
            body
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        
        if (!result.success) throw new Error(result.error);
        
        const content = JSON.parse(result.result.content[0].text);
        console.log(JSON.stringify(content, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkSchema();
