// 두 테이블의 정확한 차이점 확인
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
  
  const [s1, b1] = await Promise.all([
    callTool('user_data_query', { tableName: 'report_row', filters: { reportId: sheet1Id }, limit: 5000 }),
    callTool('user_data_query', { tableName: 'report_row', filters: { reportId: baljuId }, limit: 5000 })
  ]);
  
  const sheet1 = (s1?.rows || s1 || []);
  const balju = (b1?.rows || b1 || []);
  
  console.log(`Sheet1: ${sheet1.length}행 / 발주 입고 내역: ${balju.length}행\n`);
  
  // data 문자열 기준 비교 (contentHash가 같을 수도 있지만 data로 비교)
  const sheet1DataMap = new Map();
  sheet1.forEach(r => {
    const key = r.data; // JSON string
    if (!sheet1DataMap.has(key)) sheet1DataMap.set(key, []);
    sheet1DataMap.get(key).push(r);
  });
  
  const baljuDataMap = new Map();
  balju.forEach(r => {
    const key = r.data;
    if (!baljuDataMap.has(key)) baljuDataMap.set(key, []);
    baljuDataMap.get(key).push(r);
  });
  
  // Sheet1에만 있는 데이터
  const onlySheet1 = [];
  sheet1DataMap.forEach((rows, data) => {
    const baljuCount = baljuDataMap.has(data) ? baljuDataMap.get(data).length : 0;
    const diff = rows.length - baljuCount;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        onlySheet1.push(rows[rows.length - 1 - i]);
      }
    }
  });
  
  // 발주에만 있는 데이터
  const onlyBalju = [];
  baljuDataMap.forEach((rows, data) => {
    const sheet1Count = sheet1DataMap.has(data) ? sheet1DataMap.get(data).length : 0;
    const diff = rows.length - sheet1Count;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        onlyBalju.push(rows[rows.length - 1 - i]);
      }
    }
  });
  
  console.log(`=== Sheet1에만 있는 행 (${onlySheet1.length}개) ===`);
  onlySheet1.forEach(r => {
    const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    console.log(`  id=${r.id}, 구 분=${d?.['구 분']}, 금 액=${d?.['금 액']}, 데이터ID=${d?.['데이터ID']}`);
  });
  
  console.log(`\n=== 발주에만 있는 행 (${onlyBalju.length}개) ===`);
  onlyBalju.forEach(r => {
    const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    console.log(`  id=${r.id}, 구 분=${d?.['구 분']}, 금 액=${d?.['금 액']}, 데이터ID=${d?.['데이터ID']}`);
  });
  
  // 방안 제시
  if (onlySheet1.length > 0 && onlyBalju.length === 0) {
    console.log(`\n💡 Sheet1에 ${onlySheet1.length}개 초과 행이 있습니다. 이 행을 삭제하면 일치합니다.`);
    console.log(`삭제 대상 IDs: ${onlySheet1.map(r => r.id).join(', ')}`);
  } else if (onlyBalju.length > 0 && onlySheet1.length === 0) {
    console.log(`\n💡 발주에 ${onlyBalju.length}개 초과 행이 있습니다. 이 행을 삭제하면 일치합니다.`);
  } else {
    console.log(`\n💡 양쪽 모두 고유 행이 있습니다. 어느 쪽을 기준으로 맞출지 결정 필요.`);
  }
}

main().catch(console.error);
