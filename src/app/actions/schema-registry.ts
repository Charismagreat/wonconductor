import { queryTable, getTableSchema } from '@/egdesk-helpers';
import { findSchemaStandard } from '@/lib/constants/schema-standards';

/**
 * 컬럼 객체에 시맨틱 메타데이터(마스터 연동 정보 등)를 주입합니다.
 */
function enrichColumnMetadata(column: any) {
  // 1. 이미 마스터 연동 정보가 포함되어 있다면 (지식 베이스 등에서 이미 분석됨) 해당 지식을 최우선으로 존중
  if (column.isMasterLinked || column.masterTable) {
    return {
      ...column,
      isMasterLinked: true
    };
  }

  // 2. 하드코딩된 표준 규칙(Fall-back)에서 매칭 시도
  const standard = findSchemaStandard(column.name);
  if (standard) {
    return {
      ...column,
      canonicalName: standard.canonicalName,
      masterTable: standard.masterTable,
      lookupField: standard.lookupField,
      nameFields: standard.nameFields,
      businessNumberFields: standard.businessNumberFields,
      isMasterLinked: true
    };
  }
  return column;
}

/**
 * 컬럼명을 기반으로 적절한 필드 타입을 추론합니다.
 */
function inferColumnType(name: string): string {
  const lowercase = name.toLowerCase();
  if (lowercase.includes('date') || lowercase.includes('at') || lowercase.includes('time')) return 'date';
  if (
    lowercase.includes('amount') || 
    lowercase.includes('price') || 
    lowercase.includes('cost') || 
    lowercase.includes('fee') ||
    lowercase.includes('금액') ||
    lowercase.includes('가액') ||
    lowercase.includes('세액') ||
    lowercase === '부가세' ||
    lowercase === '봉사료'
  ) return 'currency';
  if (lowercase.includes('count') || lowercase.includes('quantity') || (lowercase.includes('id') && lowercase !== 'id' && !lowercase.includes('uuid'))) return 'number';
  if (lowercase.startsWith('is') || lowercase.startsWith('has') || lowercase === 'active' || lowercase === 'deleted') return 'boolean';
  if (lowercase.includes('memo') || lowercase.includes('description') || lowercase.includes('data') || lowercase.includes('비고') || lowercase.includes('적요')) return 'textarea';
  return 'string';
}

/**
 * 가상/물리 테이블 구분 없이 최적의 스키마 정보를 가져옵니다.
 * 1. table_knowledge (AI 분석) 우선 참조
 * 2. report 매핑 (가상->물리) 확인 및 물리 스키마 조회
 * 3. 데이터 샘플링을 통한 추론 (Fallback)
 */
