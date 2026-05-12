const fetch = require('node-fetch');
const fs = require('fs');

const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function overhaul() {
  console.log('Starting user table overhaul and department ID synchronization...');
  try {
    // 1. 부서 매핑 생성
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
    
    // name을 매개로 { oldId: newId } 맵 생성
    const deptMap = {};
    oldDepts.forEach(old => {
      const matched = currentDepts.find(curr => curr.name === old.name);
      if (matched) {
        deptMap[old.id] = matched.id;
      }
    });
    console.log('Department Mapping created:', JSON.stringify(deptMap));

    // 2. 사용자 데이터 가공
    const oldUsers = JSON.parse(fs.readFileSync('user_backup.json', 'utf8'));
    const cleanedUsers = oldUsers.map(user => {
      const { id, ...rest } = user;
      // 부서 ID 교체 (매핑에 있으면 새 ID로, 없으면 그대로(또는 null))
      if (rest.departmentId && deptMap[rest.departmentId]) {
        rest.departmentId = String(deptMap[rest.departmentId]);
      }
      return rest;
    });
    console.log(`Prepared ${cleanedUsers.length} users for migration.`);

    // 3. 기존 user 테이블 삭제
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ tool: 'user_data_delete_table', arguments: { tableName: 'user' } })
    });
    console.log('Old user table deleted.');

    // 4. user 테이블 재생성 (id 제외)
    const createRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_create_table',
        arguments: { 
          tableName: 'user', 
          displayName: 'System Users', 
          schema: [ 
            { name: 'username', type: 'TEXT', notNull: true },
            { name: 'email', type: 'TEXT' },
            { name: 'password', type: 'TEXT' },
            { name: 'role', type: 'TEXT', notNull: true, defaultValue: 'VIEWER' },
            { name: 'fullName', type: 'TEXT' },
            { name: 'employeeId', type: 'TEXT' },
            { name: 'departmentId', type: 'TEXT' },
            { name: 'position', type: 'TEXT' },
            { name: 'isActive', type: 'INTEGER', defaultValue: 1 },
            { name: 'metadata', type: 'TEXT' },
            { name: 'createdAt', type: 'TEXT', notNull: true }
          ] 
        }
      })
    }).then(res => res.json());
    console.log('New user table created.');

    // 5. 데이터 삽입
    const insertRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_insert_rows',
        arguments: { 
          tableName: 'user',
          rows: cleanedUsers
        }
      })
    }).then(res => res.json());
    console.log('Users inserted:', JSON.stringify(insertRes));

    // 6. 최종 확인
    const checkRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { query: "SELECT id, username, departmentId FROM user LIMIT 5" }
      })
    }).then(res => res.json());
    console.log('FINAL_VERIFICATION:', checkRes.result.content[0].text);

  } catch (e) {
    console.error(e);
  }
}
overhaul();
