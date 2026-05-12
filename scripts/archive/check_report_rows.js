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

async function checkRows() {
    try {
        console.log('--- Checking report_row for reportId: 1 ---');
        const body = JSON.stringify({
            tool: 'user_data_query',
            arguments: { 
                tableName: 'report_row', 
                filters: { reportId: '1', isDeleted: '0' },
                limit: 100 
            }
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
        
        const rows = content.rows || content;
        console.log(`Found ${Array.isArray(rows) ? rows.length : 0} active rows.`);
        if (Array.isArray(rows) && rows.length > 0) {
            rows.forEach(r => {
                console.log(`ID: ${r.id}, data: ${r.data.substring(0, 100)}...`);
            });
        }

        console.log('\n--- Checking report_row for reportId: 1 (INCLUDING DELETED) ---');
        const bodyAll = JSON.stringify({
            tool: 'user_data_query',
            arguments: { 
                tableName: 'report_row', 
                filters: { reportId: '1' },
                limit: 100 
            }
        });

        const responseAll = await fetch(`${apiUrl}/user-data/tools/call`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey
            },
            body: bodyAll
        });

        const resultAll = await responseAll.json();
        const contentAll = JSON.parse(resultAll.result.content[0].text);
        const rowsAll = contentAll.rows || contentAll;
        console.log(`Found ${Array.isArray(rowsAll) ? rowsAll.length : 0} total rows (including deleted).`);
        if (Array.isArray(rowsAll)) {
            rowsAll.forEach(r => {
                console.log(`ID: ${r.id}, isDeleted: ${r.isDeleted}, Hash: [${r.contentHash}], creatorId: ${r.creatorId}`);
            });
        }

        console.log('\n--- Checking physical table: tb_944447372_1h23k ---');
        const bodyPhys = JSON.stringify({
            tool: 'user_data_query',
            arguments: { 
                tableName: 'tb_944447372_1h23k', 
                limit: 100 
            }
        });

        const responsePhys = await fetch(`${apiUrl}/user-data/tools/call`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey
            },
            body: bodyPhys
        });

        const resultPhys = await responsePhys.json();
        const contentPhys = JSON.parse(resultPhys.result.content[0].text);
        const rowsPhys = contentPhys.rows || contentPhys;
        console.log(`Found ${Array.isArray(rowsPhys) ? rowsPhys.length : 0} rows in physical table.`);
        if (Array.isArray(rowsPhys)) {
            rowsPhys.forEach(r => {
                console.log(JSON.stringify(r));
            });
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkRows();
