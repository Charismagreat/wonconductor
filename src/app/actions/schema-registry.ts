import { findSchemaStandard } from '@/lib/constants/schema-standards';
import { inferColumnType } from '@/lib/utils/schema';

/**
 * 컬럼 객체에 시맨틱 메타데이터(마스터 연동 정보 등)를 주입합니다.
 */
function enrichColumnMetadata(column: any) {
  if (column.isMasterLinked || column.masterTable) {
    return { ...column, isMasterLinked: true };
  }
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
 * 가상/물리 테이블 구분 없이 최적의 스키마 정보를 가져옵니다.
 */
export async function getUnifiedTableSchema(id: string): Promise<any[]> {
  if (!id) return [];
  const tableId = id.trim();

  try {
    console.log(`>>> [SchemaRegistry] getUnifiedTableSchema for: "${tableId}"`);

    const { getSourceViewSettingsAction } = await import('./publishing');
    const { queryTable } = await import('@/egdesk-helpers');
    
    let viewSettingsRes = await getSourceViewSettingsAction(tableId);
    let savedConfig = viewSettingsRes.success && viewSettingsRes.data ? viewSettingsRes.data.view_config : null;

    // [마이 디비 로직 이식] 리포트인 경우 원본 테이블의 설정도 확인하여 상속
    const isReportId = tableId.startsWith('rep-') || /^\d+$/.test(tableId);
    if (isReportId && !savedConfig) {
      try {
        const filter = /^\d+$/.test(tableId) ? { id: String(tableId) } : { reportId: tableId };
        const reportsRes = await queryTable('dashboard_master', { filters: filter, limit: 1 });
        const reports = Array.isArray(reportsRes) ? reportsRes : (reportsRes as any)?.rows || [];
        const sourceTableName = reports[0]?.tableName;
        if (sourceTableName) {
          const sourceSettingsRes = await getSourceViewSettingsAction(sourceTableName);
          if (sourceSettingsRes.success && sourceSettingsRes.data) {
            savedConfig = sourceSettingsRes.data.view_config;
          }
        }
      } catch (err) {}
    }

    // 1. FinanceHub / HomeTax / Bank Products 특수 처리 (공통 유틸리티 사용)
    if (
      tableId === 'bank_transactions' || 
      tableId === 'card_approvals' || 
      tableId.startsWith('hometax_') || 
      tableId.includes('_transactions') || 
      tableId.includes('_ebill_') || 
      tableId.includes('_notes') || 
      tableId.includes('_receivables') ||
      tableId.startsWith('bank-product:')
    ) {
      try {
        const { getFinanceSourceSchema } = await import('@/lib/utils/finance-source-utils');
        const metadataCols = await getFinanceSourceSchema(tableId);

        // [핵심] 데이터가 없더라도 저장된 설정이 있다면 이를 기반으로 스키마 복구
        if (metadataCols.length === 0 && savedConfig?.columns) {
          const recoveredCols = savedConfig.columns.map((sc: any) => ({
            name: sc.name,
            displayName: sc.displayName || sc.name,
            type: sc.type || 'string'
          }));
          const enriched = recoveredCols.map(c => enrichColumnMetadata(c));
          return applyViewSettings(enriched, savedConfig.columns);
        }

        if (metadataCols.length > 0) {
          const enriched = metadataCols.map(c => enrichColumnMetadata(c));
          return applyViewSettings(enriched, savedConfig?.columns);
        }
      } catch (err) {
        console.error(`>>> [SchemaRegistry] FinanceSource schema resolution failed:`, err);
      }
    }

    // 2. 일반 물리 테이블 및 가상 리포트
    const { getTableSchema } = await import('@/egdesk-helpers');
    let physicalTableName = tableId;

    const reportsRes = await queryTable('dashboard_master', { filters: { reportId: tableId }, limit: 1 }).catch(() => null);
    const reports = Array.isArray(reportsRes) ? reportsRes : (reportsRes?.rows || []);
    if (reports.length > 0 && reports[0].tableName) {
      physicalTableName = reports[0].tableName;
    }

    const physicalSchema = await getTableSchema(physicalTableName).catch(() => null);
    const cols = Array.isArray(physicalSchema) ? physicalSchema : (physicalSchema as any)?.columns || (physicalSchema as any)?.schema || [];

    if (cols.length > 0) {
      const mapped = cols.map((c: any) => enrichColumnMetadata({
        name: c.name,
        type: (c.type === 'INTEGER' || c.type === 'REAL' ? 'number' : (c.type === 'DATE' ? 'date' : 'string')),
        displayName: c.name
      }));
      return applyViewSettings(mapped, savedConfig?.columns);
    }

    // 3. 마지막 수단: table_knowledge
    const knowledgeRes = await queryTable('table_knowledge', { filters: { target_id: tableId }, limit: 1 }).catch(() => null);
    const kRows = Array.isArray(knowledgeRes) ? knowledgeRes : (knowledgeRes?.rows || []);
    if (kRows.length > 0 && kRows[0].schema_info) {
      const schema = JSON.parse(kRows[0].schema_info);
      if (Array.isArray(schema)) {
        const enriched = schema.map((s: any) => enrichColumnMetadata({
          ...s,
          displayName: s.displayName || s.name,
          type: s.type || 'string'
        }));
        return applyViewSettings(enriched, savedConfig?.columns);
      }
    }
  } catch (err: any) {
    console.error(`[SchemaRegistry] Error resolving schema for ${tableId}:`, err.message);
  }
  return [];
}

/**
 * 뷰 설정(SavedConfig) 적용 (마이 디비 완벽 재현)
 */
function applyViewSettings(baseColumns: any[], savedColumns: any[]): any[] {
  if (!savedColumns || savedColumns.length === 0) return baseColumns;

  const usedBaseKeys = new Set<string>();
  
  // 1. 설정에 있는 순서대로 정렬 및 명칭 변경
  const configuredCols = savedColumns
    .filter(sc => sc.visible !== false)
    .map(sc => {
      const original = baseColumns.find(bc => bc.name === sc.name);
      if (original) usedBaseKeys.add(sc.name);
      return {
        ...(original || {}),
        name: sc.name,
        displayName: sc.displayName || original?.displayName || sc.name,
        type: original?.type || 'string'
      };
    })
    .filter(c => c.name);

  // 2. 실제 데이터에는 있지만 설정에는 없는 새로운 컬럼 추가 (데이터 누락 방지)
  const newCols = baseColumns
    .filter(bc => !usedBaseKeys.has(bc.name))
    .map(bc => ({
      ...bc,
      displayName: bc.displayName || bc.name
    }));

  return [...configuredCols, ...newCols];
}

/**
 * 친숙한 이름 가져오기
 */
export async function getUnifiedTableName(id: string): Promise<string> {
  const { queryTable } = await import('@/egdesk-helpers');
  try {
    const reports = await queryTable('dashboard_master', { filters: { reportId: id }, limit: 1 }).catch(() => null);
    const rRows = Array.isArray(reports) ? reports : (reports?.rows || []);
    if (rRows.length > 0 && rRows[0].name) return rRows[0].name;

    const friendlyNames: Record<string, string> = {
      'bank_transactions': '은행 계좌 거래 내역',
      'card_approvals': '신용카드 거래 내역',
      'hometax_sales_tax_invoices': '홈택스 매출 세금계산서',
      'hometax_sales_invoices': '홈택스 매출 계산서',
      'hometax_purchase_tax_invoices': '홈택스 매입 세금계산서',
      'hometax_purchase_invoices': '홈택스 매입 계산서',
      'hometax_cash_receipts': '홈택스 현금영수증 내역'
    };
    return friendlyNames[id] || id;
  } catch (error) { return id; }
}
