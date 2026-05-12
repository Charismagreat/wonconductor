import { listTables, listBankProductTables } from './egdesk-helpers';

/**
 * 이 스크립트는 업데이트된 userdata 서버가 listing 도구 호출 시 
 * 스키마 정보를 함께 반환하는지 확인하기 위한 용도입니다.
 */
async function checkListingSchemas() {
  console.log('=== [1] User Data Tables Listing ===');
  try {
    const result = await listTables();
    const tables = Array.isArray(result) ? result : (result as any).tables || [];
    
    console.log(`Found ${tables.length} tables.`);
    tables.slice(0, 5).forEach((t: any) => {
      console.log(`- Table: ${t.tableName} (${t.displayName})`);
      // 서버에서 업데이트된 schema 또는 columns 필드 확인
      const schema = t.schema || t.columns;
      if (schema) {
        console.log(`  └ Schema Found: ${schema.length} columns`);
        console.log(`  └ Sample: ${JSON.stringify(schema.slice(0, 2))}`);
      } else {
        console.log(`  └ No schema returned in listing.`);
      }
    });
  } catch (error) {
    console.error('Failed to list user tables:', error);
  }

  console.log('\n=== [2] FinanceHub Bank Product Tables Listing ===');
  try {
    const result = await listBankProductTables();
    const products = Array.isArray(result) ? result : (result as any).tables || [];

    console.log(`Found ${products.length} bank product tables.`);
    products.forEach((p: any) => {
      console.log(`- Product: ${p.displayName} (${p.slug})`);
      // FinanceHub listing은 'columns' 필드로 스키마를 반환함
      if (p.columns && Array.isArray(p.columns)) {
        console.log(`  └ Columns Found: ${p.columns.length} fields`);
        console.log(`  └ Sample: ${JSON.stringify(p.columns.slice(0, 2))}`);
      } else {
        console.log(`  └ No column info in listing.`);
      }
    });
  } catch (error) {
    console.error('Failed to list bank products:', error);
  }
}

checkListingSchemas();
