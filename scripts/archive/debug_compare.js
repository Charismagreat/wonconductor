// Sheet1과 발주 입고 내역의 행 차이를 비교하는 스크립트
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
  const sheet1Id = '386a5956-2a9b-495e-ab01-4c50796232bd';
  const baljuId = 'a2404261-e09b-40f6-aaaf-f0b24c7a52f0';
  
  const [sheet1Result, baljuResult] = await Promise.all([
    callTool('user_data_query', { tableName: 'report_row', filters: { reportId: sheet1Id }, limit: 5000 }),
    callTool('user_data_query', { tableName: 'report_row', filters: { reportId: baljuId }, limit: 5000 })
  ]);
  
  const sheet1Rows = sheet1Result?.rows || sheet1Result || [];
  const baljuRows = baljuResult?.rows || baljuResult || [];
  
  console.log(`Sheet1: ${sheet1Rows.length}행`);
  console.log(`발주 입고 내역: ${baljuRows.length}행`);
  
  // isDeleted별 분류
  const classify = (rows) => {
    const active = rows.filter(r => r.isDeleted === 0 || r.isDeleted === '0');
    const deleted = rows.filter(r => r.isDeleted === 1 || r.isDeleted === '1');
    const nullDel = rows.filter(r => r.isDeleted === null || r.isDeleted === undefined);
    return { active: active.length, deleted: deleted.length, null: nullDel.length, total: rows.length };
  };
  
  console.log(`\nSheet1 분류:`, classify(sheet1Rows));
  console.log(`발주 입고 내역 분류:`, classify(baljuRows));
  
  // 발주에만 있는 행 찾기 (contentHash 비교 또는 data 비교)
  const sheet1DataSet = new Set(sheet1Rows.map(r => r.data));
  const baljuDataSet = new Set(baljuRows.map(r => r.data));
  
  const onlyInBalju = baljuRows.filter(r => !sheet1DataSet.has(r.data));
  const onlyInSheet1 = sheet1Rows.filter(r => !baljuDataSet.has(r.data));
  
  console.log(`\n발주에만 있는 행 (${onlyInBalju.length}개):`);
  onlyInBalju.forEach(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    console.log(`  id=${row.id}, isDeleted=${row.isDeleted}, 구 분=${data?.['구 분']}, 금 액=${data?.['금 액']}`);
  });
  
  console.log(`\nSheet1에만 있는 행 (${onlyInSheet1.length}개):`);
  onlyInSheet1.forEach(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    console.log(`  id=${row.id}, isDeleted=${row.isDeleted}, 구 분=${data?.['구 분']}, 금 액=${data?.['금 액']}`);
  });
}

main().catch(console.error);
