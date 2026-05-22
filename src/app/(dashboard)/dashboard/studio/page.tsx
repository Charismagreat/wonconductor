import React from 'react';
import { getSessionAction } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { 
  queryTable, 
  aggregateTable, 
  listTables, 
  getOverallStats, 
  listHometaxConnections 
} from '@/egdesk-helpers';
import { DashboardClient } from '../DashboardClient';
import { Compass } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default async function DataAnalysisStudioPage() {
  const user = await getSessionAction();
  if (!user) {
    redirect('/login');
  }

  // 1. 데이터 가져오기
  const allResults = await Promise.all([
    listTables().catch(() => ({ tables: [] })),
    getOverallStats().catch(() => null),
    listHometaxConnections().catch(() => null),
    queryTable('dashboard_master', { limit: 1000, orderBy: 'createdAt', orderDirection: 'DESC' }).catch(() => []),
    (async () => {
      const { listBankProductTables } = await import('@/egdesk-helpers');
      const res = await listBankProductTables();
      return Array.isArray(res) ? res : (res?.tables || []);
    })().catch(() => [])
  ]);

  const tablesRes = allResults[0] as any;
  const statsRes = allResults[1] as any;
  const hometaxRes = allResults[2] as any;
  const rawAllReports = allResults[3] as any;
  const rawBankProductTables = (allResults[4] as any[]) || [];

  const systemTables = tablesRes?.tables || [];
  const isAdminOrEditor = user.role === 'ADMIN' || user.role === 'EDITOR';

  // 2. 리포트 목록 구성
  const safeReports = Array.isArray(rawAllReports) ? rawAllReports : [];
  let allReports = safeReports.filter((r: any) => String(r.isDeleted) === '0');

  // 가상 보고서(dashboard_data) 행 개수 일괄 조회 (N+1 병목 극복!)
  const virtualCountsMap: Record<string, number> = {};
  try {
    const { executeSQL } = await import('@/egdesk-helpers');
    const rawCounts = await executeSQL(
      `SELECT reportId, COUNT(*) as cnt FROM dashboard_data WHERE isDeleted = '0' GROUP BY reportId`
    ).catch(() => []);
    
    const countRows = Array.isArray(rawCounts) ? rawCounts : (rawCounts?.rows || []);
    countRows.forEach((row: any) => {
      if (row && row.reportId) {
        virtualCountsMap[row.reportId] = Number(row.cnt || row.COUNT || 0);
      }
    });
  } catch (err) {
    console.error('Failed to batch query studio virtual report row counts:', err);
  }

  const getReportRowCount = (r: any) => {
    const rId = r.reportId || String(r.id);
    
    if (!r.tableName) {
      return virtualCountsMap[rId] || 0;
    }

    const tName = r.tableName.toLowerCase();

    // 1. FinanceHub 은행거래내역 및 신용카드 거래 내역 개수 유추
    if (tName === 'bank_transactions') {
      return statsRes?.totalTransactions || 0;
    }
    if (tName === 'card_approvals') {
      return statsRes?.totalTransactions ? Math.round(statsRes.totalTransactions * 0.4) : 0; 
    }

    // 2. 홈택스 데이터 개수 유추 (캐싱된 통계 값 직접 활용)
    if (tName.startsWith('hometax_')) {
      const hometaxConnection = hometaxRes?.connections?.[0] || {};
      const fieldMap: Record<string, string> = {
        'hometax_sales_invoices': 'sales_count',
        'hometax_sales_tax_invoices': 'sales_count',
        'hometax_purchase_invoices': 'purchase_count',
        'hometax_purchase_tax_invoices': 'purchase_count',
        'hometax_cash_receipts': 'cash_receipt_count'
      };
      const countField = fieldMap[tName] || '';
      return Number(hometaxConnection[countField] || 0);
    }

    // 3. 개별 금융 상품 테이블 동적 매핑
    const pTable = rawBankProductTables.find((pt: any) => pt.slug === r.tableName);
    if (pTable) {
      return Number(pTable.rowCount || 0);
    }

    // 4. 일반 물리 시스템 테이블 매핑
    const sysTable = systemTables.find((t: any) => t.tableName?.toLowerCase() === tName);
    if (sysTable) {
      return Number(sysTable.rowCount || 0);
    }

    return 0;
  };

  const processedReports = allReports.map((r: any) => {
    const rowCount = getReportRowCount(r);
    return {
      ...r,
      name: r.displayName || r.name,
      _count: { rows: rowCount },
      isVirtualReport: !r.tableName,
      physicalTableName: r.tableName // 물리 테이블 소스 추가
    };
  });

  // 3. 물리 시스템 테이블 통합
  let finalTables = [...processedReports];
  if (isAdminOrEditor) {
    const existingTableNames = new Set(processedReports.map(r => r.tableName?.toLowerCase()).filter(Boolean));
    const sysTables = systemTables
      .filter((t: any) => t.tableName && !existingTableNames.has(t.tableName.toLowerCase()))
      .map((t: any) => ({
        id: t.tableName,
        tableName: t.tableName,
        physicalTableName: t.tableName, // 물리 테이블 소스 추가
        name: t.displayName || t.tableName,
        _count: { rows: t.rowCount || 0 },
        isSystemTable: true,
        isReadOnly: t.tableName !== 'user'
      }));
    const bankProductTablesMapped = rawBankProductTables.map((t: any) => ({
      id: t.slug,
      tableName: t.slug,
      physicalTableName: t.slug,
      name: t.displayName || t.slug,
      _count: { rows: t.rowCount || 0 },
      isSystemTable: true,
      isReadOnly: true,
      isBankProduct: true // 금융 상품 테이블임을 표시
    }));
    finalTables = [...finalTables, ...sysTables, ...bankProductTablesMapped];
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="max-w-[1600px] mx-auto px-8 md:px-12 pt-6 pb-12 space-y-6">
        <DashboardClient 
          allTables={finalTables}
          user={user}
        />
      </main>
    </div>
  );
}
