export const dynamic = 'force-dynamic';

import React from 'react';
import FormFillClient from './FormFillClient';
import { getFormTemplateAction } from '@/app/actions/form-studio';
import { queryTable } from '@/egdesk-helpers';

export default async function WorkspaceFormFillPage({ params }: { params: { id: string } }) {
  const result = await getFormTemplateAction(parseInt(params.id));
  
  if (!result.success || !result.template) {
    return <div className="p-8 text-center text-red-500">양식을 찾을 수 없거나 접근할 수 없습니다.</div>;
  }

  const template = result.template;

  // 연결된 소스 테이블의 데이터 (고객/품목 등 선택을 위해 100건 로드)
  let sourceData: any[] = [];
  if (template.sourceTable) {
    try {
      const dataResult = await queryTable({ tableName: template.sourceTable, limit: 100 });
      if (dataResult.success && dataResult.data) {
        sourceData = dataResult.data;
      }
    } catch (e) {
      console.error('Failed to load source data', e);
    }
  }

  return (
    <div className="h-full bg-slate-50 flex flex-col relative">
      <FormFillClient template={template} sourceData={sourceData} />
    </div>
  );
}
