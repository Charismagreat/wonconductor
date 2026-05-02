import React from 'react';
import FormBuilderClient from './FormBuilderClient';
import { getFormTemplateAction } from '@/app/actions/form-studio';
import { listTables, queryTable } from '@/egdesk-helpers';
import PageHeader from '@/components/PageHeader';
import { LayoutTemplate } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function FormStudioBuilderPage({ searchParams }: { searchParams: { id?: string } }) {
  const templateId = searchParams.id ? parseInt(searchParams.id) : undefined;
  
  let initialTemplate = null;
  if (templateId) {
    const result = await getFormTemplateAction(templateId);
    if (result.success && result.template) {
      initialTemplate = result.template;
    }
  }

  // 데이터 소스 선택을 위해 테이블 목록 가져오기
  const tablesRaw = await listTables();
  const tablesArray = Array.isArray(tablesRaw) ? tablesRaw : (tablesRaw?.tables || []);
  const safeTables = tablesArray.map((t: any) => typeof t === 'string' ? t : (t.tableName || t.name));
  
  // 테이블들의 스키마(컬럼 목록) 정보를 미리 수집
  const tableSchemas: Record<string, string[]> = {};
  for (const table of safeTables) {
    try {
      // 1건만 조회하여 컬럼명 추출
      const result = await queryTable({ tableName: table, limit: 1 });
      if (result.success && result.data && result.data.length > 0) {
        tableSchemas[table] = Object.keys(result.data[0]);
      } else {
        tableSchemas[table] = []; // 데이터가 없으면 빈 배열
      }
    } catch (e) {
      tableSchemas[table] = [];
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <main className="max-w-[1600px] mx-auto px-8 md:px-12 pt-6 pb-12 h-full flex flex-col">
        <PageHeader 
          title={templateId ? "FORM STUDIO BUILDER (EDIT)" : "FORM STUDIO BUILDER"}
          description="데이터베이스의 데이터를 동적으로 바인딩할 수 있는 워크스페이스용 양식 템플릿을 디자인합니다."
          icon={LayoutTemplate}
        />
        <div className="flex-1 flex flex-col min-h-[800px]">
          <FormBuilderClient 
            initialTemplate={initialTemplate} 
            tables={safeTables}
            tableSchemas={tableSchemas}
          />
        </div>
      </main>
    </div>
  );
}
