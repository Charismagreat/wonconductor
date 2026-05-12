const http = require('http');

const apiKey = '7a1e4b57-313f-4597-9866-1bb95f623d97';

async function callTool(tool, args = {}) {
    const postData = JSON.stringify({
        tool: tool,
        arguments: args
    });

    const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/user-data/tools/call',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseBody));
                } catch (e) {
                    resolve(responseBody);
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function main() {
    try {
        const tables = await callTool('user_data_list_tables');
        console.log("TABLES:", JSON.stringify(tables, null, 2));
    } catch (e) {
        console.error("ERROR:", e);
    }
}

main();
