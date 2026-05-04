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
  const [tablesRes, statsRes, hometaxRes, rawAllReports] = await Promise.all([
    listTables().catch(() => ({ tables: [] })),
    getOverallStats().catch(() => null),
    listHometaxConnections().catch(() => null),
    queryTable('dashboard_master', { limit: 1000, orderBy: 'createdAt', orderDirection: 'DESC' }).catch(() => [])
  ]);

  const systemTables = tablesRes?.tables || [];
  const isAdminOrEditor = user.role === 'ADMIN' || user.role === 'EDITOR';

  // 2. 리포트 목록 구성
  let allReports = rawAllReports.filter((r: any) => String(r.isDeleted) === '0');
  
  const processedReports = await Promise.all(allReports.map(async (r: any) => {
    let rowCount = 0;
    try {
      const aggr = await aggregateTable(r.tableName || 'dashboard_data', 'id', 'COUNT', 
        r.tableName ? {} : { filters: { reportId: String(r.id), isDeleted: '0' } }
      );
      rowCount = Number(aggr?.value ?? aggr) || 0;
    } catch (e) {}
    
    return {
      ...r,
      name: r.displayName || r.name,
      _count: { rows: rowCount },
      isVirtualReport: !r.tableName,
      physicalTableName: r.tableName // 물리 테이블 소스 추가
    };
  }));

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
    finalTables = [...finalTables, ...sysTables];
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
