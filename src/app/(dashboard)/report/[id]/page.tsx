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
  } else if (id.startsWith('hometax_') || id === 'bank_transactions' || id === 'card_approvals' || id.includes('_transactions') || id.includes('_ebill_') || id.includes('_notes') || id.includes('_receivables') || id.includes('_executions')) {
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
    if (id === 'bank_transactions') {
        const { listAccounts } = await import('@/egdesk-helpers');
        const accounts = await listAccounts();
        const safeAccounts = Array.isArray(accounts) ? accounts : (accounts?.accounts || []);
        const transactionMap = new Map();
        
        for (const acc of safeAccounts) {
            let accOffset = 0;
            const targetId = acc.id || acc.accountId;
            while (true) {
                const batchData = await queryBankTransactions({ accountId: targetId, limit, offset: accOffset });
                const rawBatch = Array.isArray(batchData) ? batchData : (batchData?.rows || batchData?.transactions || []);
                if (rawBatch.length === 0) break;
                
                // 계좌 정보 보강 및 중복 제거 (삭제된 데이터 제외)
                for (const d of rawBatch) {
                    if (String(d.__is_deleted) === '1') continue;
                    
                    if (!transactionMap.has(d.id)) {
                        transactionMap.set(d.id, {
                            ...d,
                            bankId: acc.bankId,
                            bankName: acc.bankName || acc._bankName,
                            accountId: targetId,
                            accountNumber: acc.accountNumber,
                            accountName: acc.accountName || acc.name
                        });
                    }
                }
                if (rawBatch.length < limit) break;
                accOffset += limit;
            }
        }
        allFetched = Array.from(transactionMap.values());
        reportName = '은행거래내역';
    } else {
        // 기존 루프 방식 (기타 금융 데이터)
        while (true) {
            let batchData: any = null;
            if (id.includes('tax')) batchData = await queryTaxInvoices({ invoiceType: id.includes('sales') ? 'sales' : 'purchase', limit, offset });
            else if (id.includes('invoice')) batchData = await queryTaxExemptInvoices({ invoiceType: id.includes('sales') ? 'sales' : 'purchase', limit, offset });
            else if (id === 'hometax_cash_receipts') batchData = await queryCashReceipts({ limit, offset });
            else if (id === 'card_approvals') batchData = await queryCardTransactions({ limit, offset });
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

            const rawBatch = Array.isArray(batchData) ? batchData : (batchData?.rows || batchData?.transactions || batchData?.invoices || batchData?.receipts || batchData?.notes || []);
            if (rawBatch.length === 0) break;
            const filteredBatch = rawBatch.filter((d: any) => String(d.__is_deleted) !== '1');
            allFetched.push(...filteredBatch);
            if (rawBatch.length < limit) break;
            offset += limit;
        }
    }

    // [개선] 데이터 기반 스키마 생성
    const allKeys = new Set<string>();
    
    allFetched.forEach(item => {
        Object.keys(item).forEach(key => {
            if (!key.startsWith('_')) allKeys.add(key); // 시스템 내부 필드 제외
        });
    });

    const pKeys = Array.from(allKeys);
    columns = pKeys.map(k => ({ 
        name: k, 
        type: inferColumnType(k) 
    }));
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
