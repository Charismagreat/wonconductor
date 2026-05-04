'use server';

import { revalidatePath } from 'next/cache';
import {
    listWorkflows,
    updateWorkflowStatus,
    updateWorkflow,
    listBusinessIdentitySnapshots,
    listKnowledgeDocuments,
} from '@/egdesk-helpers';
import { getSessionAction } from './auth';

/** Fetch all workflows filtered by status */
export async function getWorkflowsByStatusAction(status: 'active' | 'suggested' | 'draft') {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('Unauthorized');
    }
    const all = await listWorkflows();
    return (all as any[]).filter((w: any) => w.status === status);
}

/** Activate a suggested workflow */
export async function activateWorkflowAction(id: string) {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('Unauthorized');
    }
    await updateWorkflowStatus(id, 'active');
    revalidatePath('/workflow/ai-center');
}

/** Discard a suggested workflow (set to draft) */
export async function discardWorkflowAction(id: string) {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('Unauthorized');
    }
    await updateWorkflowStatus(id, 'draft');
    revalidatePath('/workflow/ai-center');
}

/** Deactivate an active workflow (set back to draft) */
export async function deactivateWorkflowAction(id: string) {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('Unauthorized');
    }
    await updateWorkflowStatus(id, 'draft');
    revalidatePath('/workflow/ai-center');
}

/** Debug: fetch hierarchy context (snapshots + hierarchy + policy docs) */
export async function debugFetchHierarchyAction() {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('Unauthorized');
    }

    const snapshotRes = await listBusinessIdentitySnapshots();
    const snapshotId = snapshotRes?.snapshots?.[0]?.id ?? null;

    if (!snapshotId) {
        return { snapshotRes, snapshotId: null, hierarchyDocs: [], policyDocs: [] };
    }

    const [hierarchyRes, policyRes] = await Promise.all([
        listKnowledgeDocuments(snapshotId, 'hierarchy').catch((e: any) => ({ error: e?.message })),
        listKnowledgeDocuments(snapshotId, 'policy').catch((e: any) => ({ error: e?.message })),
    ]);

    return { snapshotId, hierarchyDocs: (hierarchyRes as any)?.documents ?? hierarchyRes, policyDocs: (policyRes as any)?.documents ?? policyRes };
}

/** Update workflow label and inputTypes */
export async function editWorkflowAction(
    id: string,
    data: { label?: string; inputTypes?: string[] }
) {
    const session = await getSessionAction();
    if (!session || (session.role !== 'ADMIN' && session.role !== 'EDITOR')) {
        throw new Error('Unauthorized');
    }
    await updateWorkflow(id, data);
    revalidatePath('/workflow/ai-center');
}
