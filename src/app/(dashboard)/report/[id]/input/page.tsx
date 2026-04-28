import React from 'react';
import { getSessionAction } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { DataInputClient } from '@/components/DataInputClient';
import { ShieldAlert, Home } from 'lucide-react';
import Link from 'next/link';
import { queryTable } from '@/egdesk-helpers';

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

  // 1단계: 보고서 기본 정보 로드
  const filter = /^\d+$/.test(id) ? { id: Number(id) } : { reportId: id };
  const reports = await queryTable('dashboard_master', { filters: filter });
  const report = reports[0];

  if (!report) {
    redirect('/');
  }

  // 권한 체크를 위한 별도 조회 (Many-to-Many 대응)
  const accessList = await queryTable('dashboard_access', {
    filters: { reportId: id, userId: String(session.id) }
  });
  const hasExplicitAccess = accessList.length > 0;

  // 권한 체크: ADMIN, EDITOR, 소유자(Owner) 또는 명시적으로 허용된 사용자만 접근 가능
  const isManagement =
    session.role === 'ADMIN' ||
    session.role === 'EDITOR' ||
    report.ownerId === session.id;

  const isAuthorized = isManagement || hasExplicitAccess;

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

  // 2단계: 행 필터링 - 실무자(VIEWER)이고 소유자가 아닌 경우 본인이 작정한 행만 조회
  const rowsData = await queryTable('dashboard_data', {
    filters: {
      reportId: id,
      ...(isManagement ? {} : { creatorId: String(session.id) }),
      isDeleted: '0'
    },
    orderBy: 'updatedAt',
    orderDirection: 'DESC'
  });

  const columns = JSON.parse(report.columns);

  // 데이터 목록 파싱 (DataInputClient에서 조회/수정/삭제를 위해 필요)
  const rows = rowsData.map((r: any) => ({
    ...JSON.parse(r.data),
    id: r.id,
    creatorId: r.creatorId,
    updatedAt: r.updatedAt,
    isDeleted: r.isDeleted
  }));

  return (
    <DataInputClient
      report={report}
      session={session}
      columns={columns}
      rows={rows}
    />
  );
}
