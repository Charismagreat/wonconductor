import { deleteTable, createTable } from './egdesk-helpers';

async function run() {
  try {
    console.log('Attempting to delete table...');
    await deleteTable('micro_app_config');
    console.log('Successfully deleted table micro_app_config');
  } catch (e) {
    console.error('Delete table error (might be expected if missing):', e.message);
  }

  try {
    console.log('Creating table micro_app_config...');
    await createTable('Micro App Config', [
      { name: 'id', type: 'TEXT', notNull: true },
      { name: 'projectId', type: 'TEXT', notNull: true },
      { name: 'templateId', type: 'TEXT' },
      { name: 'sourceTableId', type: 'TEXT' },
      { name: 'mappingConfig', type: 'TEXT' }, // JSON string
      { name: 'uiSettings', type: 'TEXT' },    // JSON string
      { name: 'rbacRoles', type: 'TEXT' },     // JSON string
      { name: 'createdBy', type: 'TEXT' },
      { name: 'createdAt', type: 'TEXT' },
      { name: 'updatedAt', type: 'TEXT' }
    ], { 
      tableName: 'micro_app_config', 
      uniqueKeyColumns: ['id'] 
    });
    console.log('Successfully created table micro_app_config');
  } catch (e) {
    console.error('Create table error:', e.message);
  }
}

run();
