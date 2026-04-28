'use server';

import { revalidatePath } from 'next/cache';
import { 
  queryTable, 
  createTable, 
  insertRows, 
  updateRows, 
  deleteRows, 
  deleteTable,
  getTableSchema, 
  executeSQL,
  listTables
} from '@/egdesk-helpers';
import { getSessionAction } from './auth';

const PROJECT_TABLE = 'micro_app_projects';

/**
 * 마이크로 앱 프로젝트 테이블이 존재하는지 확인합니다.
 */
export async function ensureProjectTable() {

  // 2. micro_app_projects 테이블 관리 (projectId를 고유 TEXT ID로 사용, id는 EGDesk 자동 정수 부여)
  const projectSchema = [
    { name: 'projectId', type: 'TEXT', notNull: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'sources', type: 'TEXT', notNull: true },
    { name: 'tags', type: 'TEXT' },
    { name: 'templateId', type: 'TEXT' },
    { name: 'mappingConfig', type: 'TEXT' },
    { name: 'uiSettings', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true },
    { name: 'createdBy', type: 'TEXT', notNull: true },
    { name: 'createdAt', type: 'TEXT', notNull: true },
    { name: 'updatedAt', type: 'TEXT', notNull: true }
  ];

  try {
    // 가장 확실한 테이블 존재 검증: 실제 쿼리 테스트
    let tableExists = false;
    try {
      await queryTable('micro_app_projects', { limit: 1 });
      tableExists = true;
    } catch (e) {
      tableExists = false;
    }

    if (!tableExists) {
      console.log('[ensureProjectTable] micro_app_projects table missing or invalid, creating...');
      // 혹시 listTables 에는 나오지만 실제론 없는 상태(찌꺼기)일 수 있으므로 삭제 시도
      await deleteTable('micro_app_projects').catch(() => {});
      
      await createTable('Micro App Projects', projectSchema, { 
        tableName: 'micro_app_projects',
        uniqueKeyColumns: ['projectId'],
        duplicateAction: 'update'
      });
    } else {
      // 마이그레이션 체크 (id가 TEXT인지 확인하고 projectId로 변환)
      try {
        const schema: any = await getTableSchema('micro_app_projects');
        const idCol = schema?.find((c: any) => c.name === 'id');
        const projIdCol = schema?.find((c: any) => c.name === 'projectId');
        
        if (idCol && idCol.type === 'TEXT' && !projIdCol) {
            console.log("[MICRO_APP] Detected TEXT ID schema without projectId. Converting to proper EGDesk schema...");
            const rows = await queryTable('micro_app_projects');
            await deleteTable('micro_app_projects');
            
            await createTable('Micro App Projects', projectSchema, { 
              tableName: 'micro_app_projects',
              uniqueKeyColumns: ['projectId'],
              duplicateAction: 'update'
            });
            
            if (rows && rows.length > 0) {
                const migratedRows = rows.map((r: any) => {
                    const migrated = { ...r, projectId: r.id };
                    delete migrated.id; // Remove the text 'id' so EGDesk can generate an integer one
                    return migrated;
                });
                await insertRows('micro_app_projects', migratedRows);
            }
            console.log("[MICRO_APP] Migration to proper EGDesk schema completed.");
        }
      } catch (e) {
         console.warn('[ensureProjectTable] Migration check failed:', e);
      }
    }
  } catch (error) {
    console.error('Failed to ensure project table:', error);
    // 에러를 던져서 호출자가 알 수 있게 함
    throw error;
  }
}

/**
 * 새로운 마이크로 앱 프로젝트(초안)를 생성합니다.
 */
export async function createMicroAppProjectAction(name: string) {
  const session = await getSessionAction();
  if (!session) throw new Error('인증이 필요합니다.');

  await ensureProjectTable();

  const now = new Date().toISOString();
  const projectId = `proj_${Date.now()}`;
  const projectData = {
    projectId: projectId, // EGDesk 정수 id 대신 projectId를 텍스트 식별자로 사용
    name,
    description: '',
    sources: JSON.stringify([]),
    tags: JSON.stringify([]),
    templateId: 'custom-app',
    mappingConfig: JSON.stringify([]),
    uiSettings: JSON.stringify({ theme: 'blue' }),
    status: 'DRAFT',
    createdBy: String(session.id),
    createdAt: now,
    updatedAt: now
  };
  
  try {
      await insertRows('micro_app_projects', [projectData]);
      revalidatePath('/publishing');
      return { success: true, id: projectId };
  } catch (error: any) {
      console.error('[createMicroAppProjectAction] Failed to create project:', error);
      throw new Error(`프로젝트 생성 실패: ${error.message}`);
  }
}

