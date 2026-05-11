
import { listBankProductTables, getTableSchema } from './egdesk-helpers.ts';

async function compareSchema() {
  const targetSlug = 'ibk_b2b_receivables';
  console.log(`>>> [SchemaTest] '${targetSlug}' 테이블 비교 분석을 시작합니다...`);
  
  try {
    // 1. 메타데이터 조회
    const metaRes = await listBankProductTables();
    const metaList = Array.isArray(metaRes) ? metaRes : (metaRes as any)?.tables || [];
    const metaProduct = metaList.find((p: any) => p.slug === targetSlug);
    const metaColumnCount = metaProduct?.columns?.length || 0;
    
    // 2. 물리 DB 스키마 조회
    const physicalRes = await getTableSchema(targetSlug);
    const physicalCols = Array.isArray(physicalRes) ? physicalRes : (physicalRes as any)?.columns || (physicalRes as any)?.schema || [];
    const physicalColumnCount = physicalCols.length;
    
    console.log('--------------------------------------------------');
    console.log(`[결과] 메타데이터 상 컬럼 수: ${metaColumnCount}개`);
    console.log(`[결과] 실제 DB 테이블 컬럼 수: ${physicalColumnCount}개`);
    console.log('--------------------------------------------------');
    
    if (metaColumnCount !== physicalColumnCount) {
      console.log('!!! 주의: 메타데이터와 실제 DB 스키마가 일치하지 않습니다.');
      console.log('메타데이터 컬럼 목록:', metaProduct?.columns?.map((c: any) => c.name).join(', '));
      console.log('실제 DB 컬럼 목록:', physicalCols.map((c: any) => c.name).join(', '));
    } else {
      console.log('성공: 메타데이터와 실제 DB 스키마가 일치합니다.');
    }
    
  } catch (error: any) {
    console.error('!!! 테스트 중 오류 발생:', error.message);
  }
}

compareSchema();
