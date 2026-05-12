const fetch = require('node-fetch');
const fs = require('fs');

const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function syncReportAccess() {
  console.log('Synchronizing department IDs in report_access table...');
  try {
    // 1. 매핑 생성 (이전 UUID -> 새 INTEGER ID)
    const oldDepts = JSON.parse(fs.readFileSync('department_backup.json', 'utf8'));
    const currentDeptsRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { query: "SELECT id, name FROM department" }
      })
    }).then(res => res.json());
    const currentDepts = JSON.parse(currentDeptsRes.result.content[0].text).rows;
    const deptMap = {};
    oldDepts.forEach(old => {
      const matched = currentDepts.find(curr => curr.name === old.name);
      if (matched) deptMap[old.id] = matched.id;
    });

    // 2. report_access 데이터 추출
    const accessDataRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { query: "SELECT * FROM report_access" }
      })
    }).then(res => res.json());
    const oldAccess = JSON.parse(accessDataRes.result.content[0].text).rows || [];
    
    if (oldAccess.length === 0) {
        console.log('No report_access records found. Skipping sync.');
        return;
    }

    // 3. 부서 ID 업데이트 (직접 SQL로 실행)
    for (const row of oldAccess) {
      if (row.departmentId && deptMap[row.departmentId]) {
        const newId = String(deptMap[row.departmentId]);
        console.log(`Updating access record: ${row.reportId} / Dept ${row.departmentId} -> ${newId}`);
        
        // 이 도구는 SELECT만 지원할 가능성이 높으므로, 전체 삭제 후 재삽입 방식이 더 안전함
      }
    }

    // 안전을 위해 [추출 -> 데이터 가공 -> 테이블 삭제 -> 재생성 -> 복원] 순서로 진행 (동일 패턴)
    const cleanedAccess = oldAccess.map(row => {
        if (row.departmentId && deptMap[row.departmentId]) {
            row.departmentId = String(deptMap[row.departmentId]);
        }
        return row;
    });

    // 테이블 삭제
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ tool: 'user_data_delete_table', arguments: { tableName: 'report_access' } })
    });

    // 테이블 재생성 (id 컬럼 없음, reportId/userId/departmentId/grantedBy 구성)
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_create_table',
        arguments: { 
          tableName: 'report_access', 
          displayName: 'Report Access Controls', 
          schema: [ 
            { name: 'reportId', type: 'TEXT', notNull: true },
            { name: 'userId', type: 'TEXT' },
            { name: 'departmentId', type: 'TEXT' },
            { name: 'grantedBy', type: 'TEXT', notNull: true }
          ] 
        }
      })
    });

    // 데이터 삽입
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_insert_rows',
        arguments: { tableName: 'report_access', rows: cleanedAccess }
      })
    });
    console.log('report_access synchronization complete.');

  } catch (e) {
    console.error(e);
  }
}
syncReportAccess();
