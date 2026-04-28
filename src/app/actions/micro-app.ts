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
async function ensureProjectTable() {
  // 1. micro_app_config 테이블 확립 및 관리
  try {
    const configSchema = await getTableSchema('micro_app_config');
    const idCol = (configSchema as any[]).find((c: any) => c.name === 'id');
    
    if (idCol && idCol.type !== 'INTEGER' && !String(idCol.type).includes('AUTOINCREMENT')) {
        console.log('[ensureProjectTable] micro_app_config ID type mismatch. Current:', idCol.type);
        
        const rows = await queryTable('micro_app_config', { limit: 1 });
        if (rows.length === 0) {
            console.log('[ensureProjectTable] micro_app_config is empty, dropping for recreation...');
            await deleteTable('micro_app_config');
            throw new Error('Table dropped for recreation');
        }
    }
  } catch (err) {
    try {
      await createTable('Micro App Config', [
        { name: 'id', type: 'TEXT', notNull: true },
        { name: 'projectId', type: 'TEXT', notNull: true },
        { name: 'templateId', type: 'TEXT' },
        { name: 'sourceTableId', type: 'TEXT' },
        { name: 'mappingConfig', type: 'TEXT' },
        { name: 'uiSettings', type: 'TEXT' },
        { name: 'rbacRoles', type: 'TEXT' },
        { name: 'createdBy', type: 'TEXT' },
        { name: 'createdAt', type: 'TEXT' },
        { name: 'updatedAt', type: 'TEXT' }
      ], { tableName: 'micro_app_config' });
    } catch (e2: any) {
      if (e2.message?.includes('UNIQUE constraint failed: user_tables.table_name')) {
        console.log('[ensureProjectTable] micro_app_config metadata already exists. Skipping recreation.');
      } else {
        console.error('[ensureProjectTable] Failed to create micro_app_config:', e2.message);
      }
    }
  }

  // 2. micro_app_projects 테이블 관리 (TEXT ID 기반)
  const projectSchema = [
    { name: 'id', type: 'TEXT', notNull: true },
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
      
      await createTable('Micro App Projects', projectSchema, { tableName: 'micro_app_projects' });
    } else {
      // 마이그레이션 체크 (INTEGER -> TEXT)
      try {
        const schema: any = await getTableSchema('micro_app_projects');
        const idCol = schema?.find((c: any) => c.name === 'id');
        if (idCol && idCol.type === 'INTEGER') {
            console.log("[MICRO_APP] Detected INTEGER ID schema. Converting to TEXT...");
            const rows = await queryTable('micro_app_projects');
            await deleteTable('micro_app_projects');
            
            await createTable('Micro App Projects', projectSchema, { tableName: 'micro_app_projects' });
            
            if (rows && rows.length > 0) {
                const migratedRows = rows.map((r: any) => ({ ...r, id: String(r.id) }));
                await insertRows('micro_app_projects', migratedRows);
            }
            console.log("[MICRO_APP] Migration to TEXT ID completed.");
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
    id: projectId,
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
  
  // 1. 정확한 ID 일치 확인
  let project = (results || []).find((p: any) => p.id === id);
  
  // 2. 혹시 모를 ID 형식 차이(공백 등) 처리 후 재확인
  if (!project && id) {
    project = (results || []).find((p: any) => String(p.id).trim() === String(id).trim());
  }

  if (!project) {
    console.error(`[getMicroAppProjectAction] Project NOT FOUND for ID: ${id}`);
    return null;
  }
  
  console.log(`[getMicroAppProjectAction] Found Project: "${project.name}"`);
  
  return {
    ...project,
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
  
  await updateRows(PROJECT_TABLE, { sources: JSON.stringify(sources), updatedAt: new Date().toISOString() }, { filters: { id: appId } });
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
  }, { filters: { id: appId } });
  
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
  
  await updateRows(PROJECT_TABLE, { sources: JSON.stringify(sources), updatedAt: new Date().toISOString() }, { filters: { id: appId } });
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
  await deleteRows(PROJECT_TABLE, { filters: { id } });
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
    await updateRows(PROJECT_TABLE, updateData, { filters: { id } });
    
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

  // micro_app_config 테이블 형식에 맞춰 변환
  // 모든 소스 ID를 콤마로 결합하여 저장
  const allSourceIds = project.sources.map((s: any) => s.id).join(',');
  
  const config = {
    projectId,
    templateId: project.templateId || 'custom-app',
    sourceTableId: allSourceIds,
    mappingConfig: typeof project.mappingConfig === 'string' ? project.mappingConfig : JSON.stringify(project.mappingConfig || []),
    uiSettings: typeof project.uiSettings === 'string' ? project.uiSettings : JSON.stringify(project.uiSettings || { theme: 'blue' }),
    rbacRoles: JSON.stringify(['CEO', 'ADMIN']),
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    updatedAt: new Date().toISOString()
  };
  try {
    // [사용자 요청 반영] 항상 새로운 앱 인스턴스 발행 (Instance Spawning)
    const insertRes = await insertRows('micro_app_config', [config]);
    const insertedRow = Array.isArray(insertRes) ? insertRes[0] : (insertRes.rows?.[0] || insertRes);
    const publishedId = insertedRow.id;
    console.log(`[발행] 신규 앱 인스턴스 발행 완료 (ID: ${config.projectId}, Template: ${config.templateId})`);
    
    // 프로젝트 상태를 PUBLISHED로 변경
    await updateRows(PROJECT_TABLE, { status: 'PUBLISHED', updatedAt: new Date().toISOString() }, { filters: { id: projectId } });
    
    revalidatePath('/publishing');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('[발행 오류]:', error);
    return { success: false, error: error.message || '발행 중 오류가 발생했습니다.' };
  }
}

/**
 * 발행된 마이크로 앱을 제거합니다.
 */
export async function deleteMicroAppAction(id: string) {
  const user = await getSessionAction();
  if (!user) throw new Error('인증이 필요합니다.');

  // micro_app_config에서 제거
  await deleteRows('micro_app_config', { filters: { id } });
  
  // 메인 대시보드와 스튜디오 화면 갱신
  revalidatePath('/publishing');
  revalidatePath('/dashboard');
  
  return { success: true };
}
