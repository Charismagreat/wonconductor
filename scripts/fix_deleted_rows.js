// GGG, DD, DDD 테스트 데이터를 삭제 처리하는 스크립트
const API_URL = 'http://localhost:8080';
const API_KEY = '3931f0ae-064f-41f4-b63d-367dbf249e37';

async function callTool(toolName, args) {
  const res = await fetch(`${API_URL}/user-data/tools/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify({ tool: toolName, arguments: args })
  });
  const result = await res.json();
  console.log(`[${toolName}] Response:`, JSON.stringify(result).substring(0, 300));
  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

async function main() {
  const idsToDelete = [
    '15841da2-5ef4-44f9-a4ba-3a05889852e4',  // GGG
    'e2a56727-7253-4ac4-ab93-beccb072c54a',   // DD 
    'a8b2c6ae-c181-48fa-8a7c-b6bc367c8aaa',   // DDD
  ];

  console.log('삭제 대상 행:', idsToDelete);
  
  // isDeleted = 1로 업데이트
  const result = await callTool('user_data_update_rows', {
    tableName: 'report_row',
    updates: { isDeleted: 1 },
    ids: idsToDelete
  });
  
  console.log('\n결과:', JSON.stringify(result, null, 2));
  
  // 확인
  for (const id of idsToDelete) {
    const check = await callTool('user_data_query', { tableName: 'report_row', filters: { id } });
    const rows = check?.rows || check || [];
    if (rows.length > 0) {
      const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
      console.log(`확인 - id=${id}, isDeleted=${rows[0].isDeleted}, 구 분=${data?.['구 분']}`);
    }
  }
}

main().catch(console.error);