/**
 * 마이크로 앱 프로젝트 목록을 조회합니다.
 */
export async function listMicroAppProjectsAction() {
  const user = await getSessionAction();
  if (!user) return [];

  await ensureProjectTable();

  const results = await queryTable(PROJECT_TABLE, {
    orderBy: 'updatedAt',
    orderDirection: 'DESC'
  });

  return (results || []).map((p: any) => ({
    ...p,
    sources: JSON.parse(p.sources || '[]'),
    tags: JSON.parse(p.tags || '[]'),
    mappingConfig: p.mappingConfig ? JSON.parse(p.mappingConfig) : [],
    uiSettings: p.uiSettings ? JSON.parse(p.uiSettings) : { theme: 'blue' }
  }));
}

/**
 * 특정 프로젝트의 상세 정보를 조회합니다.
 */
export async function getMicroAppProjectAction(id: string) {
  await ensureProjectTable();
  const results = await queryTable(PROJECT_TABLE);
  console.log(`[getMicroAppProjectAction] Searching for ID: "${id}"`);
  console.log(`[getMicroAppProjectAction] Total Projects in DB: ${results?.length || 0}`);
  
  // 1. 정확한 ID 일치 확인 (projectId 컬럼 혹은 기존 id 컬럼 모두 체크)
  let project = (results || []).find((p: any) => p.projectId === id || p.id === id);
  
  // 2. 혹시 모를 ID 형식 차이(공백 등) 처리 후 재확인
  if (!project && id) {
    project = (results || []).find((p: any) => String(p.projectId || p.id).trim() === String(id).trim());
  }

  if (!project) {
    console.error(`[getMicroAppProjectAction] Project NOT FOUND for ID: ${id}`);
    return null;
  }
  
  console.log(`[getMicroAppProjectAction] Found Project: "${project.name}"`);
  
  return {
    ...project,
    id: project.projectId || project.id, // 하위 호환성을 위해 반환 객체에서는 id 필드에 text id 매핑
    sources: project.sources ? JSON.parse(project.sources) : [],
    tags: JSON.parse(project.tags || '[]'),
    mappingConfig: project.mappingConfig ? JSON.parse(project.mappingConfig) : [],
    uiSettings: project.uiSettings ? JSON.parse(project.uiSettings) : { theme: 'blue' }
  };
}

/**
 * 프로젝트에 데이터 소스(테이블)를 한꺼번에 추가합니다.
 */
export async function addSourcesToProjectAction(appId: string, newSources: Array<{ id: string, name: string }>) {
  if (!appId) throw new Error('프로젝트 ID가 필요합니다.');
  await ensureProjectTable();
  const project = await getMicroAppProjectAction(appId);
  if (!project) throw new Error('프로젝트를 찾을 수 없습니다.');

  const sources = [...project.sources];
  
  for (const source of newSources) {
    if (!sources.some(s => s.id === source.id)) {
      sources.push(source);
    }
  }
  
  await updateRows(PROJECT_TABLE, { sources: JSON.stringify(sources), updatedAt: new Date().toISOString() }, { filters: { projectId: appId } });
  revalidatePath(`/publishing/edit/${appId}`);
  revalidatePath('/publishing');
  return { success: true };
}

/**
 * 프로젝트에 데이터 소스(테이블)를 추가합니다. (단일 처리 - 하위 호환성)
 */
export async function addSourceToProjectAction(appId: string, source: { id: string, name: string }) {
  return addSourcesToProjectAction(appId, [source]);
}

/**
 * 프로젝트의 모든 데이터 소스를 한꺼번에 제거(초기화)합니다.
 */
export async function removeAllSourcesFromProjectAction(appId: string) {
  if (!appId) throw new Error('프로젝트 ID가 필요합니다.');
  await ensureProjectTable();
  await updateRows(PROJECT_TABLE, { 
    sources: JSON.stringify([]), 
    updatedAt: new Date().toISOString() 
  }, { filters: { projectId: appId } });
  
  revalidatePath(`/publishing/edit/${appId}`);
  revalidatePath('/publishing');
  return { success: true };
}

/**
 * 프로젝트에서 데이터 소스를 제거합니다.
 */
export async function removeSourceFromProjectAction(appId: string, sourceId: string) {
  if (!appId) throw new Error('프로젝트 ID가 필요합니다.');
  await ensureProjectTable();
  const project = await getMicroAppProjectAction(appId);
  if (!project) throw new Error('프로젝트를 찾을 수 없습니다.');

  const sources = project.sources.filter((s: any) => s.id !== sourceId);
  
  await updateRows(PROJECT_TABLE, { sources: JSON.stringify(sources), updatedAt: new Date().toISOString() }, { filters: { projectId: appId } });
  revalidatePath(`/publishing/edit/${appId}`);
  revalidatePath('/publishing');
  return { success: true };
}

