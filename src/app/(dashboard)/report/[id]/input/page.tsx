import React from 'react';
import { getSessionAction } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { DataInputClient } from '@/components/DataInputClient';
import { ShieldAlert, Home } from 'lucide-react';
import Link from 'next/link';
import { queryTable } from '@/egdesk-helpers';
import { getMasterRecords } from '@/app/actions/report';

export default async function DataInputPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionAction();

  if (!session) {
    redirect('/login');
  }

  // 1단계: 보고서 정보 로드 (가상 및 물리 테이블 통합 대응)
  const masterRecords = await getMasterRecords(id);
  const report = masterRecords[0];

  if (!report) {
    redirect('/');
  }

  // 권한 체크: 기본 허용 정책 적용
  const accessListRaw = await queryTable('dashboard_access', {
    filters: { reportId: id, userId: String(session.id), isBlocked: 1 }
  });
  const accessList = Array.isArray(accessListRaw) ? accessListRaw : (accessListRaw as any)?.rows ?? [];
  const isBlocked = accessList.length > 0;

  // 권한 체크: ADMIN, EDITOR, 소유자(Owner) 또는 차단되지 않은 모든 사용자
  const isManagement =
    session.role === 'ADMIN' ||
    session.role === 'EDITOR' ||
    report.ownerId === session.id;

  const isAuthorized = isManagement || !isBlocked;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-12 rounded-[40px] shadow-2xl shadow-gray-200 border border-gray-100 max-w-lg w-full">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <ShieldAlert size={40} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight uppercase tracking-widest">Access Denied</h1>
          <p className="text-gray-500 mb-10 leading-relaxed font-medium">
            해당 테이블에 대한 접근 권한이 없습니다.<br />
            관리자에게 권한 부여를 요청해 주세요.
          </p>
        </div>
      </div>
    );
  }

  // 2단계: 데이터 로드 (가상 테이블 또는 물리 테이블 직접 조회)
  const isVirtual = !report.isPhysicalOnly;
  let rowsData = [];

  if (isVirtual) {
    rowsData = await queryTable('dashboard_data', {
      filters: {
        reportId: String(id),
        ...(isManagement ? {} : { creatorId: String(session.id) }),
        isDeleted: '0'
      },
      orderBy: 'updatedAt',
      orderDirection: 'DESC'
    });
  } else {
    // 물리 테이블 직접 조회 (시스템 컬럼이 있는 경우 필터링 적용 시도)
    const tableFilters: any = {};
    if (!isManagement) {
      // 시스템 컬럼(__creator_id)이 있는지 확인 후 필터링
      tableFilters.__creator_id = String(session.id);
    }
    
    try {
      rowsData = await queryTable(report.tableName, {
        filters: tableFilters,
        limit: 100,
        orderBy: 'id', // 물리 테이블은 보통 id 기준
        orderDirection: 'DESC'
      });
    } catch (e) {
      // 필터 오류(컬럼 없음 등) 시 필터 없이 재시도
      rowsData = await queryTable(report.tableName, { limit: 100 });
    }
  }

  const columns = JSON.parse(report.columns);

  // 데이터 목록 파싱 (DataInputClient에서 조회/수정/삭제를 위해 필요)
  const rows = rowsData.map((r: any) => {
    if (isVirtual && r.data) {
      return {
        ...JSON.parse(r.data),
        id: r.id,
        creatorId: r.creatorId,
        updatedAt: r.updatedAt,
        isDeleted: r.isDeleted
      };
    } else {
      // 물리 테이블 데이터
      return {
        ...r,
        id: r.id || r.DID || r.projectId || r.appId, // 다양한 식별자 대응
        creatorId: r.__creator_id || 'system',
        updatedAt: r.__updated_at || r.createdAt || new Date().toISOString(),
        isDeleted: r.isDeleted || 0
      };
    }
  });

  return (
    <DataInputClient
      report={report}
      session={session}
      columns={columns}
      rows={rows}
    />
  );
}
