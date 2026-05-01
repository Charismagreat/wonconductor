'use server'

import { executeSQL, insertRows, queryTable, createTable } from '@/egdesk-helpers';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

import { 
  refreshSingleChartAction 
} from '@/lib/services/chart-service';

/**
 * 마이크로 앱 프로젝트의 전체 정보를 업데이트합니다.
 */
export async function updateMicroAppProjectAction(projectId: string, updates: any) {
  try {
    const updatedAt = new Date().toISOString();
    
    // 객체 필드들이 있을 경우 JSON 문자열로 변환
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.widgets && typeof sanitizedUpdates.widgets !== 'string') sanitizedUpdates.widgets = JSON.stringify(sanitizedUpdates.widgets);
    if (sanitizedUpdates.sources && typeof sanitizedUpdates.sources !== 'string') sanitizedUpdates.sources = JSON.stringify(sanitizedUpdates.sources);
    if (sanitizedUpdates.mappingConfig && typeof sanitizedUpdates.mappingConfig !== 'string') sanitizedUpdates.mappingConfig = JSON.stringify(sanitizedUpdates.mappingConfig);
    if (sanitizedUpdates.uiSettings && typeof sanitizedUpdates.uiSettings !== 'string') sanitizedUpdates.uiSettings = JSON.stringify(sanitizedUpdates.uiSettings);
    if (sanitizedUpdates.tags && typeof sanitizedUpdates.tags !== 'string') sanitizedUpdates.tags = JSON.stringify(sanitizedUpdates.tags);

    const fields = Object.keys(sanitizedUpdates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(sanitizedUpdates), updatedAt, projectId];

    await executeSQL(
      `UPDATE micro_app_projects SET ${fields}, updatedAt = ? WHERE projectId = ?`,
      values
    );

    revalidatePath('/publishing');
    revalidatePath(`/publishing/edit/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to update micro app:', error);
    return { success: false, error: '업데이트 중 오류가 발생했습니다.' };
  }
}

/**
 * 프로젝트에 새로운 데이터 소스를 추가합니다.
 */
export async function addSourcesToProjectAction(projectId: string, newSources: any[]) {
  try {
    const project = await getMicroApp(projectId);
    if (!project) throw new Error('프로젝트를 찾을 수 없습니다.');

    const currentSources = Array.isArray(project.sources) ? project.sources : (project.sources ? JSON.parse(project.sources) : []);
    
    // 중복 제거 후 병합 (id 기준)
    const mergedSources = [...currentSources];
    newSources.forEach(ns => {
      if (!mergedSources.some(s => s.id === ns.id)) {
        mergedSources.push(ns);
      }
    });

    return await updateMicroAppProjectAction(projectId, { sources: mergedSources });
  } catch (error) {
    console.error('Failed to add sources:', error);
    return { success: false };
  }
}

/**
 * 프로젝트에서 특정 데이터 소스를 제거합니다.
 */
export async function removeSourceFromProjectAction(projectId: string, sourceId: string) {
  try {
    const project = await getMicroApp(projectId);
    if (!project) throw new Error('프로젝트를 찾을 수 없습니다.');

    const currentSources = Array.isArray(project.sources) ? project.sources : (project.sources ? JSON.parse(project.sources) : []);
    const filteredSources = currentSources.filter((s: any) => s.id !== sourceId);

    return await updateMicroAppProjectAction(projectId, { sources: filteredSources });
  } catch (error) {
    console.error('Failed to remove source:', error);
    return { success: false };
  }
}

/**
 * 프로젝트의 모든 데이터 소스를 제거합니다.
 */
export async function removeAllSourcesFromProjectAction(projectId: string) {
  return await updateMicroAppProjectAction(projectId, { sources: [] });
}

/**
 * 마이크로 앱 프로젝트를 최종 발행합니다.
 */
export async function publishProjectAction(projectId: string) {
  try {
    const now = new Date().toISOString();
    await executeSQL(
      `UPDATE micro_app_projects SET status = 'PUBLISHED', updatedAt = ? WHERE projectId = ?`,
      [now, projectId]
    );
    revalidatePath('/publishing');
    return { success: true };
  } catch (error) {
    console.error('Failed to publish project:', error);
    return { success: false, error: '발행 중 오류가 발생했습니다.' };
  }
}

/**
 * 기존 프로젝트를 복제하여 새로운 앱으로 발행합니다.
 */
export async function duplicateAndPublishProjectAction(projectId: string) {
  try {
    const project = await getMicroApp(projectId);
    if (!project) throw new Error('원본 프로젝트를 찾을 수 없습니다.');

    const newProjectId = `app_${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    await insertRows('micro_app_projects', [{
      projectId: newProjectId,
      name: `${project.name} (복제본)`,
      description: project.description,
      templateId: project.templateId,
      status: 'PUBLISHED',
      widgets: typeof project.widgets === 'string' ? project.widgets : JSON.stringify(project.widgets || []),
      sources: typeof project.sources === 'string' ? project.sources : JSON.stringify(project.sources || []),
      mappingConfig: typeof project.mappingConfig === 'string' ? project.mappingConfig : JSON.stringify(project.mappingConfig || []),
      uiSettings: typeof project.uiSettings === 'string' ? project.uiSettings : JSON.stringify(project.uiSettings || {}),
      themeColor: project.themeColor,
      createdAt: now,
      updatedAt: now
    }]);

    revalidatePath('/publishing');
    return { success: true, id: newProjectId };
  } catch (error) {
    console.error('Failed to duplicate and publish:', error);
    return { success: false, error: '복제 발행 중 오류가 발생했습니다.' };
  }
}

/**
 * 마이크로 앱 프로젝트 테이블 존재 여부를 확인하고 없으면 생성합니다. (Self-Healing)
 */
export async function ensureProjectTable() {
  try {
    const { listTables, createTable } = await import('@/egdesk-helpers');
    const result = await listTables();
    const currentTables = Array.isArray(result) ? result : (result?.tables || []);
    const tableNames = new Set(currentTables.map((t: any) => 
        (typeof t === 'string' ? t : (t.tableName || t.name))?.toLowerCase()
    ));

    if (!tableNames.has('micro_app_projects')) {
      console.log('[Micro-App] 프로젝트 테이블이 없어 생성합니다...');
      await createTable('Micro App Project', [
        { name: 'projectId', type: 'TEXT', notNull: true },
        { name: 'name', type: 'TEXT', notNull: true },
        { name: 'description', type: 'TEXT' },
        { name: 'templateId', type: 'TEXT' },
        { name: 'status', type: 'TEXT', notNull: true }, // 'DRAFT' | 'PUBLISHED'
        { name: 'widgets', type: 'TEXT' }, // JSON
        { name: 'sources', type: 'TEXT' }, // JSON
        { name: 'mappingConfig', type: 'TEXT' }, // JSON
        { name: 'uiSettings', type: 'TEXT' }, // JSON
        { name: 'tags', type: 'TEXT' }, // JSON (추가됨)
        { name: 'themeColor', type: 'TEXT' },
        { name: 'createdAt', type: 'TEXT' },
        { name: 'updatedAt', type: 'TEXT' }
      ], { tableName: 'micro_app_projects', uniqueKeyColumns: ['projectId'], duplicateAction: 'update' });
    }
  } catch (error) {
    console.error('Failed to ensure micro_app_projects table:', error);
  }
}

/**
 * 대시보드 차트 정보를 바탕으로 새로운 마이크로 앱을 즉시 발행합니다.
 */
export async function createMicroAppFromCharts(params: {
  projectId: string;
  appName: string;
  selectedCharts: any[];
}) {
  try {
    await ensureProjectTable();
    const { projectId: userProjectId, appName, selectedCharts } = params;

    // 1. 차트 설정을 마이크로 앱 위젯 구조로 변환
    const widgets = selectedCharts.map((chart, index) => ({
      id: crypto.randomUUID(),
      type: 'chart',
      title: chart.title || '제목 없는 차트',
      config: {
        type: chart.type,
        xAxis: chart.xAxis,
        series: chart.series,
        refreshMetadata: chart.refreshMetadata,
        sourceDescription: chart.sourceDescription,
        showLabels: chart.showLabels ?? true,
        data: chart.data || []
      },
      layout: { x: 0, y: index * 4, w: 12, h: 4 }
    }));

    const projectId = `app_${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    // 2. 데이터베이스 저장 (PUBLISHED 상태로 즉시 발행)
    await insertRows('micro_app_projects', [{
      projectId,
      name: appName,
      status: 'PUBLISHED',
      themeColor: '#2563eb',
      widgets: JSON.stringify(widgets),
      createdAt: now,
      updatedAt: now
    }]);

    revalidatePath('/dashboard');
    revalidatePath('/publishing');

    return { success: true, appId: projectId, message: '마이크로 앱이 성공적으로 발행되었습니다.' };
  } catch (error) {
    console.error('Failed to create micro app:', error);
    return { success: false, message: '앱 생성 중 오류가 발생했습니다.' };
  }
}

/**
 * 마이크로 앱 프로젝트(초안) 목록을 조회합니다.
 */
export async function listMicroAppProjectsAction() {
  try {
    await ensureProjectTable();
    const rows = await queryTable('micro_app_projects', {
      filters: { status: 'DRAFT' },
      orderBy: 'updatedAt',
      orderDirection: 'DESC'
    });
    return rows || [];
  } catch (error) {
    console.error('Failed to list micro app projects:', error);
    return [];
  }
}

/**
 * 마이크로 앱의 특정 위젯 데이터를 새로고침합니다.
 */
export async function refreshMicroAppWidgetAction(widget: any) {
  try {
    const mockPinnedItem = { config: widget.config };
    const refreshedItem = await refreshSingleChartAction(mockPinnedItem);
    
    return { 
      success: true, 
      data: refreshedItem.config.data,
      refreshedAt: refreshedItem.refreshedAt 
    };
  } catch (error) {
    console.error('Failed to refresh widget:', error);
    return { success: false, message: '데이터 갱신에 실패했습니다.' };
  }
}

/**
 * 마이크로 앱 프로젝트를 생성합니다.
 */
export async function createMicroAppProjectAction(name: string) {
  try {
    await ensureProjectTable();
    const projectId = `proj_${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();

    await insertRows('micro_app_projects', [{
      projectId,
      name,
      status: 'DRAFT',
      themeColor: '#2563eb',
      widgets: JSON.stringify([]),
      createdAt: now,
      updatedAt: now
    }]);

    revalidatePath('/publishing');
    return { success: true, id: projectId };
  } catch (error) {
    console.error('Failed to create project:', error);
    return { success: false };
  }
}

/**
 * 마이크로 앱 프로젝트를 삭제합니다.
 */
export async function deleteMicroAppProjectAction(projectId: string) {
  try {
    await executeSQL(`DELETE FROM micro_app_projects WHERE projectId = ?`, [projectId]);
    revalidatePath('/publishing');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete project:', error);
    return { success: false };
  }
}

/**
 * 발행된 마이크로 앱을 삭제합니다.
 */
export async function deleteMicroAppAction(projectId: string) {
  try {
    await executeSQL(`DELETE FROM micro_app_projects WHERE projectId = ?`, [projectId]);
    revalidatePath('/publishing');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete app:', error);
    return { success: false };
  }
}

/**
 * 특정 마이크로 앱 상세 정보를 조회합니다.
 */
export async function getMicroApp(projectId: string) {
  try {
    await ensureProjectTable();
    const rows = await queryTable('micro_app_projects', {
      filters: { projectId },
      limit: 1
    });
    
    if (!rows || rows.length === 0) return null;
    const app = rows[0];
    
    return {
      ...app,
      widgets: app.widgets ? JSON.parse(app.widgets) : []
    };
  } catch (error) {
    console.error('Failed to get micro app:', error);
    return null;
  }
}

/**
 * 하위 호환성을 위한 별칭
 */
export const getMicroAppProjectAction = getMicroApp;
