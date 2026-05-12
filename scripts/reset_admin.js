const crypto = require('crypto');
const http = require('http');

const SALT_SIZE = 16;
const KEY_LEN = 64;

function hashPassword(password) {
    const salt = crypto.randomBytes(SALT_SIZE).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, KEY_LEN);
    return `${salt}:${derivedKey.toString('hex')}`;
}

const password = 'admin123!';
const hashedPassword = hashPassword(password);
const apiKey = '7a1e4b57-313f-4597-9866-1bb95f623d97';

const postData = JSON.stringify({
    tool: "user_data_update_rows",
    arguments: {
        tableName: "user",
        updates: { password: hashedPassword },
        filters: { username: "admin_user" }
    }
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

const req = http.request(options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => responseBody += chunk);
    res.on('end', () => {
        try {
            const parsedRes = JSON.parse(responseBody);
            console.log(JSON.stringify(parsedRes, null, 2));
        } catch (e) {
            console.log(responseBody);
        }
    });
});

req.on('error', (e) => console.error(e));
req.write(postData);
req.end();
