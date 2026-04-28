import { getSessionAction } from '@/app/actions/auth';
import { queryTable, getTableSchema, queryBankTransactions, queryCardTransactions } from '@/egdesk-helpers';

/**
 * 컬럼명을 기반으로 적절한 필드 타입을 추론합니다.
 */
function inferColumnType(name: string): string {
  const lowercase = name.toLowerCase();
  if (lowercase.includes('date') || lowercase.includes('at') || lowercase.includes('time')) return 'date';
  if (lowercase.includes('amount') || lowercase.includes('price') || lowercase.includes('cost') || lowercase.includes('fee')) return 'currency';
  if (lowercase.includes('count') || lowercase.includes('quantity') || (lowercase.includes('id') && lowercase !== 'id' && !lowercase.includes('uuid'))) return 'number';
  if (lowercase.startsWith('is') || lowercase.startsWith('has') || lowercase === 'active' || lowercase === 'deleted') return 'boolean';
  if (lowercase.includes('memo') || lowercase.includes('description') || lowercase.includes('data')) return 'textarea';
  if (lowercase.includes('email')) return 'email';
  if (lowercase.includes('phone') || lowercase.includes('tel') || lowercase.includes('mobile')) return 'phone';
  return 'string';
}
import { ReportDetailClient } from '@/components/ReportDetailClient';
import { getSourceViewSettingsAction } from '@/app/actions/publishing';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, User } from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;

  // 실제 세션 사용자 정보 가져오기
  const user = await getSessionAction();
  
  // 중앙 관리 뷰 설정 가져오기 (보고서 ID 및 원본 테이블 ID 기반 상속 지원)
  let viewSettingsRes = await getSourceViewSettingsAction(id);
  let savedConfig = viewSettingsRes.success && viewSettingsRes.data ? viewSettingsRes.data.view_config : null;

  console.log(`>>> [SERVER DEBUG] ID: ${id}, SavedConfig Found: ${!!savedConfig}`);
  if (savedConfig) {
    console.log(`>>> [SERVER DEBUG] Config Columns: ${savedConfig.columns?.length || 0}`);
  }

  // 보고서인 경우 원본 테이블의 설정도 확인하여 상속 (중앙 집중식 관리)
  const isReportId = id.startsWith('rep-') || /^\d+$/.test(id);
  if (isReportId && !savedConfig) {
    try {
      const { queryTable } = await import('@/egdesk-helpers');
      const filter = /^\d+$/.test(id) ? { id: Number(id) } : { reportId: id };
      const reports = await queryTable('dashboard_master', { filters: filter, limit: 1 });
      const sourceTableName = reports[0]?.tableName;
      if (sourceTableName) {
        const sourceSettingsRes = await getSourceViewSettingsAction(sourceTableName);
        if (sourceSettingsRes.success && sourceSettingsRes.data) {
          savedConfig = sourceSettingsRes.data.view_config;
          console.log(`>>> [SERVER] Inherited view settings from source table: ${sourceTableName}`);
        }
      }
    } catch (err) {
      console.warn('Failed to inherit source table settings:', err);
    }
  }

  let report: any;
  let rows: any[] = [];
  let columns: any[] = [];

  if (id === 'test-report-id') {
    const { TABLES } = await import('@/egdesk.config');
    const tableDef = TABLES.table1;
    const physicalSchema = await getTableSchema(tableDef.name).catch(() => []);
    
    report = {
      id: 'test-report-id',
      name: tableDef.displayName,
      sheetName: 'Main Database',
      columns: JSON.stringify(tableDef.columns.map((c: string) => {
        const pCol = physicalSchema.find((ps: any) => ps.name === c);
        let type = inferColumnType(c);
        if (pCol) {
          if (pCol.type === 'REAL' || pCol.type === 'INTEGER') type = 'number';
          if (pCol.type === 'DATE') type = 'date';
        }
        return { name: c, type };
      })),
      ownerId: 'system',
    };
    const rowsData = await queryTable(tableDef.name, { limit: 100 });
    rows = rowsData.map((r: any, idx: number) => ({ ...r, id: String(idx), updatedAt: new Date().toISOString() }));
    columns = JSON.parse(report.columns);
  } else if (id.startsWith('hometax_') || id === 'promissory_notes' || id === 'bank_transactions' || id === 'card_approvals') {
    let mockData: any[] = [];
    let tableName = '';
    let sheetName = '';

    const taxInvoiceSchema = [
      { id: '1', '승인번호': '20260418-41000213', '작성일자': '2026-04-18', '발급일자': '2026-04-18', '전송일자': '2026-04-19', '공급자사업자등록번호': '123-45-67890', '공급자종사업장번호': '0000', '공급자상호': '글로벌 유통', '공급자성명': '김대표', '공급자사업장주소': '서울시 강남구 테헤란로 123', '공급자업태': '도매 및 소매업', '공급자종목': '유통', '공급자이메일': 'admin@global.com', '받는자사업자등록번호': '987-65-43210', '받는자종사업장번호': '0000', '받는자상호': '우리회사', '받는자성명': '이대표', '받는자사업장주소': '서울시 서초구 서초대로 456', '받는자업태': '제조업', '받는자종목': '소프트웨어', '받는자이메일1': 'contact@woori.com', '받는자이메일2': '', '합계금액': 5500000, '공급가액': 5000000, '세액': 500000, '영수청구구분': '영수', '비고': '4월 정기청구분', '일자1': '0418', '품목1': '서버 유지보수', '규격1': '', '수량1': 1, '단가1': 5000000, '공급가액1': 5000000, '세액1': 500000, '비고1': '' },
      { id: '2', '승인번호': '20260415-41000992', '작성일자': '2026-04-15', '발급일자': '2026-04-15', '전송일자': '2026-04-16', '공급자사업자등록번호': '111-22-33333', '공급자종사업장번호': '0000', '공급자상호': 'IT 솔루션즈', '공급자성명': '박솔루', '공급자사업장주소': '경기도 성남시 판교역로 77', '공급자업태': '서비스업', '공급자종목': '시스템구축', '공급자이메일': 'bill@itsol.com', '받는자사업자등록번호': '987-65-43210', '받는자종사업장번호': '0000', '받는자상호': '우리회사', '받는자성명': '이대표', '받는자사업장주소': '서울시 서초구 서초대로 456', '받는자업태': '제조업', '받는자종목': '소프트웨어', '받는자이메일1': 'contact@woori.com', '받는자이메일2': '', '합계금액': 1320000, '공급가액': 1200000, '세액': 120000, '영수청구구분': '청구', '비고': '라이선스 갱신', '일자1': '0415', '품목1': '클라우드 라이선스 1년', '규격1': 'Enterprise', '수량1': 10, '단가1': 120000, '공급가액1': 1200000, '세액1': 120000, '비고1': '' }
    ];

    const invoiceSchema = [
      { id: '1', '승인번호': '20260410-22000111', '작성일자': '2026-04-10', '발급일자': '2026-04-10', '전송일자': '2026-04-11', '공급자사업자등록번호': '555-66-77777', '공급자종사업장번호': '0000', '공급자상호': '청정농산', '공급자성명': '최농장', '공급자사업장주소': '제주특별자치도 제주시 청정로 1', '공급자업태': '농업', '공급자종목': '농산물', '공급자이메일': '', '받는자사업자등록번호': '987-65-43210', '받는자종사업장번호': '0000', '받는자상호': '우리회사', '받는자성명': '이대표', '받는자사업장주소': '서울시 서초구 서초대로 456', '받는자업태': '제조업', '받는자종목': '소프트웨어', '받는자이메일1': 'contact@woori.com', '받는자이메일2': '', '합계금액': 300000, '공급가액': 300000, '세액': 0, '영수청구구분': '청구', '비고': '명절 선물세트', '일자1': '0410', '품목1': '사과세트', '규격1': '특대', '수량1': 10, '단가1': 30000, '공급가액1': 300000, '세액1': 0, '비고1': '' }
    ];

    const cashReceiptSchema = [
      { id: '1', '거래일시': '2026-04-15 12:30:15', '승인번호': '88237123', '신분확인번호': '010-****-1234', '거래구분': '소득공제', '총거래금액': 15000, '공급가액': 13636, '부가세': 1364, '봉사료': 0, '승인취소구분': '승인', '가맹점사업자번호': '222-33-44444', '가맹점상호명': '스타벅스 강남점', '가맹점업태': '음식점업', '가맹점종목': '커피전문점', '가맹점주소': '서울시 강남구 강남대로 123', '발급수단': '휴대전화' },
      { id: '2', '거래일시': '2026-04-12 18:45:22', '승인번호': '88721234', '신분확인번호': '9876543210', '거래구분': '지출증빙', '총거래금액': 85000, '공급가액': 77273, '부가세': 7727, '봉사료': 0, '승인취소구분': '승인', '가맹점사업자번호': '333-44-55555', '가맹점상호명': '강남한우', '가맹점업태': '음식점업', '가맹점종목': '한식', '가맹점주소': '서울시 강남구 역삼로 45', '발급수단': '사업자용카드' }
    ];

    // 이지데스크 실데이터 연동 API 호출
    const { 
        queryTaxInvoices,
        queryTaxExemptInvoices,
        queryCashReceipts,
        queryPromissoryNotes
    } = await import('@/egdesk-helpers');

    let allFetched: any[] = [];
    let offset = 0;
    const limit = 1000;
    
    while (true) {
        let batchData: any = null;
        
        switch (id) {
            case 'hometax_sales_tax_invoices':
            case 'hometax_sales_invoices':
                mockData = id.includes('_tax') ? taxInvoiceSchema : invoiceSchema;
                tableName = id === 'hometax_sales_tax_invoices' ? '매출세금계산서' : '매출계산서';
                sheetName = id === 'hometax_sales_tax_invoices' ? 'Sales Tax Invoice' : 'Sales Invoice';
                batchData = id.includes('_tax') 
                    ? await queryTaxInvoices({ invoiceType: 'sales', limit, offset })
                    : await queryTaxExemptInvoices({ invoiceType: 'sales', limit, offset });
                break;
            case 'hometax_purchase_tax_invoices':
            case 'hometax_purchase_invoices':
                mockData = id.includes('_tax') ? taxInvoiceSchema : invoiceSchema;
                tableName = id === 'hometax_purchase_tax_invoices' ? '매입세금계산서' : '매입계산서';
                sheetName = id === 'hometax_purchase_tax_invoices' ? 'Purchase Tax Invoice' : 'Purchase Invoice';
                batchData = id.includes('_tax')
                    ? await queryTaxInvoices({ invoiceType: 'purchase', limit, offset })
                    : await queryTaxExemptInvoices({ invoiceType: 'purchase', limit, offset });
                break;
            case 'hometax_cash_receipts':
                mockData = cashReceiptSchema;
                tableName = '현금영수증 내역';
                sheetName = 'Cash Receipt';
                batchData = await queryCashReceipts({ limit, offset });
                break;
            case 'promissory_notes':
                tableName = '전자어음 내역';
                sheetName = 'Promissory External';
                batchData = await queryPromissoryNotes({ limit, offset });
                break;
            case 'bank_transactions':
                tableName = '은행거래내역';
                sheetName = 'Bank Transactions';
                batchData = await queryTable('bank_transactions', { limit, offset });
                break;
            case 'card_approvals':
                tableName = '신용카드 거래 내역';
                sheetName = 'Card External';
                batchData = await queryCardTransactions({ limit, offset });
                break;
        }

        // EGDesk API의 응답 구조 처리 (MCP 도구별 리턴 키 매핑: transactions, invoices, receipts, notes, rows)
        const rawBatch = Array.isArray(batchData) ? batchData : (
            batchData?.rows || batchData?.transactions || batchData?.invoices || batchData?.receipts || batchData?.notes || batchData?.data || []
        );

        let batch = rawBatch;

        // [필터링] 세금계산서와 계산서 종류 필터링 (MCP가 통합으로 내려주므로 여기서 분리)
        if (id.includes('_tax') && id.includes('hometax_')) {
            // '세금계산서', '수정세금계산서' 포함
            batch = rawBatch.filter((b: any) => b['전자세금계산서분류'] && b['전자세금계산서분류'].includes('세금계산서'));
        } else if (id.includes('_invoices') && id.includes('hometax_') && !id.includes('_tax')) {
            // '계산서', '면세계산서', '수정계산서' 포괄 (세금계산서 제외)
            batch = rawBatch.filter((b: any) => {
                const cls = b['전자세금계산서분류'] || '';
                return (cls.includes('계산서') && !cls.includes('세금계산서')) || !cls;
            });
        }

        if (batch.length > 0) {
            allFetched.push(...batch);
        }
        
        // 데이터가 limit 미만이면 마지막 페이지 (반드시 필터링 전 원본 rawBatch 기준으로 판별)
        if (rawBatch.length < limit) {
            break;
        }
        offset += limit;
    }

    const mockDataForSchema = allFetched.length > 0 ? allFetched : (mockData.length > 0 ? mockData : [{}]); // 데이터 0건 시 mock 스키마 템플릿 사용
    
    const pKeys = Object.keys(mockDataForSchema[0] || {});
    const fCols = pKeys.map(k => ({
         name: k,
         type: (k.includes('금액') || k.includes('가액') || k.includes('세액') || k === '부가세' || k === '봉사료') ? 'currency' : inferColumnType(k)
    }));

    report = {
        id,
        name: tableName,
        sheetName: sheetName,
        columns: JSON.stringify(fCols),
        ownerId: 'system',
        isReadOnly: true,
    };

    rows = allFetched.map((d: any) => ({ ...d, updatedAt: new Date().toISOString() }));
    columns = fCols;
  } else if (id === 'NON_EXISTENT_ID_PLACEHOLDER') { 
    // 기존의 복잡한 가상 조인 로직을 제거했습니다. 이제 물리 테이블에서 직접 조회합니다.
    // finance-hub-* ID들은 아래의 물리 테이블 조회 로직에서 처리됩니다.
  } else {
    const { getTableByName } = await import('@/egdesk.config');
    const systemTableDef = getTableByName(id);

    if (systemTableDef) {
      const physicalSchema = await getTableSchema(systemTableDef.name).catch(() => []);
      
      report = {
        id: systemTableDef.name,
        name: systemTableDef.displayName,
        sheetName: 'System Table',
        columns: JSON.stringify(systemTableDef.columns.map((c: string) => {
           const pCol = physicalSchema.find((ps: any) => ps.name === c);
           let type = inferColumnType(c);
           if (pCol) {
             if (pCol.type === 'REAL' || pCol.type === 'INTEGER') {
               type = (c.startsWith('is') || c.startsWith('has') || c === 'active') ? 'boolean' : 'number';
             }
             if (pCol.type === 'DATE') type = 'date';
           }
           return { name: c, type };
        })),
        ownerId: 'system',
        isReadOnly: true,
      };
      
      try {
        const rowsData = await queryTable(systemTableDef.name, { limit: 1000 });
        rows = rowsData.map((r: any, idx: number) => ({
           ...r, 
           id: String(r.id || idx), 
           updatedAt: r.updatedAt || new Date().toISOString() 
        }));
      } catch (err) {
        console.error(`Failed to load system table ${systemTableDef.name}`, err);
        rows = [];
      }
      columns = JSON.parse(report.columns);
    } else {
      const filter = /^\d+$/.test(id) ? { id: Number(id) } : { reportId: id };
      const reports = await queryTable('dashboard_master', { filters: filter });
      report = reports[0];

      if (!report) {
        // 혹시 가상 보고서가 아니라 시스템에 존재하는 원시 물리 테이블명으로 직접 접근한 경우인지 확인합니다.
        const rawPhysicalSchema = await getTableSchema(id).catch(() => []);
        if (rawPhysicalSchema && rawPhysicalSchema.length > 0) {
            const { listTables } = await import('@/egdesk-helpers');
            const tablesRes = await listTables().catch(() => ({ tables: [] }));
            const matchedTable = tablesRes?.tables?.find((t: any) => t.tableName === id);
            const displayName = matchedTable?.displayName || id;

            report = {
                id: id,
                name: displayName,
                sheetName: 'Raw Physical Table',
                columns: JSON.stringify(rawPhysicalSchema.map((ps: any) => {
                    let type = inferColumnType(ps.name);
                    if (ps.type === 'REAL' || ps.type === 'INTEGER') {
                        type = (ps.name.toLowerCase().startsWith('is') || ps.name.toLowerCase().startsWith('has') || ps.name.toLowerCase() === 'active') ? 'boolean' : 'number';
                    }
                    if (ps.type === 'DATE') type = 'date';
                    return { name: ps.name, type };
                })),
                ownerId: 'system',
                isReadOnly: true,
            };

            try {
                const rowsData = await queryTable(id, { limit: 1000 });
                rows = rowsData.map((r: any, idx: number) => ({
                    ...r,
                    id: String(r.id || r.did || idx),
                    updatedAt: r.updatedAt || new Date().toISOString()
                }));
            } catch (err) {
                console.error(`Failed to load raw physical table ${id}:`, err);
                rows = [];
            }
            columns = JSON.parse(report.columns);
        } else {
            return <div className="p-20 text-center text-gray-500 font-bold">보고서를 찾을 수 없거나 삭제되었습니다.</div>;
        }
      } else {
      const columnsData = JSON.parse(report.columns || '[]');
      
      // [회복성 강화] 컬럼 정보가 비어있거나 tableName이 없는 경우 자동 추론 시도
      let effectiveTableName = report.tableName;
      if (!effectiveTableName && id.startsWith('rep-')) {
          effectiveTableName = id.replace('rep-', '');
      }

      const physicalSchema = effectiveTableName ? await getTableSchema(effectiveTableName).catch(() => []) : [];
      
      // 컬럼 정보가 비어있으면 물리 스키마에서 직접 생성
      let finalColumns = columnsData.length > 0 ? columnsData : physicalSchema.map((ps: any) => ({
          name: ps.name,
          type: inferColumnType(ps.name)
      }));

      columns = finalColumns.map((c: any) => {
        let colObj = typeof c === 'string' ? { name: c, type: inferColumnType(c) } : c;
        // 물리적 스키마와 비교하여 타입 보정
        const pCol = physicalSchema.find((ps: any) => ps.name === colObj.name);
        if (pCol) {
          if ((pCol.type === 'REAL' || pCol.type === 'INTEGER') && (colObj.type === 'string' || colObj.type === 'TEXT')) colObj.type = 'number';
          if (pCol.type === 'DATE' && (colObj.type === 'string' || colObj.type === 'TEXT')) colObj.type = 'date';
        }
        return colObj;
      });

      if (effectiveTableName) {
          // 물리적 테이블이 있는 경우 해당 테이블에서 직접 조회
          try {
              const rowsData = await queryTable(effectiveTableName, { limit: 1000 });
              const virtualRows = await queryTable('dashboard_data', { filters: { reportId: id }, limit: 10000 });
              
              const idColDef = columnsData.find((c: any) => c.isAutoGenerated || c.name === '데이터ID');
              const idColName = idColDef ? idColDef.name : null;
              
              const usedVirtualIds = new Set();

              rows = rowsData.map((r: any, idx: number) => {
                  let uuid = r.id || r.did || `row-${idx}`;
                  let updatedAt = r.updatedAt || report.createdAt;
                  let isDeleted = false;
                  let creatorId = 'system';
                  
                  // 1. Try to find by unique exact ID
                  let vr = virtualRows.find((v: any) => {
                      if (usedVirtualIds.has(v.id)) return false;
                      try {
                          const d = JSON.parse(v.data);
                          if (idColName && d[idColName] && r[idColName] && String(d[idColName]) === String(r[idColName])) return true;
                          if (d.id && r.id && String(d.id) === String(r.id)) return true;
                          return false;
                      } catch(e) { return false; }
                  });
                  
                  // 2. If no unique ID could match, try to match by all row fields (content match)
                  if (!vr) {
                      vr = virtualRows.find((v: any) => {
                          if (usedVirtualIds.has(v.id)) return false;
                          try {
                              const d = JSON.parse(v.data);
                              // Match every column (excluding dynamically added ones)
                              const matches = columnsData.every((c: any) => {
                                  if (c.isAutoGenerated) return true;
                                  return String(d[c.name] || '') === String(r[c.name] || '');
                              });
                              return matches;
                          } catch(e) { return false; }
                      });
                  }

                  if (vr) {
                      usedVirtualIds.add(vr.id);
                      uuid = vr.id;
                      updatedAt = vr.updatedAt;
                      isDeleted = (vr.isDeleted === 1 || String(vr.isDeleted) === '1' || vr.isDeleted === true);
                      creatorId = vr.creatorId;
                  }

                  return {
                      ...r,
                      id: uuid,
                      _physicalId: r.id, 
                      updatedAt,
                      isDeleted,
                      creatorId
                  };
              });

              // Append soft-deleted virtual rows that have been removed from the physical table
              virtualRows.forEach((v: any) => {
                  if (!usedVirtualIds.has(v.id)) {
                      const isDeleted = (v.isDeleted === 1 || String(v.isDeleted) === '1' || v.isDeleted === true);
                      if (isDeleted) {
                          try {
                              const d = JSON.parse(v.data);
                              rows.push({
                                  ...d,
                                  id: v.id,
                                  updatedAt: v.updatedAt,
                                  isDeleted: true,
                                  creatorId: v.creatorId
                              });
                          } catch(e) {}
                      }
                  }
              });
          } catch (err) {
              console.error(`Physical table ${report.tableName} query failed:`, err);
              // Fallback to dashboard_data if physical table fails
              const rowsData = await queryTable('dashboard_data', {
                  filters: { reportId: id },
                  orderBy: 'updatedAt',
                  orderDirection: 'DESC'
              });
              rows = rowsData.map((r: any) => ({
                  ...JSON.parse(r.data),
                  id: r.id,
                  updatedAt: r.updatedAt,
                  isDeleted: r.isDeleted === 1,
                  creatorId: r.creatorId
              }));
          }
      } else {
          // 기존 가상 테이블(dashboard_data) 방식 유지
          const rowsData = await queryTable('dashboard_data', {
            filters: { reportId: id },
            orderBy: 'updatedAt',
            orderDirection: 'DESC'
          });

          rows = rowsData.map((r: any) => ({
            ...JSON.parse(r.data),
            id: r.id,
            updatedAt: r.updatedAt,
            isDeleted: r.isDeleted === 1,
            creatorId: r.creatorId
          }));
      }
    }
    }
  }

  // [중요] 중앙 관리 뷰 설정(savedConfig) 병합 및 정렬
  if (savedConfig && savedConfig.columns && columns.length > 0) {
    const configuredCols = savedConfig.columns;
    
    // 설정된 컬럼들을 먼저 순서대로 정렬하여 배치
    const mergedColumns = configuredCols
      .filter((cc: any) => cc.visible !== false)
      .map((cc: any) => {
        const originalCol = columns.find(c => {
          if (typeof c === 'string') return c === cc.name;
          const physicalName = c.id || c.name; // 리포트는 id가 물리명, 테이블은 name이 물리명
          return physicalName === cc.name;
        });
        const colObj = typeof originalCol === 'string' ? { name: originalCol, type: inferColumnType(originalCol) } : originalCol;
        
        return {
          ...colObj,
          name: cc.name,
          displayName: cc.displayName || (colObj?.displayName) || cc.name,
          type: colObj?.type || cc.type || 'string'
        };
      }).filter((c: any) => c.name); // 유효한 컬럼만 유지

    // 설정에 없는 나머지 컬럼들 추가
    const remainingCols = columns.filter(c => {
      const name = typeof c === 'string' ? c : (c.id || c.name);
      return !configuredCols.some((cc: any) => cc.name === name);
    }).map(c => typeof c === 'string' ? { name: c, type: inferColumnType(c) } : c);

    columns = [...mergedColumns, ...remainingCols];
    console.log(`>>> [SERVER DEBUG] Merged Columns: ${mergedColumns.length}, Remaining: ${remainingCols.length}, Final Total: ${columns.length}`);
  }

  const isOwner = report.ownerId === user?.id || report.ownerId === 'system';
  const isAdmin = user?.role === 'ADMIN';
  const canEdit = (isOwner || isAdmin || user?.role === 'EDITOR') && !report.isReadOnly;

  // 일반 사용자(VIEWER)인 경우 전용 입력 페이지로 리다이렉트
  if (user?.role === 'VIEWER' && !isOwner) {
    redirect(`/report/${id}/input`);
  }

  return (
    <div className="px-8 md:px-12 pt-6 pb-12">
      <ReportDetailClient
        id={id}
        report={report}
        user={user}
        columns={columns}
        rows={rows}
        isOwner={isOwner && !report.isReadOnly}
        isAdmin={isAdmin && !report.isReadOnly}
        canEdit={canEdit}
        multiSortConfig={savedConfig?.multiSortConfig}
      />
    </div>
  );
}
