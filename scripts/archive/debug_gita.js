// '기타'가 발생하는 원인을 정밀 추적하는 스크립트
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
  // 보고서 목록 조회
  const reports = await callTool('user_data_query', { tableName: 'report' });
  const rows = reports?.rows || reports || [];
  
  console.log('=== 보고서 목록 ===');
  rows.forEach(r => console.log(`  ID: ${r.id}, 이름: ${r.name}, isDeleted: ${r.isDeleted}`));
  
  // "발주 입고 내역" 또는 "Sheet1" 계열 보고서 찾기
  const targets = rows.filter(r => 
    r.name?.includes('발주') || r.name?.includes('Sheet') || r.name?.includes('sheet')
  );
  
  for (const report of targets) {
    console.log(`\n========================================`);
    console.log(`보고서: "${report.name}" (ID: ${report.id}, isDeleted: ${report.isDeleted})`);
    console.log(`========================================`);
    
    const reportRows = await callTool('user_data_query', { 
      tableName: 'report_row', 
      filters: { reportId: String(report.id) },
      limit: 5000 
    });
    const dataRows = reportRows?.rows || reportRows || [];
    
    console.log(`총 행 수: ${dataRows.length}`);
    
    // 모든 행의 '구 분' 값과 isDeleted를 출력
    const groupByKey = '구 분';
    const sumKey = '금 액';
    const categories = {};
    
    dataRows.forEach((row, idx) => {
      let data;
      try {
        data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      } catch(e) {
        console.log(`  [${idx}] data 파싱 실패: ${row.data?.substring(0, 50)}`);
        return;
      }
      
      const gubun = data?.[groupByKey];
      const amount = data?.[sumKey];
      const isDeleted = row.isDeleted;
      
      // 카테고리 집계
      const catKey = gubun === undefined ? '<undefined>' : gubun === null ? '<null>' : gubun === '' ? '<empty>' : String(gubun);
      if (!categories[catKey]) categories[catKey] = { count: 0, totalAmount: 0, deletedCount: 0, sampleIds: [] };
      categories[catKey].count++;
      categories[catKey].totalAmount += (typeof amount === 'number' ? amount : parseFloat(String(amount || '0').replace(/,/g, ''))) || 0;
      if (isDeleted === 1 || isDeleted === '1' || isDeleted === true) categories[catKey].deletedCount++;
      if (categories[catKey].sampleIds.length < 2) categories[catKey].sampleIds.push(row.id);
      
      // 스프링, 밴드가 아닌 값이면 상세 출력
      if (gubun !== '스프링' && gubun !== '밴드') {
        console.log(`  ⚠️ [${idx}] id=${row.id}, isDeleted=${JSON.stringify(isDeleted)}(type:${typeof isDeleted}), 구 분=${JSON.stringify(gubun)}, 금 액=${JSON.stringify(amount)}`);
        // data의 모든 키 출력
        console.log(`     keys: ${Object.keys(data || {}).join(', ')}`);
      }
    });
    
    console.log(`\n--- 구 분별 집계 ---`);
    Object.entries(categories).forEach(([cat, info]) => {
      console.log(`  "${cat}": ${info.count}개 (삭제:${info.deletedCount}개, 합계:${info.totalAmount})`);
    });
  }
}

main().catch(console.error);
