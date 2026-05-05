import {
    queryTable,
    listWorkflows,
    createWorkflow,
    addWorkflowAction,
    getWorkflow,
    createRun,
    updateRunStatus,
    advanceRunStage,
    createApproval,
    insertRows,
    listBusinessIdentitySnapshots,
    listKnowledgeDocuments,
} from '@/egdesk-helpers';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' }, { apiVersion: 'v1beta' });

/**
 * 워크플로우 템플릿의 변수를 실제 데이터 값으로 치환합니다.
 * 예: "품번 {{part_no}} 입고됨" -> "품번 ABC-123 입고됨"
 */
function substituteVariables(template: string, data: any): string {
    return template.replace(/\{\{(.*?)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();
        return data[trimmedKey] !== undefined ? String(data[trimmedKey]) : match;
    });
}

/**
 * 레포트 ID에서 데이터 카테고리를 추출합니다.
 * 예: 'rep-tpl_fin_cashflow' → 'fin', 'rep-tpl_hr_attendance' → 'hr'
 */
function inferCategoryFromReportId(reportId: string): string {
    const match = reportId.match(/tpl_([a-z]+)_/);
    return match ? match[1] : 'general';
}

/**
 * AI Center에서 이 데이터에 맞는 활성 워크플로우를 찾습니다.
 * inputTypes가 reportId 카테고리 또는 데이터 필드명과 겹치면 매칭으로 간주합니다.
 */
function findMatchingWorkflows(workflows: any[], reportId: string, dataFields: string[]): any[] {
    const category = inferCategoryFromReportId(reportId);
    const lowerFields = dataFields.map(f => f.toLowerCase());

    console.log(`[findMatchingWorkflows] reportId=${reportId}, total workflows=${workflows.length}, active=${workflows.filter((w:any)=>w.status==='active').length}`);
    workflows.filter((w:any)=>w.status==='active').forEach((w:any) => {
        console.log(`  [active wf] id=${w.id} triggerTable=${w.triggerTable} inputTypes=${JSON.stringify(w.inputTypes)}`);
    });

    return workflows.filter(w => {
        if (w.status !== 'active') return false;
        // Priority 1: exact triggerTable match (set during AI suggestion)
        // If a workflow has triggerTable bound, ONLY fire for that exact table — no fuzzy fallback.
        if (w.triggerTable) return w.triggerTable === reportId;
        // Priority 2: fuzzy inputTypes match — only for workflows with no triggerTable binding
        const inputTypes: string[] = w.inputTypes || [];
        return inputTypes.some(t =>
            t === category ||
            reportId.includes(t) ||
            lowerFields.some(f => f.includes(t.toLowerCase()))
        );
    });
}

// Module-level log helper so all engine functions can write to workflow_trace.txt
function engineLog(msg: string): void {
    const fsSync = require('fs');
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(msg);
    fsSync.appendFileSync('workflow_trace.txt', line);
}

/**
 * 단일 액션(create_task, update_status)을 실행합니다.
 * approve 액션은 executeStage에서 직접 처리합니다.
 */
async function executeAction(
    action: { actionId: string; params?: Record<string, any>; stage: number; position: number; [key: string]: any },
    runId: string,
    workflowLabel: string,
    reportId: string,
    inputData: any,
): Promise<void> {
    // Normalize actionId — listWorkflows returns the action type in 'id' (not 'actionId')
    const actionId: string = action.actionId ?? (action as any).id ?? (action as any).type ?? (action as any).action ?? '';
    const params = action.params || {};

    if (actionId === 'create_task') {
        const [usersRes, deptsRes] = await Promise.all([
            queryTable('user', { filters: { isActive: '1' } }),
            queryTable('department', { limit: 200 }),
        ]);
        const userList = Array.isArray(usersRes) ? usersRes : (usersRes as any)?.rows ?? [];
        const deptList: any[] = Array.isArray(deptsRes) ? deptsRes : (deptsRes as any)?.rows ?? [];
        // Build departmentId → name map
        const deptMap: Record<string, string> = {};
        for (const d of deptList) {
            if (d.id != null && d.name) deptMap[String(d.id)] = d.name;
        }
        const assigneeRole = params.assigneeRole || 'ADMIN';
        // 1) exact role match, 2) department name keyword match (via deptMap), 3) fall back to first ADMIN
        const assignee =
            userList.find((u: any) => u.role === assigneeRole) ??
            userList.find((u: any) => {
                const deptName = u.departmentId ? (deptMap[String(u.departmentId)] ?? '') : '';
                return deptName && assigneeRole.includes(deptName);
            }) ??
            userList.find((u: any) => u.role === 'ADMIN');

        let dueAt: string;
        if (params.deadline?.ref) {
            const refValue = inputData[params.deadline.ref];
            dueAt = refValue ? new Date(refValue).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString();
        } else {
            const dueDays = parseInt(String(params.dueDays ?? '3'), 10);
            dueAt = new Date(Date.now() + dueDays * 86400000).toISOString();
        }

        const taskTitle = substituteVariables(params.title || '후속 처리 필요', inputData);
        engineLog(`[Engine:create_task] title="${taskTitle}" assigneeRole=${assigneeRole} assigneeId=${assignee?.id ?? 'null'} dueAt=${dueAt} actionId=${actionId}`);

        await insertRows('action_task', [{
            runId,
            reportId,
            title: taskTitle,
            description: `워크플로우 "${workflowLabel}"에 의해 자동 생성됨.`,
            status: 'TODO',
            assigneeId: assignee?.id || null,
            dueAt,
            createdAt: new Date().toISOString(),
        }]);
        engineLog(`[Engine:create_task] ✅ Inserted into action_task (runId=${runId})`);

        // Notify assignee + all ADMINs so the task surfaces in the workflow hub
        const { createInAppNotification } = await import('@/lib/notifications');
        const notifyTargets = new Set<string>();
        if (assignee?.id) notifyTargets.add(String(assignee.id));
        userList
            .filter((u: any) => u.role === 'ADMIN')
            .forEach((u: any) => notifyTargets.add(String(u.id)));

        for (const uid of notifyTargets) {
            await createInAppNotification({
                userId: uid,
                title: `📋 새 업무 배정: ${taskTitle}`,
                message: `워크플로우 "${workflowLabel}"에 의해 자동 생성된 업무입니다. 마감: ${new Date(dueAt).toLocaleDateString('ko-KR')}`,
                link: `/report/${reportId}`,
                type: 'ALERT',
            });
        }
        engineLog(`[Engine:create_task] 🔔 Notified ${notifyTargets.size} user(s)`);

    } else if (actionId === 'update_status') {
        const value = params.value || '처리완료';
        engineLog(`[Engine:update_status] value="${value}" run=${runId}`);
    } else if (actionId === 'approve') {
        // approve is handled at the stage level, not here
    } else {
        engineLog(`[Engine:executeAction] Unknown actionId="${actionId}" raw=${JSON.stringify(action)}, skipping.`);
    }
}

/**
 * 특정 스테이지의 액션들을 실행합니다.
 * - create_task / update_status: 병렬 실행
 * - approve: createApproval 호출 후 실행 일시 중단 (결재 대기)
 * - 모든 액션 완료 후 다음 스테이지가 있으면 advanceRunStage → 재귀 실행
 * - 마지막 스테이지면 run 상태를 '정상완료'로 업데이트
 */
async function executeStage(
    allActions: Array<{ actionId: string; params?: Record<string, any>; stage: number; position: number }>,
    runId: string,
    stageIdx: number,
    workflowLabel: string,
    reportId: string,
    inputData: any,
): Promise<void> {
    const stageActions = allActions
        .filter(a => a.stage === stageIdx)
        .sort((a, b) => a.position - b.position);

    if (stageActions.length === 0) {
        engineLog(`[Engine:executeStage] Stage ${stageIdx} has no actions, completing run ${runId}.`);
        await updateRunStatus(runId, '정상완료');
        return;
    }

    engineLog(`[Engine:executeStage] Executing stage ${stageIdx} (${stageActions.length} actions) for run ${runId}`);

    const resolveId = (a: any) => a.actionId ?? a.id ?? a.type ?? a.action ?? '';
    const nonApproveActions = stageActions.filter(a => resolveId(a) !== 'approve');
    const approveActions = stageActions.filter(a => resolveId(a) === 'approve');

    // Run non-blocking actions in parallel
    await Promise.allSettled(
        nonApproveActions.map(action =>
            executeAction(action, runId, workflowLabel, reportId, inputData).catch(err => {
                engineLog(`[Engine:executeStage] ❌ Action "${action.actionId}" (stage ${stageIdx}, pos ${action.position}) failed: ${err}`);
            })
        )
    );

    // Handle approval gates — pause execution
    if (approveActions.length > 0) {
        for (const approveAction of approveActions) {
            const approvalChain: Array<{ role: string; name?: string }> =
                approveAction.params?.approvalChain || [{ role: 'ADMIN' }];
            // Create pending approval for the first approver in the chain
            await createApproval(runId, stageIdx, 0, approvalChain[0].role);
            engineLog(`[Engine:executeStage] Approval gate created — waiting for "${approvalChain[0].role}" (stage ${stageIdx}, run ${runId})`);
        }
        // Execution pauses here; resumption via recordApprovalDecision callback
        return;
    }

    // Advance to next stage if one exists
    const nextStageIdx = stageIdx + 1;
    const hasNextStage = allActions.some(a => a.stage === nextStageIdx);

    if (hasNextStage) {
        await advanceRunStage(runId, nextStageIdx);
        engineLog(`[Engine:executeStage] Advancing run ${runId} to stage ${nextStageIdx}`);
        await executeStage(allActions, runId, nextStageIdx, workflowLabel, reportId, inputData);
    } else {
        await updateRunStatus(runId, '정상완료');
        engineLog(`[Engine:executeStage] Run ${runId} completed ✅`);
    }
}

/**
 * 활성 워크플로우에 대한 새 실행(Run)을 시작합니다.
 * getWorkflow로 전체 액션 스텝을 조회한 후 스테이지 0부터 실행합니다.
 */
async function startWorkflowRun(workflow: any, reportId: string, rowData: any): Promise<void> {
    engineLog(`[Engine:startRun] Starting run for workflow "${workflow.label}" (id=${workflow.id})`);

    // Use actions from the already-loaded workflow object (listWorkflows returns them embedded).
    // Fall back to getWorkflow only if the passed object lacks actions.
    let allActions: Array<{ actionId: string; params?: Record<string, any>; stage: number; position: number }> =
        workflow?.actions ?? workflow?.actionSteps ?? workflow?.steps ?? [];

    if (allActions.length === 0) {
        engineLog(`[Engine:startRun] actions not on workflow object, fetching via getWorkflow...`);
        const fullWorkflow = await getWorkflow(workflow.id);
        engineLog(`[Engine:startRun] getWorkflow response keys: ${JSON.stringify(Object.keys(fullWorkflow ?? {}))}`);
        const wfObj = fullWorkflow?.workflow ?? fullWorkflow;
        allActions = wfObj?.actions ?? wfObj?.actionSteps ?? wfObj?.steps ?? [];
    }

    engineLog(`[Engine:startRun] allActions.length=${allActions.length} sample=${JSON.stringify(allActions[0] ?? null)}`);

    if (allActions.length === 0) {
        engineLog(`[Engine:startRun] ⚠️ Workflow "${workflow.label}" has no actions — skipping run.`);
        return;
    }

    // Create the run record
    const runResult = await createRun(workflow.id, rowData, 'dashboard_data', null);
    engineLog(`[Engine:startRun] createRun response keys: ${JSON.stringify(Object.keys(runResult ?? {}))}`);

    const runId: string = runResult?.run?.id ?? runResult?.id ?? runResult?.runId;
    if (!runId) {
        engineLog(`[Engine:startRun] ❌ createRun did not return a run ID. Full response: ${JSON.stringify(runResult)}`);
        return;
    }

    engineLog(`[Engine:startRun] Run created: runId=${runId}`);
    await updateRunStatus(runId, '정상진행중');
    await executeStage(allActions, runId, 0, workflow.label, reportId, rowData);
}

/**
 * AI가 데이터를 분석하여 AI Center에 새로운 워크플로우 템플릿을 제안합니다.
 * 조직 구조, 계층, 정책 문서를 함께 주입하여 회사 맥락에 맞는 워크플로우를 설계합니다.
 * 이미 동일한 레포트에 대한 제안이 있으면 중복 생성하지 않습니다.
 */
async function suggestWorkflowToAICenter(reportId: string, rowData: any): Promise<void> {
    const allWorkflows = await listWorkflows();
    const alreadySuggested = reportId && reportId !== 'undefined' && allWorkflows.some((w: any) =>
        w.status === 'suggested' &&
        (w.hints || []).includes(`report:${reportId}`)
    );
    if (alreadySuggested) {
        console.log(`[AI Center] Suggestion already exists for report ${reportId}, skipping.`);
        return;
    }

    const dataFields = Object.keys(rowData).filter(k => !k.startsWith('__'));
    const category = inferCategoryFromReportId(reportId);

    // ── 조직/정책 컨텍스트 수집 ───────────────────────────────────────────────
    let orgContext = '';
    let policyContext = '';

    try {
        const snapshotRes = await listBusinessIdentitySnapshots();
        const snapshotId = snapshotRes?.snapshots?.[0]?.id ?? null;

        if (snapshotId) {
            const [hierarchyRes, policyRes, departments, users] = await Promise.all([
                listKnowledgeDocuments(snapshotId, 'hierarchy').catch(() => ({})),
                listKnowledgeDocuments(snapshotId, 'policy').catch(() => ({})),
                queryTable('department', { limit: 200 }).catch(() => []),
                queryTable('user', { filters: { isActive: '1' }, limit: 500 }).catch(() => []),
            ]);

            const hierarchyDocs: any[] = (hierarchyRes as any)?.documents ?? [];
            const policyDocs: any[] = (policyRes as any)?.documents ?? [];
            const deptList = Array.isArray(departments) ? departments : (departments as any)?.rows ?? [];
            const userList = Array.isArray(users) ? users : (users as any)?.rows ?? [];

            if (deptList.length > 0 || userList.length > 0) {
                const deptNames = deptList.map((d: any) => d.name || d.departmentName).filter(Boolean);
                const roleGroups: Record<string, string[]> = {};
                userList.forEach((u: any) => {
                    const role = u.role || 'MEMBER';
                    if (!roleGroups[role]) roleGroups[role] = [];
                    roleGroups[role].push(u.fullName || u.username || u.name || u.id);
                });
                const roleLines = Object.entries(roleGroups)
                    .map(([role, names]) => `  - ${role}: ${names.slice(0, 5).join(', ')}${names.length > 5 ? ` 외 ${names.length - 5}명` : ''}`)
                    .join('\n');
                orgContext = [
                    deptNames.length > 0 ? `부서 목록: ${deptNames.join(', ')}` : '',
                    roleLines ? `역할별 구성원:\n${roleLines}` : '',
                ].filter(Boolean).join('\n');
            }

            const formatDocs = (docs: any[]) =>
                docs
                    .map((d: any) => {
                        const title = d.title || d.name || '(제목 없음)';
                        const content = (d.contentPreview || d.content || '').trim();
                        return content ? `### ${title}\n${content}` : `### ${title}`;
                    })
                    .join('\n\n');

            const hierarchyText = formatDocs(hierarchyDocs);
            const policyText = formatDocs(policyDocs);

            if (hierarchyText || policyText) {
                policyContext = [
                    hierarchyText ? `[계층/보고 체계]\n${hierarchyText}` : '',
                    policyText ? `[사내 정책/규정]\n${policyText}` : '',
                ].filter(Boolean).join('\n\n');
            }
        }
    } catch (ctxErr) {
        console.warn('[AI Center] Failed to load org/policy context, proceeding without it:', ctxErr);
    }

    const prompt = `
당신은 기업용 워크플로우 자동화 설계 전문가입니다.
아래 데이터와 회사 조직/정책 정보를 분석하여, 이 유형의 데이터가 등록될 때마다 자동으로 실행할 재사용 가능한 워크플로우 템플릿을 설계해 주세요.

중요: 알림 대상(notify), 태스크 담당자(assigneeRole), 결재 체인(approvalChain)은 반드시 아래 [조직 구조] 및 [정책] 문서에 실제 등장하는 직위/역할명을 사용하세요.
- 조직도에 특정 업무를 담당하는 직위가 명시되어 있다면 그 직위를 사용하세요.
- 정책 문서에 승인 절차나 담당자가 명시되어 있다면 그 내용을 우선 반영하세요.
- 결재 체인(approvalChain)은 하위 직위에서 상위 직위 순서로 나열합니다.
- 조직 정보가 없는 경우에만 ADMIN, EDITOR 같은 일반 역할을 사용하세요.

[데이터 정보]
- 레포트 ID: ${reportId}
- 카테고리: ${category}
- 데이터 필드: ${dataFields.join(', ')}
- 샘플 데이터: ${JSON.stringify(rowData)}

${orgContext ? `[조직 구조]\n${orgContext}\n` : ''}
${policyContext ? `${policyContext}\n` : ''}
[워크플로우 구조 규칙]
- stages 배열은 순서대로 실행됩니다 (스테이지 0 → 1 → 2 ...)
- 같은 스테이지 내 actions는 병렬 실행됩니다
- approve 액션이 있는 스테이지에서 실행이 일시 중단됩니다 (결재 완료 후 다음 스테이지 진행)

[액션 종류]
- create_task: 후속 업무 태스크 생성
  { "type": "create_task", "title": "...", "assigneeRole": "직위명", "dueDays": 숫자 }
  또는 데이터 필드를 마감일로 사용: { "type": "create_task", "title": "...", "assigneeRole": "직위명", "deadline": { "ref": "필드명" } }
- approve: 결재/승인 게이트 (이 스테이지에서 실행 일시 중단)
  { "type": "approve", "approvalChain": [ { "role": "하위직위", "name": "이름" }, { "role": "상위직위", "name": "이름" } ] }
- update_status: 워크플로우 진행 상태 표시
  { "type": "update_status", "value": "검토중" | "승인완료" | "반려" | "처리완료" }

[응답 형식 - 반드시 아래 JSON만 응답]
{
  "label": "워크플로우 이름 (한국어, 50자 이내)",
  "inputs": ["이 워크플로우를 트리거할 데이터 타입 키워드 배열 (예: ${category}, ${dataFields[0] || 'data'})"],
  "notify": ["워크플로우 시작 시 알림받을 역할명 배열"],
  "stages": [
    {
      "actions": [
        { "type": "액션종류", "파라미터": "값" }
      ]
    }
  ],
  "reasoning": "이 워크플로우를 설계한 이유와 조직 정책/계층 근거 (한국어)"
}
`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.warn('[AI Center] Could not parse workflow suggestion from AI response.');
        return;
    }

    const suggestion = JSON.parse(jsonMatch[0]);

    // Flatten stage-based structure to { actionId, params, stage, position } for storage
    const stages: Array<{ actions: Array<{ type: string; [key: string]: any }> }> =
        suggestion.stages || [];
    const flatActions = stages.flatMap((stage, stageIdx) =>
        (stage.actions || []).map((action: any, posIdx: number) => {
            const { type, ...params } = action;
            return { actionId: type, params, stage: stageIdx, position: posIdx };
        })
    );

    // Create workflow with empty actions array (API requires the field),
    // then add each action step individually via addWorkflowAction so actionId is stored correctly.
    const createdWorkflow = await createWorkflow({
        label: suggestion.label,
        inputTypes: suggestion.inputs || [],
        notify: suggestion.notify || [],
        hints: [`report:${reportId}`, `category:${category}`],
        outputTables: [reportId],
        triggerTable: reportId,
        actions: [],
        status: 'suggested',
        suggestedBy: 'ai',
    });

    // Add each action step individually via addWorkflowAction so actionId is stored correctly
    const workflowId: string = createdWorkflow?.id ?? createdWorkflow?.workflow?.id;
    if (workflowId && flatActions.length > 0) {
        for (const action of flatActions) {
            await addWorkflowAction(workflowId, action.actionId, action.params ?? {}, action.stage, action.position);
        }
        console.log(`[AI Center] New workflow suggested: "${suggestion.label}" (${flatActions.length} actions across ${stages.length} stage(s))`);
    } else {
        console.warn(`[AI Center] Workflow created but could not add actions — workflowId=${workflowId}, actions=${flatActions.length}`);
    }
}