export async function getUnifiedTableSchema(id: string): Promise<any[]> {
  try {
    // 1. table_knowledge (AI 분석 지식) 확인
    try {
      const knowledge = await queryTable('table_knowledge', { 
        filters: { table_name: id },
        limit: 1 
      }).catch(() => []);
      
      const kRows = Array.isArray(knowledge) ? knowledge : (knowledge?.rows || []);
      if (kRows.length > 0 && kRows[0].schema_info) {
        const schema = JSON.parse(kRows[0].schema_info);
        if (Array.isArray(schema) && schema.length > 0) {
          console.log(`>>> [SchemaRegistry] Found schema from table_knowledge for: ${id}`);
          return schema.map((s: any) => enrichColumnMetadata({
            ...s,
            displayName: s.displayName || s.name,
            type: s.type || inferColumnType(s.name)
          }));
        }
      }
    } catch (e) {
      console.warn(`[SchemaRegistry] Failed to fetch from table_knowledge:`, e);
    }

    // 2. dashboard_master 테이블에서 물리 테이블 매핑 확인
    let physicalTableName = id;
    try {
      const reports = await queryTable('dashboard_master', { 
        filters: { reportId: id },
        limit: 1 
      }).catch(() => []);
      
      const rRows = Array.isArray(reports) ? reports : (reports?.rows || []);
      if (rRows.length > 0 && rRows[0].tableName) {
        physicalTableName = rRows[0].tableName;
        console.log(`>>> [SchemaRegistry] Mapping virtual ID '${id}' to physical table '${physicalTableName}'`);
      }
    } catch (e) {
      console.warn(`[SchemaRegistry] Failed to fetch mapping from dashboard_master table:`, e);
    }

    // 3. 물리 스키마 조회
    const physicalSchema = await getTableSchema(physicalTableName).catch(() => []);
    if (physicalSchema && physicalSchema.length > 0) {
      return physicalSchema.map((ps: any) => enrichColumnMetadata({
        name: ps.name,
        displayName: ps.displayName || ps.name,
        type: ps.type || inferColumnType(ps.name)
      }));
    }

    // 4. Fallback: 데이터 샘플링을 통한 추론
    console.log(`>>> [SchemaRegistry] Falling back to data sampling for: ${id}`);
    const samples = await queryTable(id, { limit: 1 }).catch(() => []);
    const sRows = Array.isArray(samples) ? samples : (samples?.rows || []);
    
    if (sRows.length > 0) {
      const firstRow = sRows[0];
      // [수정] 모든 테이블(report 포함)에서 정수형 고유 ID(id)를 포함하도록 변경
      return Object.keys(firstRow)
        .filter(k => k !== '_physicalId')
        .map(k => enrichColumnMetadata({
          name: k,
          displayName: k === 'id' ? 'ID' : k,
          type: k === 'id' ? 'number' : inferColumnType(k)
        }));
    }

    // 5. 금융 가상 테이블 고정 폴백 (마지막 수단)
    const financeColMap: Record<string, any[]> = {
      'bank_transactions': [
        { name: 'id', displayName: 'ID', type: 'number' },
        { name: 'date', displayName: '날짜', type: 'date' },
        { name: '_bankName', displayName: '은행명', type: 'string' },
        { name: 'accountNumber', displayName: '계좌번호', type: 'string' },
        { name: 'description', displayName: '적요', type: 'string' },
        { name: 'withdrawal', displayName: '출금액', type: 'currency' },
        { name: 'deposit', displayName: '입금액', type: 'currency' },
        { name: 'balance', displayName: '잔액', type: 'currency' }
      ],
      'card_approvals': [
        { name: 'id', displayName: 'ID', type: 'number' },
        { name: 'date', displayName: '날짜', type: 'date' },
        { name: '_bankName', displayName: '카드사', type: 'string' },
        { name: 'accountNumber', displayName: '카드번호', type: 'string' },
        { name: 'description', displayName: '적요', type: 'string' },
        { name: 'withdrawal', displayName: '출금액', type: 'currency' },
        { name: 'deposit', displayName: '입금액', type: 'currency' }
      ]
    };

    if (financeColMap[id]) {
      return financeColMap[id];
    }

    return [];
  } catch (error) {
    console.error(`[SchemaRegistry] Fatal error getting schema for ${id}:`, error);
    return [];
  }
}

/**
 * 테이블 ID를 기반으로 친숙한 이름을 가져옵니다.
 * 1. dashboard_master 테이블 매핑 확인
 * 2. 금융 가상 테이블 고정 폴백
 */
export async function getUnifiedTableName(id: string): Promise<string> {
  try {
    // 1. dashboard_master 테이블에서 이름 확인
    const reports = await queryTable('dashboard_master', { 
      filters: { reportId: id },
      limit: 1 
    }).catch(() => []);
    
    const rRows = Array.isArray(reports) ? reports : (reports?.rows || []);
    if (rRows.length > 0 && rRows[0].name) {
      return rRows[0].name;
    }

    // 2. 금융 가상 테이블 고정 폴백
    const friendlyNames: Record<string, string> = {
      'bank_transactions': '은행 계좌 거래 내역',
      'card_approvals': '신용카드 거래 내역',
      'promissory_notes': '전자어음 내역',
      'hometax_sales_tax_invoices': '홈택스 매출 세금계산서',
      'hometax_sales_invoices': '홈택스 매출 계산서',
      'hometax_purchase_tax_invoices': '홈택스 매입 세금계산서',
      'hometax_purchase_invoices': '홈택스 매입 계산서',
      'hometax_cash_receipts': '홈택스 현금영수증 내역'
    };

    return friendlyNames[id] || id;
  } catch (error) {
    return id;
  }
}
