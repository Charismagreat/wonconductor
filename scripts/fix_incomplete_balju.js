// 발주 입고 내역 테이블의 불완전 행도 완전 삭제
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

async function main() {
  const reportId = 'a2404261-e09b-40f6-aaaf-f0b24c7a52f0'; // 발주 입고 내역
  
  const rowsResult = await callTool('user_data_query', { 
    tableName: 'report_row', 
    filters: { reportId },
    limit: 5000 
  });
  const dataRows = rowsResult?.rows || rowsResult || [];
  console.log(`발주 입고 내역 - 전체 행 수: ${dataRows.length}`);
  
  // 불완전 행 찾기
  const incompleteRows = dataRows.filter(row => {
    let data;
    try { data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data; } catch(e) { return true; }
    return data?.['구 분'] === undefined;
  });
  
  console.log(`불완전 행 ${incompleteRows.length}개 발견`);
  incompleteRows.forEach(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    console.log(`  id=${row.id}, isDeleted=${row.isDeleted}, keys=${Object.keys(data || {}).join(', ')}`);
  });
  
  if (incompleteRows.length === 0) return;
  
  const result = await callTool('user_data_delete_rows', {
    tableName: 'report_row',
    ids: incompleteRows.map(r => r.id)
  });
  console.log('삭제 결과:', JSON.stringify(result));
  
  // 확인
  const after = await callTool('user_data_query', { tableName: 'report_row', filters: { reportId }, limit: 5000 });
  const afterData = after?.rows || after || [];
  console.log(`✅ 완료. 남은 행: ${afterData.length}개`);
}

main().catch(console.error);
