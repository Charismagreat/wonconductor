import { getSessionAction } from '@/app/actions/auth';
import { queryTable, getTableSchema, queryBankTransactions, queryCardTransactions } from '@/egdesk-helpers';

import { inferColumnType } from '@/lib/utils/schema';
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
  
  // 중앙 관리 뷰 설정 가져오기
  let viewSettingsRes = await getSourceViewSettingsAction(id);
  let savedConfig = viewSettingsRes.success && viewSettingsRes.data ? viewSettingsRes.data.view_config : null;

  // 보고서인 경우 원본 테이블의 설정도 확인하여 상속
  const isReportId = id.startsWith('rep-') || /^\d+$/.test(id);
  if (isReportId && !savedConfig) {
    try {
      const { queryTable } = await import('@/egdesk-helpers');
      const filter = /^\d+$/.test(id) ? { id: String(id) } : { reportId: id };
      const reports = await queryTable('dashboard_master', { filters: filter, limit: 1 });
      const sourceTableName = reports[0]?.tableName;
      if (sourceTableName) {
        const sourceSettingsRes = await getSourceViewSettingsAction(sourceTableName);
        if (sourceSettingsRes.success && sourceSettingsRes.data) {
          savedConfig = sourceSettingsRes.data.view_config;
        }
      }
    } catch (err) {}
  }

  let report: any;
  let rows: any[] = [];
  let columns: any[] = [];

  if (id === 'test-report-id') {
    // 테스트용 목업
    report = { id: 'test-report-id', name: 'Test Database', sheetName: 'Main', columns: '[]', ownerId: 'system' };
  } else if (id.startsWith('hometax_') || id === 'bank_transactions' || id === 'card_approvals' || id.includes('_transactions') || id.includes('_ebill_') || id.includes('_notes') || id.includes('_receivables') || id.includes('_executions') || id.includes('_endorsements') || id.includes('_history')) {
    // 금융/홈택스 특수 뷰
    const { 
        queryTaxInvoices,
        queryTaxExemptInvoices,
        queryCashReceipts,
        listBankProductTables,
        queryBankProductTable
    } = await import('@/egdesk-helpers');

    let allFetched: any[] = [];
    const limit = 1000;
    let offset = 0;
    let reportName = id; // 기본값은 ID
    
    // [개선] 모든 계좌를 순회하며 데이터를 누락 없이 수집
    if (id === 'bank_transactions' || id === 'card_approvals') {
        const { listAccounts } = await import('@/egdesk-helpers');
        const accounts = await listAccounts();
        const rawAccounts = Array.isArray(accounts) ? accounts : (accounts?.accounts || []);
        // 수동 업로드 계좌 (MANUALIMPORT)는 실제 financehub DB 계좌가 아니므로 제외
        const safeAccounts = rawAccounts.filter((acc: any) => {
            const rawAccNum = String(acc.accountNumber || acc.cardNumber || '').toUpperCase();
            return !rawAccNum.includes('MANUALIMPORT');
        });
        const transactionMap = new Map();
        
        for (const acc of safeAccounts) {
            // 계좌 유형 판별 (credit 타입이거나 bankId에 card가 포함된 경우 카드로 간주)
            const isCardAccount = acc.accountType === 'credit' || (acc.bankId && acc.bankId.toLowerCase().includes('card'));
            
            if (id === 'bank_transactions' && isCardAccount) continue;
            if (id === 'card_approvals' && !isCardAccount) continue;

            let accOffset = 0;
            const targetId = acc.id || acc.accountId;
            
            while (true) {
                let batchData: any = null;
                if (id === 'bank_transactions') {
                    batchData = await queryBankTransactions({ accountId: targetId, limit, offset: accOffset });
                } else {
                    batchData = await queryCardTransactions({ accountId: targetId, limit, offset: accOffset });
                }
                
                const rawBatch = Array.isArray(batchData) ? batchData : (batchData?.rows || batchData?.transactions || []);
                if (rawBatch.length === 0) break;
                
                // 계좌 정보 보강 및 중복 제거 (삭제된 데이터 제외)
                for (const d of rawBatch) {
                    if (String(d.__is_deleted) === '1') continue;
                    
                    if (!transactionMap.has(d.id)) {
                        // 유효한 이름을 찾기 위한 헬퍼 (0이나 숫자는 제외)
                        const getValidName = (...args: any[]) => {
                            for (const arg of args) {
                                if (arg && typeof arg === 'string' && arg !== '0') return arg;
                            }
                            return null;
                        };

                        const bName = getValidName(acc.bankName, acc.cardCompanyId, acc.bankId, d.bankName, d.cardName) || '-';
                        const accNo = acc.accountNumber || acc.cardNumber || d.accountNumber || d.cardNumber;
                        const aName = getValidName(acc.accountName, acc.productName, acc.name, acc.cardName) || '일반계좌/카드';
                        const bId = getValidName(acc.bankId, acc.cardCompanyId, d.bankId, d.cardCompanyId) || '-';
                        
                        // 공통 필드
                        const mappedData: any = {
                            ...d,
                            bankId: bId,
                            bankid: bId,
                            BANKID: bId,
                            accountId: targetId,
                            // 대소문자 호환성을 위해 여러 버전으로 매핑
                            accountName: aName,
                            accountname: aName,
                            ACCOUNTNAME: aName
                        };

                        // 테이블 타입에 따라 필드 분리 매핑 (중복 방지 및 대소문자 대응)
                        if (id === 'bank_transactions') {
                            mappedData.bankName = bName;
                            mappedData.bankname = bName;
                            mappedData.BANKNAME = bName;
                            mappedData.accountNumber = accNo;
                            mappedData.accountnumber = accNo;
                            mappedData.ACCOUNTNUMBER = accNo;
                        } else {
                            mappedData.cardName = bName;
                            mappedData.cardname = bName;
                            mappedData.CARDNAME = bName;
                            mappedData.cardNumber = accNo;
                            mappedData.cardnumber = accNo;
                            mappedData.CARDNUMBER = accNo;
                        }

                        transactionMap.set(d.id, mappedData);
                    }
                }
                if (rawBatch.length < limit) break;
                accOffset += limit;
            }
        }
        allFetched = Array.from(transactionMap.values());
        reportName = id === 'bank_transactions' ? '은행거래내역' : '신용카드 거래 내역';
    } else {
        // 기존 루프 방식 (홈택스 등 기타 데이터)
        while (true) {
            let batchData: any = null;
            if (id.includes('_tax_invoices')) batchData = await queryTaxInvoices({ invoiceType: id.includes('sales') ? 'sales' : 'purchase', limit, offset });
            else if (id.includes('_exempt_invoices')) batchData = await queryTaxExemptInvoices({ invoiceType: id.includes('sales') ? 'sales' : 'purchase', limit, offset });
            else if (id.includes('cash_receipts')) batchData = await queryCashReceipts({ type: id.includes('sales') ? 'sales' : 'purchase', limit, offset });
            else {
                const productTables = await listBankProductTables();
                const safeTables = Array.isArray(productTables) ? productTables : (productTables?.tables || []);
                const targetTable = safeTables.find((t: any) => t.slug === id);
                
                if (targetTable) {
                    reportName = targetTable.displayName || id;
                    let prodOffset = 0;
                    while (true) {
                        const batchData = await queryBankProductTable({ tableSlug: targetTable.slug, limit, offset: prodOffset });
                        const rawBatch = Array.isArray(batchData) ? batchData : (batchData?.rows || []);
                        const filteredBatch = rawBatch.filter((d: any) => String(d.__is_deleted) !== '1');
                        allFetched.push(...filteredBatch);
                        if (rawBatch.length < limit) break;
                        prodOffset += limit;
                    }
                }
            }

            if (!batchData) break; // 루프 종료 조건 추가

            const rawBatch = Array.isArray(batchData) ? batchData : (batchData?.rows || batchData?.transactions || batchData?.invoices || batchData?.receipts || batchData?.notes || []);
            if (rawBatch.length === 0) break;
            const filteredBatch = rawBatch.filter((d: any) => String(d.__is_deleted) !== '1');
            allFetched.push(...filteredBatch);
            if (rawBatch.length < limit) break;
            offset += limit;
        }
    }

    // [개선] 데이터 기반 스키마 생성 및 중복 제거 (대소문자 무시)
    const allKeys = new Set<string>();
    allFetched.forEach(item => {
        Object.keys(item).forEach(key => {
            if (!key.startsWith('_')) allKeys.add(key); // 시스템 내부 필드 제외
        });
    });

    const pKeys = Array.from(allKeys);
    const uniqueColumnMap = new Map<string, any>();
    
    pKeys.forEach(k => {
        const lowerK = k.toLowerCase();
        if (uniqueColumnMap.has(lowerK)) return; // 이미 동일한 이름(대소문자 무시)의 컬럼이 있으면 패스

        // 이름, 번호, ID 관련 필드는 무조건 TEXT 타입으로 강제 (숫자 변환 방지)
        const isTextField = 
            lowerK.includes('name') || 
            lowerK.includes('number') || 
            lowerK.includes('id') || 
            lowerK.includes('merchant') || 
            lowerK.includes('description');
        uniqueColumnMap.set(lowerK, { 
            name: k, 
            type: isTextField ? 'TEXT' : inferColumnType(k) 
        });
    });

    columns = Array.from(uniqueColumnMap.values());

    // [개선] 데이터가 0건일 때도 최소한의 스키마(헤더)를 보장
    if (columns.length === 0 && id.startsWith('hometax_')) {
        const hometaxDefaultFields = [
            '작성일자', '공급자상호', '공급받는자상호', '합계금액', '공급가액', '세액', '승인번호', '비고'
        ];
        columns = hometaxDefaultFields.map(f => ({ name: f, type: inferColumnType(f) }));
    } else if (columns.length === 0 && (id === 'bank_transactions' || id === 'card_approvals')) {
        const financeDefaultFields = id === 'bank_transactions' 
            ? ['date', 'bankName', 'accountNumber', 'description', 'withdrawal', 'deposit', 'balance']
            : ['date', 'cardName', 'cardNumber', 'merchantName', 'amount', 'category'];
        columns = financeDefaultFields.map(f => ({ name: f, type: inferColumnType(f) }));
    }

    report = { id, name: reportName, sheetName: reportName, columns: JSON.stringify(columns), ownerId: 'system', isReadOnly: true };
    rows = allFetched.map(d => ({ ...d, isDeleted: false }));
  } else {
    const { getTableByName } = await import('@/egdesk.config');
    const systemTableDef = getTableByName(id);

    if (systemTableDef) {
      // 시스템 테이블 (user, department 등)
      report = { id: systemTableDef.name, name: systemTableDef.displayName, columns: JSON.stringify(systemTableDef.columns.map(c => ({ name: c, type: inferColumnType(c) }))), ownerId: 'system' };
      const rowsDataRaw = await queryTable(systemTableDef.name, { limit: 1000 });
      const rowsData = Array.isArray(rowsDataRaw) ? rowsDataRaw : (rowsDataRaw?.rows || []);
      rows = rowsData.map((r: any) => ({ 
          ...r, 
          isDeleted: r.__is_deleted === 1 || r.isDeleted === 1 
      }));
      columns = JSON.parse(report.columns);
    } else {
      // 일반 사용자 보고서 또는 물리 테이블
      const filter = /^\d+$/.test(id) ? { id: String(id) } : { reportId: id };
      const reportsRaw = await queryTable('dashboard_master', { filters: filter });
      const reports = Array.isArray(reportsRaw) ? reportsRaw : (reportsRaw?.rows || []);
      report = reports[0];

      if (!report) {
        // 순수 물리 테이블 직접 접근
        const rawPhysicalSchema = await getTableSchema(id).catch(() => []);
        if (rawPhysicalSchema.length > 0) {
            columns = rawPhysicalSchema.map(ps => ({ name: ps.name, type: inferColumnType(ps.name) }));
            report = { id, name: id, columns: JSON.stringify(columns), ownerId: 'system' };
            const rowsDataRaw = await queryTable(id, { limit: 1000 });
            const rowsData = Array.isArray(rowsDataRaw) ? rowsDataRaw : (rowsDataRaw?.rows || []);
            rows = rowsData.map((r: any) => ({ 
                ...r, 
                isDeleted: r.__is_deleted === 1 || r.isDeleted === 1 
            }));
        } else {
            return <div className="p-20 text-center text-gray-500 font-bold">보고서를 찾을 수 없습니다.</div>;
        }
      } else {
        // 보고서 메타데이터 기반 조회
        const columnsData = JSON.parse(report.columns || '[]');
        columns = columnsData;
        const effectiveTableName = report.tableName || (id.startsWith('rep-') ? id.replace('rep-', '') : null);

        if (effectiveTableName) {
            try {
                const rowsDataRaw = await queryTable(effectiveTableName, { limit: 1000 });
                const rowsData = Array.isArray(rowsDataRaw) ? rowsDataRaw : (rowsDataRaw?.rows || []);
                const virtualRowsRaw = await queryTable('dashboard_data', { filters: { reportId: id }, limit: 10000 });
                const virtualRows = Array.isArray(virtualRowsRaw) ? virtualRowsRaw : (virtualRowsRaw?.rows || []);
                
                const idColDef = columnsData.find((c: any) => c.isAutoGenerated || c.name === '데이터ID');
                const idColName = idColDef ? idColDef.name : null;
                const usedVirtualIds = new Set();

                rows = rowsData.map((r: any, idx: number) => {
                    const isDeleted = String(r.__is_deleted) === '1' || Number(r.__is_deleted) === 1 || String(r.isDeleted) === '1' || Number(r.isDeleted) === 1;
                    let vr = virtualRows.find((v: any) => {
                        try {
                            const d = JSON.parse(v.data);
                            return (idColName && d[idColName] && r[idColName] && String(d[idColName]) === String(r[idColName]));
                        } catch(e) { return false; }
                    });

                    let finalIsDeleted = isDeleted;
                    if (vr) {
                        usedVirtualIds.add(vr.id);
                        if (String(vr.__is_deleted) === '1' || Number(vr.__is_deleted) === 1 || String(vr.isDeleted) === '1' || Number(vr.isDeleted) === 1) {
                            finalIsDeleted = true;
                        }
                    }

                    return { ...r, id: vr ? vr.id : r.id, isDeleted: finalIsDeleted };
                });

                // 가상 테이블에만 남아있는 삭제된 행 추가
                virtualRows.forEach((v: any) => {
                    if (!usedVirtualIds.has(v.id)) {
                        const isDeleted = String(v.__is_deleted) === '1' || Number(v.__is_deleted) === 1 || String(v.isDeleted) === '1' || Number(v.isDeleted) === 1;
                        if (isDeleted) {
                            try {
                                rows.push({ ...JSON.parse(v.data), isDeleted: true });
                            } catch(e) {}
                        }
                    }
                });
            } catch (err) {
                const rowsDataRaw = await queryTable('dashboard_data', { filters: { reportId: id }, limit: 1000 });
                const rowsData = Array.isArray(rowsDataRaw) ? rowsDataRaw : (rowsDataRaw?.rows || []);
                rows = rowsData.map((r: any) => ({
                    ...JSON.parse(r.data),
                    isDeleted: String(r.__is_deleted) === '1' || Number(r.__is_deleted) === 1 || String(r.isDeleted) === '1' || Number(r.isDeleted) === 1
                }));
            }
        } else {
            const rowsDataRaw = await queryTable('dashboard_data', { filters: { reportId: id }, limit: 1000 });
            const rowsData = Array.isArray(rowsDataRaw) ? rowsDataRaw : (rowsDataRaw?.rows || []);
            rows = rowsData.map((r: any) => ({
                ...JSON.parse(r.data),
                isDeleted: String(r.__is_deleted) === '1' || Number(r.__is_deleted) === 1 || String(r.isDeleted) === '1' || Number(r.isDeleted) === 1
            }));
        }
      }
    }
  }

  // 뷰 설정 적용 (정렬 및 컬럼 순서)
  if (savedConfig && savedConfig.columns && columns.length > 0) {
      const configuredCols = savedConfig.columns;
      const mergedColumns = configuredCols
        .filter((cc: any) => cc.visible !== false)
        .map((cc: any) => {
            const originalCol = columns.find(c => (c.id || c.name) === cc.name);
            return { ...(originalCol || {}), displayName: cc.displayName || originalCol?.displayName || cc.name };
        }).filter((c: any) => c.name);
      columns = mergedColumns;
  }

  const isOwner = report.ownerId === user?.id || report.ownerId === 'system';
  const isAdmin = user?.role === 'ADMIN';

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
        canEdit={(isOwner || isAdmin || user?.role === 'EDITOR') && !report.isReadOnly}
        multiSortConfig={savedConfig?.multiSortConfig}
      />
    </div>
  );
}
