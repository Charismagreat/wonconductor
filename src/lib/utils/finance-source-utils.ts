import { 
  listBankProductTables,
  queryBankProductTable
} from '@/egdesk-helpers';
import { getSystemSchema } from '../constants/system-schemas';

/**
 * 금융/홈택스 소스에서 마이 디비와 동일한 '완벽한 스키마'를 추출합니다.
 * 데이터를 샘플링하는 대신 시스템 매니페스트와 서버 메타데이터를 우선 활용합니다.
 */
export async function getFinanceSourceSchema(id: string) {
  // 1. 시스템 표준 스키마 확인 (Hometax, Bank Transactions 등)
  const systemSchema = getSystemSchema(id);
  if (systemSchema) {
    return systemSchema;
  }

  // 2. 은행 개별 상품 테이블 확인 (서버 메타데이터 활용)
  try {
    const productTables = await listBankProductTables();
    const safeTables = Array.isArray(productTables) ? productTables : (productTables?.tables || []);
    const targetTable = safeTables.find((t: any) => t.slug === id || id.includes(t.slug));
    
    if (targetTable && targetTable.columns) {
      // 서버에서 이미 컬럼 정보를 주었다면 그대로 사용
      return targetTable.columns.map((c: any) => ({
        name: c.name,
        displayName: c.displayName || c.name,
        type: (c.type === 'INTEGER' || c.type === 'REAL' ? 'number' : (c.type === 'DATE' ? 'date' : 'string'))
      }));
    }

    // 3. (Fallback) 데이터 기반 키 추출 - 최후의 수단
    if (targetTable) {
        const res = await queryBankProductTable({ tableSlug: targetTable.slug, limit: 5, offset: 0 });
        const rows = Array.isArray(res) ? res : (res?.rows || []);
        if (rows.length > 0) {
            const keys = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
            const { inferColumnType } = await import('./schema');
            return keys.map(k => ({
                name: k,
                displayName: k,
                type: inferColumnType(k)
            }));
        }
    }
  } catch (err) {
    console.error(`[FinanceSourceUtils] Failed to fetch schema for ${id}:`, err);
  }

  return [];
}
