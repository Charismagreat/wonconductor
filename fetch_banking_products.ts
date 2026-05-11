
import { listBankProductTables } from './egdesk-helpers.ts';

/**
 * 은행 제품 테이블 목록을 가져와서 구조를 분석하는 연습 스크립트입니다.
 */
async function fetchBankingProducts() {
  console.log('>>> 은행 제품 테이블 목록 조회를 시작합니다...');
  
  try {
    const products = await listBankProductTables();
    
    console.log('--------------------------------------------------');
    console.log(`조회 결과 타입: ${typeof products}`);
    console.log(`배열 여부: ${Array.isArray(products)}`);
    
    if (products) {
      if (Array.isArray(products)) {
        console.log(`조회된 상품 수: ${products.length}건`);
        if (products.length > 0) {
          console.log('첫 번째 상품 상세 정보:');
          console.log(JSON.stringify(products[0], null, 2));
          
          console.log('\n전체 상품 리스트 (ID 및 이름):');
          products.forEach((p, i) => {
            console.log(`[${i}] ID: ${p.tableSlug || p.tableName} | Name: ${p.displayName || p.tableName}`);
          });
        }
      } else {
        console.log('결과가 배열이 아닙니다. 전체 구조를 출력합니다:');
        console.log(JSON.stringify(products, null, 2));
      }
    } else {
      console.log('결과값이 null 또는 undefined입니다.');
    }
    console.log('--------------------------------------------------');
    
  } catch (error: any) {
    console.error('!!! 은행 제품 조회 중 오류 발생:', error.message);
  }
}

fetchBankingProducts();
