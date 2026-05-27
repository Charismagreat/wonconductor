// test_get_schema.ts
import { getTableSchema } from './egdesk-helpers';

async function testGetSchema() {
  const tableSlug = 'ibk_b2b_receivables';
  console.log(`>>> [테스트] '${tableSlug}' 테이블의 실제 DB 컬럼 구조를 조회합니다.`);
  try {
    const res = await getTableSchema(tableSlug);
    console.log('--------------------------------------------------');
    console.log(JSON.stringify(res, null, 2));
    console.log('--------------------------------------------------');
  } catch (error: any) {
    console.error('!!! 에러 발생:', error.message);
  }
}

testGetSchema();
