const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '7a406902-a90d-4aef-a983-c64320c77084';

async function callTool(tool, args) {
    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey
        },
        body: JSON.stringify({ tool, arguments: args })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    return JSON.parse(result.result.content[0].text);
}

async function run() {
    try {
        console.log('--- Table Migration: workspace_item ---');
        
        // Define desired schema
        const schema = [
            { name: 'id', type: 'TEXT', notNull: true },
            { name: 'creatorId', type: 'TEXT' },
            { name: 'imageUrl', type: 'TEXT' },
            { name: 'originalText', type: 'TEXT' },
            { name: 'suggestedTitle', type: 'TEXT' },
            { name: 'suggestedSummary', type: 'TEXT' },
            { name: 'status', type: 'TEXT' },
            { name: 'reportId', type: 'TEXT' },
            { name: 'rowId', type: 'TEXT' },
            { name: 'aiData', type: 'TEXT' }, // New Column
            { name: 'createdAt', type: 'TEXT' },
            { name: 'updatedAt', type: 'TEXT' }
        ];

        // Call createTable - usually handles adding columns if table exists
        const result = await callTool('user_data_create_table', {
            displayName: 'Workspace Image Items',
            schema,
            tableName: 'workspace_item',
            uniqueKeyColumns: ['id']
        });
        
        console.log('Migration Result:', result);
    } catch (e) {
        console.error('Migration error:', e.message);
    }
}

run();
