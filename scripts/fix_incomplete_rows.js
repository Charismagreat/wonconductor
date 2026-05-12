// Sheet1 테이블의 불완전 행을 찾아서 완전 삭제하는 스크립트
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
  // Sheet1 보고서 찾기
  const reports = await callTool('user_data_query', { tableName: 'report' });
  const allReports = reports?.rows || reports || [];
  const sheet1 = allReports.find(r => r.name === 'Sheet1');
  
  if (!sheet1) {
    console.log('Sheet1 보고서를 찾을 수 없습니다.');
    return;
  }
  console.log(`Sheet1 ID: ${sheet1.id}`);
  
  // 전체 행 조회
  const rowsResult = await callTool('user_data_query', { 
    tableName: 'report_row', 
    filters: { reportId: String(sheet1.id) },
    limit: 5000 
  });
  const dataRows = rowsResult?.rows || rowsResult || [];
  console.log(`전체 행 수: ${dataRows.length}`);
  
  // 불완전 행 찾기 (구 분 키가 없는 행)
  const incompleteRows = dataRows.filter(row => {
    let data;
    try {
      data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    } catch(e) { return true; }
    return data?.['구 분'] === undefined;
  });
  
  console.log(`\n불완전 행 ${incompleteRows.length}개 발견:`);
  incompleteRows.forEach(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    console.log(`  id=${row.id}, isDeleted=${row.isDeleted}, keys=${Object.keys(data || {}).join(', ')}`);
  });
  
  if (incompleteRows.length === 0) {
    console.log('삭제할 불완전 행이 없습니다.');
    return;
  }
  
  // 완전 삭제 (물리적 삭제)
  const idsToDelete = incompleteRows.map(r => r.id);
  console.log(`\n${idsToDelete.length}개 행 완전 삭제 중...`);
  
  const result = await callTool('user_data_delete_rows', {
    tableName: 'report_row',
    ids: idsToDelete
  });
  console.log('삭제 결과:', JSON.stringify(result));
  
  // 삭제 확인
  const afterRows = await callTool('user_data_query', { 
    tableName: 'report_row', 
    filters: { reportId: String(sheet1.id) },
    limit: 5000 
  });
  const afterData = afterRows?.rows || afterRows || [];
  const remainingIncomplete = afterData.filter(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return data?.['구 분'] === undefined;
  });
  
  console.log(`\n✅ 삭제 완료. 남은 행: ${afterData.length}개, 남은 불완전 행: ${remainingIncomplete.length}개`);
}

main().catch(console.error);
