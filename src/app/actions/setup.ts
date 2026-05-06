'use server';

import { createTable } from '@/egdesk-helpers';
import { SystemConfigService } from '@/lib/services/system-config-service';

/**
 * Server Action to create a table from AI suggested schema during onboarding.
 */
export async function createScaffoldTableAction(tableName: string, schema: any[]) {
    try {
        console.log(`[Scaffold] Creating table: ${tableName}`);
        
        // Convert AI schema to egdesk-helpers format
        const columns = schema.map(col => ({
            name: col.name,
            type: col.type,
            notNull: col.notNull || false
        }));

        // Always inject a 'metadata' column for future-proofing (JSON info, extra fields, etc.)
        columns.push({
            name: 'metadata',
            type: 'TEXT',
            notNull: false
        });

        const result = await createTable({
            tableName: tableName,
            columns: columns
        });

        return { success: true, result };
    } catch (error: any) {
        console.error('[ScaffoldAction] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Checks if the system needs initial setup.
 */
export async function checkSetupRequiredAction() {
    return await SystemConfigService.isSystemSetupRequired();
}

