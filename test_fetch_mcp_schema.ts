// test_fetch_mcp_schema.ts
import { EGDESK_CONFIG } from './egdesk.config';

async function fetchMcpSchema() {
  const apiUrl = EGDESK_CONFIG.apiUrl || 'http://localhost:8080';
  const apiKey = EGDESK_CONFIG.apiKey || '7a04500c-83ee-4dac-91de-18733863e83a';
  
  console.log(`>>> [테스트] EGDesk MCP 서버에서 툴 스키마 조회를 시도합니다...`);
  console.log(`URL: ${apiUrl}, Key: ${apiKey}`);

  const endpoints = [
    '/financehub/tools',
    '/financehub/tools/list',
    '/financehub/schema',
    '/financehub/list'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n시도 중: ${endpoint}`);
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const json = await response.json();
        console.log(`성공! [${endpoint}] 응답 결과:`);
        console.log(JSON.stringify(json, null, 2));
        return;
      } else {
        console.log(`실패: HTTP ${response.status} - ${response.statusText}`);
      }
    } catch (error: any) {
      console.log(`에러 발생 (${endpoint}):`, error.message);
    }
  }
  
  console.log('\n>>> [테스트] GET 엔드포인트를 통한 조회가 불가능합니다. 툴 호출을 이용한 에러 메시지 유도를 시도합니다.');
  // 툴 호출에 잘못된 툴 이름을 넣어서 사용 가능한 툴 목록이 에러로 나오는지 확인
  try {
    const response = await fetch(`${apiUrl}/financehub/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify({ tool: 'invalid_tool_name_for_schema_discovery', arguments: {} })
    });
    const json = await response.json();
    console.log('툴 호출 에러 응답:', JSON.stringify(json, null, 2));
  } catch (error: any) {
    console.error('툴 호출 시도 중 에러:', error.message);
  }
}

fetchMcpSchema();
