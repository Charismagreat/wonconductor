// Diagnostic script for user database status
// Using the correct API key from .env.local

const API_URL = 'http://localhost:8080';
const API_KEY = '124ce9b2-4a2b-41c7-97dd-6093278d7639';

async function callTool(toolName, args = {}) {
    const response = await fetch(`${API_URL}/user-data/tools/call`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': API_KEY
        },
        body: JSON.stringify({ tool: toolName, arguments: args })
    });
    
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Tool failed');
    
    const content = result.result?.content?.[0]?.text;
    return content ? JSON.parse(content) : null;
}

async function start() {
    try {
        console.log("1. Fetching user table schema...");
        const schemaResult = await callTool('user_data_get_schema', { tableName: 'user' });
        const columns = schemaResult?.schema || schemaResult?.columns || [];
        console.log("Schema columns:", columns.map(c => c.name).join(', '));
        
        console.log("\n2. Fetching table metadata (checking readonly/duplicate-action status)...");
        const list = await callTool('user_data_list_tables', {});
        const userMeta = list?.tables?.find(t => t.tableName === 'user');
        console.log("User table metadata:", JSON.stringify(userMeta, null, 2));
        
        console.log("\n3. Current user data list:");
        const data = await callTool('user_data_query', { 
            tableName: 'user', 
            orderBy: 'createdAt',
            orderDirection: 'DESC'
        });
        console.log("Metadata rowCount:", userMeta?.rowCount);
        console.log("Fetched rows count:", data?.rows?.length || 0);
        data?.rows?.forEach((u, i) => {
            console.log(`[${i+1}] ${u.username} (${u.role}) - Created: ${u.createdAt}`);
        });

        if (userMeta?.duplicateAction === 'skip') {
            console.log("\n[!] WARNING: Duplicate action is set to 'skip'. Incomplete inserts might be silently ignored if username/id conflicts.");
        }

    } catch (err) {
        console.error("DIAGNOSTIC FAILED:", err.message);
    }
}

start();
