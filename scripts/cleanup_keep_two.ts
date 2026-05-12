import { queryTable, deleteRows } from './egdesk-helpers';

async function cleanupButTwo() {
    try {
        console.log('Retrieving workspace items...');
        const items = await queryTable('workspace_item', { 
            orderBy: 'createdAt', 
            orderDirection: 'DESC', 
            limit: 1000 
        });

        if (items.length <= 2) {
            console.log('Already 2 or fewer items. No action needed.');
            return;
        }

        const toDeleteIds = items.slice(2).map((r: any) => r.id).filter(Boolean);
        
        console.log(`Keeping items: ${items[0].id}, ${items[1].id}`);
        console.log(`Deleting ${toDeleteIds.length} older items...`);

        for (let i = 0; i < toDeleteIds.length; i += 50) {
            const batch = toDeleteIds.slice(i, i + 50);
            await deleteRows('workspace_item', { ids: batch });
            console.log(`Deleted batch ${i / 50 + 1}...`);
        }

        console.log('Cleanup complete.');
    } catch (e) {
        console.error('Cleanup failed:', e);
    }
}

cleanupButTwo();
