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
  // Sheet1 초과 2행 삭제
  const r = await callTool('user_data_delete_rows', {
    tableName: 'report_row',
    ids: ['15101fe1-a0c3-40e9-8b50-2c56271cb77e', 'ab33a165-2967-45e8-bc79-b7659daebd59']
  });
  console.log('삭제:', JSON.stringify(r));
  
  const a = await callTool('user_data_query', { tableName: 'report_row', filters: { reportId: '386a5956-2a9b-495e-ab01-4c50796232bd' }, limit: 5000 });
  console.log('Sheet1:', (a?.rows||a||[]).length, '행');
  
  const b = await callTool('user_data_query', { tableName: 'report_row', filters: { reportId: 'a2404261-e09b-40f6-aaaf-f0b24c7a52f0' }, limit: 5000 });
  console.log('발주 입고 내역:', (b?.rows||b||[]).length, '행');
}
main().catch(console.error);
