
import { listBankProductTables } from './egdesk-helpers.ts';

async function main() {
    try {
        const res = await listBankProductTables();
        if (res && res.length > 0) {
            console.log('First Bank Product Data:');
            console.log(JSON.stringify(res[0], null, 2));
            console.log('\nTotal items:', res.length);
        } else {
            console.log('No bank products found or response is empty.');
        }
    } catch (e) {
        console.error('Error fetching bank products:', e);
    }
}

main();
