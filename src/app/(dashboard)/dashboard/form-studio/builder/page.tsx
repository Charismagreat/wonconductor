import React from 'react';
import FormBuilderClient from './FormBuilderClient';
import { getFormTemplateAction } from '@/app/actions/form-studio';
import { listTables, queryTable } from '@/egdesk-helpers';
import PageHeader from '@/components/PageHeader';
import { LayoutTemplate } from 'lucide-react';

import { getUnifiedTableSchema } from '@/app/actions/schema-registry';

export const dynamic = 'force-dynamic';

export default async function FormStudioBuilderPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const params = await searchParams;
  const templateId = params.id ? parseInt(params.id) : undefined;
  
  let initialTemplate = null;
  if (templateId) {
    const result = await getFormTemplateAction(templateId);
    if (result.success && result.template) {
      initialTemplate = result.template;
    }
  }

  // 1. 모든 통합 데이터 소스 가져오기 (물리 테이블 + 리포트 + 시스템 소스 + 은행 상품)
  const { getUnifiedDataSourcesAction } = await import('@/app/actions/publishing');
  const allSources = await getUnifiedDataSourcesAction().catch(() => []);
  const safeTables = allSources.map((s: any) => ({
    id: s.tableId,
    name: s.tableName,
    physicalTableName: s.physicalTableName
  }));
  
  // 테이블들의 스키마(컬럼 목록) 정보를 수집
  const tableSchemas: Record<string, string[]> = {};
  console.log(`>>> [FormStudioPage] Starting schema discovery for ${safeTables.length} tables...`);

  for (const table of safeTables) {
    try {
      // 1단계: 통일된 스키마 레지스트리 조회
      let columnsRaw = await getUnifiedTableSchema(table.id);
      
      // 2단계: 실패 시 직접 데이터 샘플링을 통한 컬럼 추출 (가장 강력한 수단)
      if (!columnsRaw || columnsRaw.length === 0) {
        console.log(`>>> [FormStudioPage] registry failed for ${table.id}, trying direct sampling...`);
        try {
          const sample = await queryTable(table.physicalTableName || table.id, { limit: 1 });
          const rows = Array.isArray(sample) ? sample : (sample?.rows || sample?.data || []);
          if (rows.length > 0) {
            columnsRaw = Object.keys(rows[0]).map(k => ({ name: k }));
          }
        } catch (sampleErr) {
          console.warn(`>>> [FormStudioPage] sampling also failed for ${table.id}`);
        }
      }

      if (columnsRaw && columnsRaw.length > 0) {
        const baseColumns = columnsRaw.map((c: any) => c.name);
        // 가상 컬럼 추가 대신 실제 컬럼들만 사용
        tableSchemas[table.id] = baseColumns;
      } else {
        // 3단계: 특정 시스템 테이블에 대한 하드코딩 폴백 (금융 등)
        if (table.id === 'bank_transactions' || table.id === 'finance-hub-bank-table') {
          tableSchemas[table.id] = [
            'id', 'date', 'time', '_bankName', '_accountName', 'accountNumber', 
            'description', 'withdrawal', 'deposit', 'balance', 
            'counterpart', 'category', 'memo', 'branchName'
          ];
        } else {
          // 최후의 수단: 기본 시스템 컬럼이라도 표시
          tableSchemas[table.id] = ['id', 'name', '__created_at', '__updated_at'];
        }
      }
    } catch (e: any) {
      console.error(`>>> [FormStudioPage] Fatal error for table ${table.id}:`, e.message);
      tableSchemas[table.id] = ['id', 'name']; 
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
