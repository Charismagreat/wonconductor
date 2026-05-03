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

  // 1. 물리 테이블 목록 가져오기
  const tablesRaw = await listTables();
  const tablesArray = Array.isArray(tablesRaw) ? tablesRaw : (tablesRaw?.tables || []);
  
  // 2. 가상 리포트 목록 가져오기
  const reportsRaw = await queryTable('dashboard_master', { limit: 100 }).catch(() => []);
  const reportsArray = Array.isArray(reportsRaw) ? reportsRaw : (reportsRaw?.rows || []);

  // 통합 소스 목록 생성 및 중복 제거
  const sourceMap = new Map<string, any>();

  // 1. 물리 테이블 추가
  tablesArray.forEach((t: any) => {
    const id = t.tableName || t.name || t;
    sourceMap.set(id, {
      id,
      name: t.displayName || t.tableName || t.name || String(t),
      physicalTableName: t.tableName || t.name || t
    });
  });

  // 2. 가상 리포트 추가 (이미 있는 ID면 리포트 설정으로 덮어쓰거나 유지 - 여기서는 리포트 우선순위로 업데이트)
  reportsArray.forEach((r: any) => {
    const id = r.reportId || String(r.id);
    sourceMap.set(id, {
      id,
      name: r.name,
      physicalTableName: r.tableName || r.reportId || String(r.id)
    });
  });

  const safeTables = Array.from(sourceMap.values());
  
  // 테이블들의 스키마(컬럼 목록) 정보를 미리 수집
  const tableSchemas: Record<string, string[]> = {};
  for (const table of safeTables) {
    try {
      // 1건만 조회하여 컬럼명 추출
      const result = await queryTable(table.physicalTableName || table.id, { limit: 1 });
      const rows = Array.isArray(result) ? result : (result?.rows || result?.data || []);
      
      if (rows.length > 0) {
        tableSchemas[table.id] = Object.keys(rows[0]);
      } else {
        tableSchemas[table.id] = []; 
      }
    } catch (e) {
      tableSchemas[table.id] = [];
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
