// 두 테이블의 isDeleted=1인 테스트 데이터를 영구 삭제
const API_URL = 'http://localhost:8080';
const API_KEY = '3931f0ae-064f-41f4-b63d-367dbf249e37';

async function callTool(toolName, args) {
  const res = await fetch(`${API_URL}/user-data/tools/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify({ tool: toolName, arguments: args })
  });
  const result = await res.json();
  const content = result.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : null;
}

async function purge(reportName, reportId) {
  const rowsResult = await callTool('user_data_query', { 
    tableName: 'report_row', filters: { reportId }, limit: 5000 
  });
  const rows = rowsResult?.rows || rowsResult || [];
  const deleted = rows.filter(r => r.isDeleted === 1 || r.isDeleted === '1');
  
  console.log(`\n[${reportName}] 전체: ${rows.length}행, isDeleted=1: ${deleted.length}행`);
  deleted.forEach(r => {
    const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    console.log(`  ❌ ${r.id} → 구 분=${d?.['구 분']}, 금 액=${d?.['금 액']}`);
  });
  
  if (deleted.length === 0) return;
  
  const result = await callTool('user_data_delete_rows', {
    tableName: 'report_row', ids: deleted.map(r => r.id)
  });
  console.log(`  삭제 결과: ${result?.deleted || 0}행 영구 삭제`);
  
  // 확인
  const after = await callTool('user_data_query', { tableName: 'report_row', filters: { reportId }, limit: 5000 });
  const afterRows = after?.rows || after || [];
  console.log(`  ✅ 남은 행: ${afterRows.length}행`);
}

async function main() {
  await purge('Sheet1', '386a5956-2a9b-495e-ab01-4c50796232bd');
  await purge('발주 입고 내역', 'a2404261-e09b-40f6-aaaf-f0b24c7a52f0');
}

main().catch(console.error);