/**
 * 특정 레포트에 데이터가 추가될 때 워크플로우 분석을 시작합니다.
 *
 * Layer 1 (기존): 행별 AI Steering — 각 신규 행에 대해 일회성 추천 생성
 * Layer 2 (신규): AI Center 워크플로우 — 스테이지 기반 재사용 템플릿 실행 또는 제안
 */
export async function triggerWorkflow(reportId: string, rowData: any, creatorId: string) {
    const fsSync = require('fs');
    const wfLog = (msg: string) => {
        const line = `[${new Date().toISOString()}] ${msg}\n`;
        console.log(msg);
        fsSync.appendFileSync('workflow_trace.txt', line);
    };

    wfLog(`[Workflow Engine] Triggered for Report: ${reportId}`);

    // ── Layer 1: 행별 AI Steering (기존) ──────────────────────────────────────
    try {
        const { recommendWorkflowAction } = await import('@/app/actions/workflow-steering');
        const rows = await queryTable('dashboard_data', {
            filters: { reportId },
            limit: 1,
            orderBy: 'createdAt',
            orderDirection: 'DESC',
        });
        const rowsArr = Array.isArray(rows) ? rows : (rows as any)?.rows ?? [];
        const latestRowId = rowsArr[0]?.id;
        if (latestRowId) {
            await recommendWorkflowAction(reportId, latestRowId, rowData);
            wfLog(`[Layer 1] Per-row steering recommendation queued.`);
        }
    } catch (err) {
        wfLog(`[Layer 1] Steering error: ${err}`);
    }

    // ── Layer 2: AI Center 스테이지 워크플로우 ─────────────────────────────────
    try {
        const dataFields = Object.keys(rowData).filter(k => !k.startsWith('__'));
        const allWorkflows = await listWorkflows();
        const wfArr = Array.isArray(allWorkflows) ? allWorkflows : (allWorkflows as any)?.workflows ?? (allWorkflows as any)?.rows ?? [];
        const matching = findMatchingWorkflows(wfArr, reportId, dataFields);

        if (matching.length > 0) {
            wfLog(`[Layer 2] ${matching.length} active workflow(s) matched. Starting runs...`);
            for (const wf of matching) {
                await startWorkflowRun(wf, reportId, rowData);
            }
        } else {
            wfLog(`[Layer 2] No active workflows matched. Requesting AI suggestion...`);
            await suggestWorkflowToAICenter(reportId, rowData);
        }
    } catch (err) {
        wfLog(`[Layer 2] AI Center workflow error: ${err}`);
    }
}
