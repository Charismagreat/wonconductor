'use client';

import React, { useState } from 'react';
import { DynamicTable } from '@/components/DynamicTable';

interface GenericReportProps {
  data: any;
  mapping: any;
  uiSettings: any;
  appName: string;
  id: string;
}

export function GenericReport({ id, data, mapping, uiSettings, appName }: GenericReportProps) {
  const datasets = data?.datasets || null;
  const rawRows = data?.transactions || data || [];
  
  // AI 매핑 설정 및 DynamicTable 형식으로 변환
  const getTableColumns = (sourceData: any) => {
    const rawColumns = sourceData?.columns || (sourceData?.transactions?.length > 0 ? Object.keys(sourceData.transactions[0]).map(k => ({ name: k, displayName: k, type: 'string' })) : []);

    if (mapping && mapping.length > 0) {
      // 1. 현재 테이블(dataset)에 존재하는 실제 컬럼 목록을 추출
      const validColumnNames = new Set(rawColumns.map((c: any) => c.name));
      
      // 2. 전체 매핑 설정 중 현재 테이블에 존재하는 컬럼만 필터링
      const filteredMapping = mapping.filter((m: any) => validColumnNames.has(m.sourceColumn));
      
      // 3. 필터링된 매핑이 하나라도 있으면 해당 매핑만 반환 (없으면 빈 배열 반환하여 잘못된 컬럼 렌더링 방지)
      if (filteredMapping.length > 0) {
        return filteredMapping.map((m: any) => {
          // 매핑 정보에 type이 명시되어 있지 않은 경우, 원본 스키마(rawColumns)의 type을 우선 적용합니다.
          const originalCol = rawColumns.find((c: any) => c.name === m.sourceColumn);
          return {
            name: m.sourceColumn,
            displayName: m.displayName || m.sourceColumn,
            type: m.type || originalCol?.type || 'string'
          };
        });
      } else {
        // 다른 테이블의 매핑만 있고, 현재 테이블의 매핑은 완전히 비워진(선택 해제된) 상태
        // 빈 배열을 반환하여 잘못된(다른 테이블의) 컬럼이 표시되는 것을 차단
        return [];
      }
    }
    
    // 매핑 설정이 아예 없는 초기 상태라면 모든 컬럼 노출
    return rawColumns;
  };

  const defaultColumns = getTableColumns(data);

  return (
    <div className="flex flex-col bg-white animate-in fade-in duration-700">
      <div className="p-0 space-y-12">
        {datasets && datasets.length > 0 ? (
          datasets.map((dataset: any, idx: number) => (
            <div key={dataset.id || idx} className="space-y-4">
              <div className="px-6 py-4 bg-slate-50/50 border-y border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                  <h3 className="text-sm font-black text-slate-800 tracking-widest">
                    {dataset._sourceName || dataset.name || dataset.id || `Source ${idx + 1}`}
                  </h3>
                </div>
                <div className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                  {dataset.transactions?.length || 0} RECORDS
                </div>
              </div>
              <DynamicTable 
                reportId={`${id}-${dataset.id}`} 
                columns={getTableColumns(dataset)} 
                data={dataset.transactions} 
                isReadOnly={true}
                canEdit={false}
                isOwner={false}
                userRole="VIEWER"
                initialSortConfig={uiSettings?.multiSortConfig}
                initialItemsPerPage={uiSettings?.itemsPerPage}
              />
            </div>
          ))
        ) : (
          <DynamicTable 
            reportId={id} 
            columns={defaultColumns} 
            data={rawRows} 
            isReadOnly={true}
            canEdit={false}
            isOwner={false}
            userRole="VIEWER"
            initialSortConfig={uiSettings?.multiSortConfig}
            initialItemsPerPage={uiSettings?.itemsPerPage}
          />
        )}
      </div>
    </div>
  );
}
