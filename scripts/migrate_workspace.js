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
        console.log('--- Checking Schema ---');
        const schema = await callTool('user_data_get_schema', { tableName: 'workspace_item' });
        const columns = schema.columns || schema.schema || [];
        const hasAiData = columns.some(c => c.name === 'aiData');
        console.log('Has aiData column:', hasAiData);

        if (!hasAiData) {
            console.log('Attempting to add aiData column...');
            // 만약 SQL Query가 허용된다면 ALTER TABLE 사용
            try {
                await callTool('user_data_sql_query', { query: 'ALTER TABLE workspace_item ADD COLUMN aiData TEXT' });
                console.log('SUCCESS: aiData column added.');
            } catch (sqlErr) {
                console.log('SQL ALTER failed, trying create_table with merge...');
                // Fallback: 테이블 재생성 또는 다른 방법 (이 프로젝트에서는 SQL로 해결하는 경우가 많음)
                console.error(sqlErr.message);
            }
        }
    } catch (e) {
        console.error('Migration error:', e.message);
    }
}

run();
