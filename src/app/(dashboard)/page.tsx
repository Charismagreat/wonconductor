import React from 'react';
import { getSessionAction } from '@/app/actions/auth';
import { DeleteReportButton } from '@/components/DeleteReportButton';
import Link from 'next/link';
import { 
  FileSpreadsheet, 
  LayoutDashboard, 
  User, 
  Trash2, 
  ExternalLink, 
  Plus, 
  ShieldCheck, 
  Wallet, 
  Database,
  BarChart3,
  Sparkles,
  ArrowRight,
  Star,
  Compass
} from 'lucide-react';
import { NewTableSection } from '@/components/NewTableSection';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import { queryTable, aggregateTable, listTables, getOverallStats, listHometaxConnections } from '@/egdesk-helpers';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import PageHeader from '@/components/PageHeader';
import { DashboardHubClient } from './DashboardHubClient';
import { getCalendarEvents } from '@/lib/services/calendar-service';

export default async function DashboardPage() {
  // 시스템 초기화 여부 체크 (신규 설치 시 /setup으로 유도)
  const { SystemConfigService } = await import('@/lib/services/system-config-service');
  const isSetupRequired = await SystemConfigService.isSystemSetupRequired();
  if (isSetupRequired) {
    redirect('/setup');
  }

  // 실제 세션 사용자 정보 가져오기
  const user = await getSessionAction();

  if (!user) {
    redirect('/login');
  }

  let systemTables: any[] = [];
  let financeStats: any = null;
  let hometaxStats: any = null;

  try {
    const [tablesRes, statsRes, hometaxRes] = await Promise.all([
      listTables(),
      getOverallStats().catch(() => null),
      listHometaxConnections().catch(() => null)
    ]);
    systemTables = tablesRes?.tables || [];
    financeStats = statsRes;
    hometaxStats = hometaxRes;
  } catch (err) {
    console.error('Failed to fetch system data:', err);
  }

  // 개별 금융 상품 테이블 목록 수집 (나중에 reports에 추가)
  let productTables: any[] = [];
  try {
    const { listBankProductTables } = await import('@/egdesk-helpers');
    const productTablesRes = await listBankProductTables().catch(() => ({ tables: [] }));
    productTables = Array.isArray(productTablesRes) ? productTablesRes : (productTablesRes?.tables || []);
  } catch (err) {}

  // 2. 권한에 따른 보고서 필터링 (가상 테이블)
  const rawAllReports = await queryTable('dashboard_master', {
    limit: 1000,
    orderBy: 'createdAt',
    orderDirection: 'DESC'
  }).catch(() => []);
  
  // 배열 여부 확인 후 안전하게 필터링
  const reportsArray = Array.isArray(rawAllReports) ? rawAllReports : (rawAllReports?.rows || []);
  let allReports = reportsArray.filter((r: any) => String(r.isDeleted) === '0');

  // VIEWER 필터링: 기본 허용이며, 명시적으로 차단(isBlocked: 1)된 보고서만 제외
  if (user.role === 'VIEWER') {
    const accessListRaw = await queryTable('dashboard_access', { 
        filters: { userId: String(user.id), isBlocked: 1 } 
    });
    const accessList = Array.isArray(accessListRaw) ? accessListRaw : (accessListRaw as any)?.rows ?? [];
    const blockedIds = new Set(accessList.map((a: any) => a.reportId));
    
    allReports = allReports.filter((r: any) => {
        // 본인 소유는 항상 허용
        if (r.ownerId === user.id) return true;
        // 차단된 목록에 있으면 제외
        return !blockedIds.has(r.reportId);
    });
  }

  // [통합 로직] 보고서별 데이터 행 개수 계산 함수
  const getReportRowCount = async (r: any) => {
    // 1. FinanceHub 및 홈택스 (물리 테이블 직접 집계)
    if (r.tableName) {
      try {
        const aggr = await aggregateTable(r.tableName, 'id', 'COUNT');
        return Number(aggr?.value ?? aggr) || 0;
      } catch (err) {
        return 0;
      }
    }

    // 2. 홈택스 데이터 (API 통계와 DB 집계 중 최대값 선택)
    if (r.tableName?.startsWith('hometax_')) {
      const hometaxConnection = hometaxStats?.connections?.[0] || {};
      const fieldMap: Record<string, string> = {
        'hometax_sales_invoices': 'sales_count',
        'hometax_purchase_invoices': 'purchase_count',
        'hometax_cash_receipts': 'cash_receipt_count'
      };
      const apiCount = hometaxConnection[fieldMap[r.tableName] || ''] || 0;
      let dbCount = 0;
      try {
        const aggr = await aggregateTable(r.tableName, 'id', 'COUNT');
        dbCount = Number(aggr?.value ?? aggr) || 0;
      } catch (err) {}
      return Math.max(apiCount, dbCount);
    }

    // 3. 테스트 데이터 예외 처리
    if (r.id === 'test-report-id') return 133;

    // 4. 일반 물리 테이블 직접 집계 (Templates 등)
    if (r.tableName) {
      try {
        const aggr = await aggregateTable(r.tableName, 'id', 'COUNT');
        return Number(aggr?.value ?? aggr) || 0;
      } catch (err) {
        return 0;
      }
    }

    // 5. 순수 가상 보고서 (dashboard_data 기반)
    try {
      const aggr = await aggregateTable('dashboard_data', 'id', 'COUNT', {
        filters: { reportId: r.reportId || String(r.id), isDeleted: '0' }
      });
      return Number(aggr?.value ?? aggr) || 0;
    } catch (err) {
      return 0;
    }
  };

  // 모든 가상 리포트에 통합 로직 적용
  let virtualReports = await Promise.all(allReports.map(async (r: any) => {
    const count = await getReportRowCount(r);
    return {
      ...r,
      id: r.reportId || String(r.id), // UI 식별자로 reportId 우선 사용
      physicalId: r.id, // 실제 DB 정수 ID 보존
      _count: { rows: count },
      isVirtualReport: true,
      isDirectTable: r.id === 'test-report-id'
    };
  }));

  // 관리자/에디터 권한 판별
  const isAdminOrEditor = user.role === 'ADMIN' || user.role === 'EDITOR';
  let reports: any[] = [];

  // 상단 FinanceHub 카드 구성 (통합 로직의 결과를 동일하게 참조)
  if (isAdminOrEditor) {
    const getCountById = (id: string) => virtualReports.find(v => v.id === id)?._count?.rows || 0;

    reports.push({
      id: 'card_approvals',
      name: '신용카드 거래 내역',
      tableName: 'card_approvals',
      _count: { rows: getCountById('card_approvals') },
      isFinanceTable: true,
      isSystemTable: true,
      isReadOnly: true,
      category: 'Finance'
    });
    reports.push({
      id: 'bank_transactions',
      name: '은행거래내역',
      tableName: 'bank_transactions',
      _count: { rows: getCountById('bank_transactions') },
      isFinanceTable: true,
      isSystemTable: true,
      isReadOnly: true,
      category: 'Finance'
    });
    reports.push({
      id: 'hometax_sales_tax_invoices',
      name: '매출세금계산서',
      tableName: 'hometax_sales_tax_invoices',
      _count: { rows: getCountById('hometax_sales_tax_invoices') },
      isFinanceTable: true,
      isSystemTable: true,
      isReadOnly: true,
      category: 'Finance'
    });
    reports.push({
      id: 'hometax_sales_invoices',
      name: '매출계산서',
      tableName: 'hometax_sales_invoices',
      _count: { rows: getCountById('hometax_sales_invoices') },
      isFinanceTable: true,
      isSystemTable: true,
      isReadOnly: true,
      category: 'Finance'
    });
    reports.push({
      id: 'hometax_purchase_tax_invoices',
      name: '매입세금계산서',
      tableName: 'hometax_purchase_tax_invoices',
      _count: { rows: getCountById('hometax_purchase_tax_invoices') },
      isFinanceTable: true,
      isSystemTable: true,
      isReadOnly: true,
      category: 'Finance'
    });
    reports.push({
      id: 'hometax_purchase_invoices',
      name: '매입계산서',
      tableName: 'hometax_purchase_invoices',
      _count: { rows: getCountById('hometax_purchase_invoices') },
      isFinanceTable: true,
      isSystemTable: true,
      isReadOnly: true,
      category: 'Finance'
    });
    reports.push({
      id: 'hometax_cash_receipts',
      name: '현금영수증 내역',
      tableName: 'hometax_cash_receipts',
      _count: { rows: getCountById('hometax_cash_receipts') },
      isFinanceTable: true,
      isSystemTable: true,
      isReadOnly: true,
      category: 'Finance'
    });
    // 개별 금융 상품 테이블 동적 추가
    productTables.forEach((t: any) => {
      reports.push({
        id: t.slug,
        name: t.displayName || t.slug,
        tableName: t.slug,
        _count: { rows: t.rowCount || 0 },
        isFinanceTable: true,
        isSystemTable: true,
        isReadOnly: true,
        category: 'Finance'
      });
    });
    
    // 구형 전자어음 메뉴는 개별 상품 테이블 노출로 대체됨
  }

  // 1. 물리적 시스템 테이블 목록 가져오기 및 2. 가상 리포트 필터링 로직이 위쪽에 있습니다.
  // ... 생략 ...

  // 삭제된 리포트를 포함하여 모든 가상 리포트와 연결된 물리 테이블 이름 수집
  const mappedTableNames = new Set(reportsArray.map((r: any) => r.tableName?.toLowerCase()).filter(Boolean));

  // 시스템 물리 테이블 통합 (어드민/에디터만)
  if (isAdminOrEditor) {
    const mappedSystemTables = systemTables
      .filter((t: any) => !mappedTableNames.has(t.tableName?.toLowerCase())) // 이미 가상 보고서와 연결된 물리 테이블은 중복 방지를 위해 제외
      .map((t: any) => {
        const tName = t.displayName || t.tableName;
        // '마스터' 혹은 'master'라는 이름이 들어간 물리 테이블은 시스템 제약에서 해제하여 일반 테이블처럼 취급
        const isMaster = tName?.includes('마스터') || t.tableName?.toLowerCase().includes('master');
        
        return {
          id: t.tableName,
          tableName: t.tableName, // 카드 UI에서 표시할 ID 필드 추가
          name: tName,
          sheetName: isMaster ? 'Master Data' : 'System Table',
          _count: { rows: t.rowCount !== null && t.rowCount !== undefined ? t.rowCount : 'N/A' },
          isSystemTable: !isMaster,
          ownerId: 'system',
          isReadOnly: isMaster ? false : (t.tableName === 'user' ? false : true),
          category: isMaster ? '일반 테이블' : 'System'
        };
      });
    reports = [...reports, ...mappedSystemTables];
  }

  // 가상 리포트 병합
  reports = [...reports, ...virtualReports];

  // 중복 ID 제거 및 속성 병합 (하드코딩된 보고서와 DB 보고서 간의 충돌 방지)
  const reportsMap = new Map();
  reports.forEach(r => {
    const key = r.id; // 이미 위에서 reportId로 통일됨
    if (reportsMap.has(key)) {
      // 병합: 하드코딩된 속성(isFinanceTable 등)과 DB 데이터(count, ownerId 등)를 합침
      reportsMap.set(key, { ...reportsMap.get(key), ...r });
    } else {
      reportsMap.set(key, r);
    }
  });
  const uniqueReports = Array.from(reportsMap.values()) as any[];

  const isStaff = user.role === 'VIEWER';

  // 3. 캘린더 일정 데이터 가져오기
  const events = await getCalendarEvents({
    userRole: user.role
  });

  return (
    <DashboardHubClient 
      user={user} 
      isStaff={isStaff} 
      reports={uniqueReports} 
      events={events}
      financeStats={financeStats}
      hometaxStats={hometaxStats}
    />
  );
}

