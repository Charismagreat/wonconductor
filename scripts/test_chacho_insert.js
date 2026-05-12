// Test insertion experiment
const API_URL = 'http://localhost:8080';
const API_KEY = '124ce9b2-4a2b-41c7-97dd-6093278d7639';

async function testInsert() {
    try {
        console.log("Attempting to insert 'chacho'...");
        const response = await fetch(`${API_URL}/user-data/tools/call`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': API_KEY
            },
            body: JSON.stringify({
                tool: 'user_data_insert_rows',
                arguments: {
                    tableName: 'user',
                    rows: [{
                        id: 'manual-test-chacho-' + Date.now(),
                        username: 'chacho',
                        role: 'VIEWER',
                        fullName: 'Test Chacho',
                        isActive: 1,
                        createdAt: new Date().toISOString()
                    }]
                }
            })
        });

        const result = await response.json();
        console.log("Insert Result:", JSON.stringify(result, null, 2));

        if (result.success) {
            console.log("Success! Now verifying...");
            const queryResponse = await fetch(`${API_URL}/user-data/tools/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
                body: JSON.stringify({
                    tool: 'user_data_query',
                    arguments: { tableName: 'user', filters: { username: 'chacho' } }
                })
            });
            const queryData = await queryResponse.json();
            console.log("Verification Query:", queryData.result.content[0].text);
        }
    } catch (err) {
        console.error("Experiment failed:", err.message);
    }
}

testInsert();
