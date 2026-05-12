import { createTable } from './egdesk-helpers';
async function test() {
  try {
     const res1 = await createTable('test_english', [{name: 'id', type: 'INTEGER', notNull: true}], { tableName: 'test_english' });
     console.log('test_english success:', res1);
  } catch(e: any) { console.error('test_english error:', e.message); }
  
  try {
     const res2 = await createTable('테스트_한글', [{name: 'id', type: 'INTEGER', notNull: true}], { tableName: '테스트_한글' });
     console.log('테스트_한글 success:', res2);
  } catch(e: any) { console.error('테스트_한글 error:', e.message); }
}
test().catch(console.error);
