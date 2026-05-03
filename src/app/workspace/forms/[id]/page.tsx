export const dynamic = 'force-dynamic';

import React from 'react';
import FormFillClient from './FormFillClient';
import { getFormTemplateAction } from '@/app/actions/form-studio';
import { queryTable } from '@/egdesk-helpers';

export default async function WorkspaceFormFillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getFormTemplateAction(parseInt(id));
  
  if (!result.success || !result.template) {
    return <div className="p-8 text-center text-red-500">양식을 찾을 수 없거나 접근할 수 없습니다.</div>;
  }

  const template = result.template;

  // 데이터 소스 테이블에서 데이터 가져오기
  let sourceData: any[] = [];
  if (template.sourceTable) {
    try {
      const results = await queryTable(template.sourceTable, { filters: { __is_deleted: '0' } });
      sourceData = Array.isArray(results) ? results : (results?.rows || []);
    } catch (error) {
      console.error('Failed to fetch source data:', error);
    }
  }

  let processedData = sourceData;
  if (sourceData.length > 0) {
    const groupKey = '견적번호'; // 기준이 되는 키
    const groups: Record<string, any> = {};
    
    sourceData.forEach(row => {
      const keyValue = row[groupKey];
      if (!keyValue) return; // 키가 없는 데이터는 무시하거나 개별 처리
      
      const k = String(keyValue);
      if (!groups[k]) {
        groups[k] = { ...row };
        groups[k]._itemCount = 1;
        // 첫 번째 아이템도 _1 접미사 붙인 버전 추가
        Object.keys(row).forEach(key => {
          groups[k][`${key}_1`] = row[key];
        });
      } else {
        const count = groups[k]._itemCount + 1;
        // 기존 컬럼명에 인덱스를 붙여 가상 컬럼 생성 (품목명_및_규격_2 등)
        Object.keys(row).forEach(key => {
          groups[k][`${key}_${count}`] = row[key];
        });
        groups[k]._itemCount = count;
      }
    });
    
    processedData = Object.values(groups);
  }

  return (
    <div className="h-full bg-slate-50 flex flex-col relative">
      <FormFillClient template={template} sourceData={processedData} />
    </div>
  );
}
