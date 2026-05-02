import { createTable, insertRows } from './egdesk-helpers';

async function restore() {
    const schema = [
        { name: 'projectId', type: 'TEXT' },
        { name: 'templateId', type: 'TEXT' },
        { name: 'sourceTableId', type: 'TEXT' },
        { name: 'mappingConfig', type: 'TEXT' },
        { name: 'uiSettings', type: 'TEXT' },
        { name: 'rbacRoles', type: 'TEXT' },
        { name: 'createdBy', type: 'TEXT' },
        { name: 'createdAt', type: 'TEXT' },
        { name: 'updatedAt', type: 'TEXT' }
    ];

    await createTable('Micro App Config', schema, { 
        tableName: 'micro_app_config',
        uniqueKeyColumns: ['projectId']
    });

    const rows = [
        {
            projectId: '131bd111-21dd-46ee-9c57-1342b2913049',
            templateId: 'custom-app',
            sourceTableId: 'finance-hub-bank-table,finance-hub-card-table,finance-hub-promissory-table',
            mappingConfig: '[]',
            uiSettings: JSON.stringify({ theme: 'blue' }),
            rbacRoles: JSON.stringify(['CEO', 'ADMIN']),
            createdBy: '1',
            createdAt: '2026-04-26T12:11:35.004Z',
            updatedAt: '2026-04-26T14:00:20.156Z'
        }
    ];

    await insertRows('micro_app_config', rows);
    console.log('Restored micro_app_config');
}

restore();
