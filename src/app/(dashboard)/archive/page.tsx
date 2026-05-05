import React from 'react';
import { queryTable, aggregateTable } from '@/egdesk-helpers';
import Link from 'next/link';
import { FileSpreadsheet, ArrowLeft, Archive } from 'lucide-react';
import { ArchiveActions } from '@/components/ArchiveActions';
import PageHeader from '@/components/PageHeader';

export default async function ArchivePage() {
  const rawAllDeletedReports = await queryTable('dashboard_master', {
    limit: 1000,
    orderBy: 'deletedAt',
    orderDirection: 'DESC'
  });
  
  // 루트 egdesk-helpers의 반환값(객체)을 배열로 변환하여 filter 호출 보장
  const reports = Array.isArray(rawAllDeletedReports) ? rawAllDeletedReports : (rawAllDeletedReports as any)?.rows || [];
  const allDeletedReports = reports.filter((r: any) => String(r.isDeleted) === '1');

  const deletedReports: any[] = [];
  for (const r of allDeletedReports) {
    try {
      const rowCountResult = await aggregateTable('dashboard_data', 'id', 'COUNT', { 
        filters: { reportId: r.reportId || String(r.id) } 
      });
      deletedReports.push({
        ...r,
        _count: { rows: Number(rowCountResult) || 0 }
      });
    } catch (err) {
      console.warn(`Failed to count rows for report ${r.id}:`, err);
      deletedReports.push({
        ...r,
        _count: { rows: 0 }
      });
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="max-w-[1600px] mx-auto px-8 md:px-12 pt-6 pb-12">
        <PageHeader 
          title="ARCHIVE"
          description="삭제된 테이블과 리포트들을 복구하거나 영구 삭제할 수 있는 공간입니다."
          icon={Archive}
        />

        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200 mt-12">
          <div className="flex items-center gap-2">
            <Archive size={18} className="text-gray-400" />
            <h2 className="text-sm font-black text-gray-600 uppercase tracking-widest">Archive List</h2>
          </div>
          <span className="text-xs font-bold text-gray-400">총 {deletedReports.length}개</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deletedReports.map((report: any) => (
            <div key={report.id} className="group bg-white border border-gray-100 rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="bg-gray-50 text-gray-400 p-3 rounded-2xl">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div className="bg-red-50 text-red-500 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                    DELETED
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">{report.name}</h3>
                <p className="text-[10px] text-gray-400 font-medium mb-6">
                    삭제일: {report.deletedAt ? new Date(report.deletedAt).toLocaleString() : '-'}
                </p>

                <div className="mt-6">
                  <ArchiveActions reportId={report.id} />
                </div>
              </div>
            </div>
          ))}

          {deletedReports.length === 0 && (
            <div className="col-span-full py-32 bg-white border border-dashed border-gray-200 rounded-[40px] flex flex-col items-center justify-center text-gray-300">
              <Archive size={64} className="mb-6 opacity-10" />
              <p className="text-sm font-black uppercase tracking-[0.2em]">Archive is Empty</p>
              <p className="text-[10px] font-medium mt-2">삭제된 테이블이 여기에 보관됩니다</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
