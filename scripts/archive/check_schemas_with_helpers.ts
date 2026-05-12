import { listTables, listBankProductTables } from './egdesk-helpers';

async function run() {
    console.log('--- [user_data_list_tables] ---');
    try {
        const tables = await listTables();
        const tableList = Array.isArray(tables) ? tables : (tables as any).tables || [];
        console.log(`Total Tables: ${tableList.length}`);
        if (tableList.length > 0) {
            // Check for schema or columns
            const hasAnySchema = tableList.some((t: any) => t.schema || t.columns);
            console.log(`Tables with schema info: ${hasAnySchema ? 'YES' : 'NO'}`);
            if (hasAnySchema) {
                const sample = tableList.find((t: any) => t.schema || t.columns);
                console.log(`Sample Table (${sample.tableName}) Schema:`, (sample.schema || sample.columns).slice(0, 2));
            }
        }
    } catch (e) {
        console.error('listTables failed:', e.message);
    }

    console.log('\n--- [financehub_list_bank_product_tables] ---');
    try {
        const products = await listBankProductTables();
        const productList = Array.isArray(products) ? products : (products as any).tables || [];
        console.log(`Total Products: ${productList.length}`);
        productList.forEach((p: any) => {
            console.log(`- ${p.displayName} (${p.slug}): ${p.columns ? p.columns.length + ' columns' : 'No columns'}`);
        });
    } catch (e) {
        console.error('listBankProductTables failed:', e.message);
    }
}

run().catch(console.error);
