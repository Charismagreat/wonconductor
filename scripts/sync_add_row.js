// 발주에만 있는 행을 Sheet1에 복제
const API_URL = 'http://localhost:8080';
const API_KEY = '3931f0ae-064f-41f4-b63d-367dbf249e37';
async function callTool(t, a) {
  const r = await fetch(`${API_URL}/user-data/tools/call`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
    body: JSON.stringify({ tool: t, arguments: a })
  });
  const j = await r.json();
  const x = j.result?.content?.[0]?.text;
  return x ? JSON.parse(x) : null;
}
async function main() {
  // 발주에만 있는 행 조회
  const src = await callTool('user_data_query', { tableName: 'report_row', filters: { id: '0c8469a0-43d4-45f7-b941-299f49b0e6bd' } });
  const row = (src?.rows || src || [])[0];
  if (!row) { console.log('원본 행을 찾을 수 없습니다.'); return; }
  
  console.log('원본 행 data:', row.data);
  
  // Sheet1에 동일한 데이터로 행 추가
  const newId = crypto.randomUUID();
  await callTool('user_data_insert_rows', {
    tableName: 'report_row',
    rows: [{
      id: newId,
      reportId: '386a5956-2a9b-495e-ab01-4c50796232bd', // Sheet1
      data: row.data,
      contentHash: row.contentHash,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isDeleted: 0
    }]
  });
  
  // 확인
  const a = await callTool('user_data_query', { tableName: 'report_row', filters: { reportId: '386a5956-2a9b-495e-ab01-4c50796232bd' }, limit: 5000 });
  const b = await callTool('user_data_query', { tableName: 'report_row', filters: { reportId: 'a2404261-e09b-40f6-aaaf-f0b24c7a52f0' }, limit: 5000 });
  console.log(`✅ Sheet1: ${(a?.rows||a||[]).length}행 / 발주 입고 내역: ${(b?.rows||b||[]).length}행`);
}
main().catch(console.error);
