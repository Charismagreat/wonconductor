const fetch = require('node-fetch');
const fs = require('fs');

const apiUrl = 'http://localhost:8080/user-data/tools/call';
const apiKey = '0cb2774f-75a2-43cf-ae76-152d5e6683cb';

async function process() {
  console.log('Starting restoration and synchronization for projects and config...');
  try {
    // --- 1. micro_app_projects 복원 ---
    const oldProjects = JSON.parse(fs.readFileSync('micro_app_projects_backup.json', 'utf8'));
    const cleanedProjects = oldProjects.map(row => {
      const { id, ...rest } = row;
      return rest;
    });

    console.log(`Restoring ${cleanedProjects.length} projects...`);
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_insert_rows',
        arguments: { tableName: 'micro_app_projects', rows: cleanedProjects }
      })
    });

    // --- 2. 신규 프로젝트 ID 매핑 생성 ---
    const newProjectsRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { query: "SELECT id, name FROM micro_app_projects" }
      })
    }).then(res => res.json());
    
    const newProjects = JSON.parse(newProjectsRes.result.content[0].text).rows;
    const projectMap = {};
    oldProjects.forEach(old => {
      const matched = newProjects.find(curr => curr.name === old.name);
      if (matched) projectMap[old.id] = matched.id;
    });
    console.log('Project Mapping:', JSON.stringify(projectMap));

    // --- 3. micro_app_config 가공 ---
    const oldConfigs = JSON.parse(fs.readFileSync('micro_app_config_backup.json', 'utf8'));
    const cleanedConfigs = oldConfigs.map(config => {
      const { id, ...rest } = config;
      // projectId 교체
      if (rest.projectId && projectMap[rest.projectId]) {
        rest.projectId = String(projectMap[rest.projectId]);
      }
      return rest;
    });
    console.log(`Prepared ${cleanedConfigs.length} configs for migration.`);

    // --- 4. micro_app_config 테이블 재구축 (id 제외) ---
    // 기존 삭제
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ tool: 'user_data_delete_table', arguments: { tableName: 'micro_app_config' } })
    });

    // 재생성 (id 제외)
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_create_table',
        arguments: { 
          tableName: 'micro_app_config', 
          displayName: 'Micro App Configurations', 
          schema: [ 
            { name: 'projectId', type: 'TEXT', notNull: true },
            { name: 'templateId', type: 'TEXT' },
            { name: 'sourceTableId', type: 'TEXT' },
            { name: 'mappingConfig', type: 'TEXT' },
            { name: 'uiSettings', type: 'TEXT' },
            { name: 'rbacRoles', type: 'TEXT' },
            { name: 'createdBy', type: 'TEXT' },
            { name: 'createdAt', type: 'TEXT' },
            { name: 'updatedAt', type: 'TEXT' }
          ] 
        }
      })
    });
    console.log('New micro_app_config table created.');

    // --- 5. 데이터 삽입 ---
    const insertRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_insert_rows',
        arguments: { tableName: 'micro_app_config', rows: cleanedConfigs }
      })
    }).then(res => res.json());
    console.log('Configs inserted:', JSON.stringify(insertRes));

    // --- 6. 최종 확인 ---
    const finalCheck = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        tool: 'user_data_sql_query',
        arguments: { query: "SELECT id, projectId, templateId FROM micro_app_config" }
      })
    }).then(res => res.json());
    console.log('FINAL_SYNC_CHECK:', finalCheck.result.content[0].text);

  } catch (e) {
    console.error(e);
  }
}
process();