/**
 * 프로젝트를 삭제합니다.
 */
export async function deleteMicroAppProjectAction(id: string) {
  if (!id) throw new Error('프로젝트 ID가 필요합니다.');
  await ensureProjectTable();
  await deleteRows(PROJECT_TABLE, { filters: { projectId: id } });
  revalidatePath('/publishing');
  return { success: true };
}

/**
 * 프로젝트 정보를 업데이트합니다.
 */
export async function updateMicroAppProjectAction(id: string, data: { 
  name?: string, 
  description?: string, 
  tags?: string[],
  templateId?: string,
  mappingConfig?: any,
  uiSettings?: any
}) {
  if (!id) throw new Error('프로젝트 ID가 필요합니다.');
  await ensureProjectTable();
  const updateData: any = { ...data, updatedAt: new Date().toISOString() };
  if (data.tags) updateData.tags = JSON.stringify(data.tags);
  if (data.mappingConfig) updateData.mappingConfig = JSON.stringify(data.mappingConfig);
  if (data.uiSettings) updateData.uiSettings = JSON.stringify(data.uiSettings);
  
  try {
    console.log(`[DB 업데이트 시도] 프로젝트 ID: ${id}, 데이터:`, JSON.stringify(updateData));
    await updateRows(PROJECT_TABLE, updateData, { filters: { projectId: id } });
    
    revalidatePath(`/publishing/edit/${id}`);
    revalidatePath('/publishing');
    return { success: true };
  } catch (error: any) {
    console.error('[DB 업데이트 오류]:', error);
    return { success: false, error: error.message || '데이터베이스 업데이트 오류가 발생했습니다.' };
  }
}

/**
 * 프로젝트를 최종 발행합니다.
 */
export async function publishProjectAction(projectId: string) {
  const project = await getMicroAppProjectAction(projectId);
  if (!project) throw new Error('프로젝트를 찾을 수 없습니다.');

  try {
    console.log(`[발행] 프로젝트 상태 변경 (ID: ${projectId}, Template: ${project.templateId})`);
    
    // 프로젝트 상태를 PUBLISHED로 변경
    await updateRows(PROJECT_TABLE, { status: 'PUBLISHED', updatedAt: new Date().toISOString() }, { filters: { projectId: projectId } });
    
    revalidatePath('/publishing');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('[발행 오류]:', error);
    return { success: false, error: error.message || '발행 중 오류가 발생했습니다.' };
  }
}

/**
 * 발행된 마이크로 앱을 제거(Unpublish)합니다.
 * 실제 프로젝트는 보존하고 상태만 DRAFT로 변경합니다.
 */
export async function deleteMicroAppAction(id: string) {
  const user = await getSessionAction();
  if (!user) throw new Error('인증이 필요합니다.');

  // 상태를 DRAFT로 되돌리기
  await updateRows(PROJECT_TABLE, { status: 'DRAFT', updatedAt: new Date().toISOString() }, { filters: { projectId: id } });
  
  // 메인 대시보드와 스튜디오 화면 갱신
  revalidatePath('/publishing');
  revalidatePath('/dashboard');
  
  return { success: true };
}

/**
 * 기존 앱을 복제하여 새로운 앱으로 발행합니다.
 */
export async function duplicateAndPublishProjectAction(originalId: string) {
  const session = await getSessionAction();
  if (!session) throw new Error('인증이 필요합니다.');

  await ensureProjectTable();
  const project = await getMicroAppProjectAction(originalId);
  if (!project) throw new Error('원본 프로젝트를 찾을 수 없습니다.');

  const now = new Date().toISOString();
  const projectId = `proj_${Date.now()}`;
  
  const newProjectData = {
    projectId: projectId,
    name: `${project.name} (복제본)`,
    description: project.description || '',
    sources: JSON.stringify(project.sources || []),
    tags: JSON.stringify(project.tags || []),
    templateId: project.templateId,
    mappingConfig: JSON.stringify(project.mappingConfig || []),
    uiSettings: JSON.stringify(project.uiSettings || { theme: 'blue' }),
    status: 'PUBLISHED', // 복제와 동시에 발행 처리
    createdBy: String(session.id),
    createdAt: now,
    updatedAt: now
  };
  
  try {
      await insertRows('micro_app_projects', [newProjectData]);
      revalidatePath('/publishing');
      revalidatePath('/dashboard');
      return { success: true, id: projectId };
  } catch (error: any) {
      console.error('[duplicateAndPublishProjectAction] Failed to duplicate project:', error);
      throw new Error(`프로젝트 복제 실패: ${error.message}`);
  }
}

