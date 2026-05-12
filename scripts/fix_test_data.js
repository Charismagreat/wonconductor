// Sheet1과 발주 입고 내역의 테스트 데이터를 삭제 처리하는 스크립트
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
  // Sheet1의 test/test2/GGG 데이터 삭제
  const sheet1Ids = [
    '43200a9f-35e9-45ee-9b45-bddfc50a3e3e',  // test
    '1586c510-9f2e-40af-b88e-8e53a773a0cb',  // test2
    'addd9241-67a2-43e5-bc57-deab3646b707',  // test
    '3cc6c36c-4b2c-499d-b27b-c60bff57b831',  // test
    '544908d7-56ba-4f87-b72a-749d54e8a0f2',  // test2
    'bef5cf6a-0e63-4111-aded-b85a1aa8a8cf',  // GGG
  ];
  
  console.log('=== Sheet1 테스트 데이터 삭제 처리 ===');
  const result1 = await callTool('user_data_update_rows', {
    tableName: 'report_row',
    updates: { isDeleted: 1 },
    ids: sheet1Ids
  });
  console.log('Sheet1 결과:', JSON.stringify(result1));

  // 발주 입고 내역의 남은 테스트 데이터 (이전에 못 잡은 것들)
  const balju2Ids = [
    '0952fea0-0b89-47fc-82c8-d1da584bd39e',  // GGGG
    '2cc89118-87a7-4604-a96a-e7a1a19de1d0',  // FF
    'd6ef5b39-65d8-4e9a-a184-67c3b1c96657',  // KK
    'ab0d29e2-c76d-44b7-9e16-325db375eb58',  // GG
    '480071db-cce9-4f8c-9652-170a8e379e8e',  // undefined (데이터ID만 있는 행, 이미 isDeleted=1)
  ];
  
  // 이미 isDeleted=1인 것들은 중복 업데이트해도 무해
  console.log('\n=== 발주 입고 내역 잔여 테스트 데이터 확인 ===');
  const result2 = await callTool('user_data_update_rows', {
    tableName: 'report_row',
    updates: { isDeleted: 1 },
    ids: balju2Ids
  });
  console.log('발주 입고 내역 결과:', JSON.stringify(result2));
  
  console.log('\n✅ 테스트 데이터 삭제 처리 완료!');
}

main().catch(console.error);
