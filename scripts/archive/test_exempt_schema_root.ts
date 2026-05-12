import { getUnifiedTableSchema } from './src/app/actions/schema-registry';

async function test() {
    const ids = [
        'hometax_sales_exempt_invoices',
        'hometax_purchase_exempt_invoices'
    ];

    for (const id of ids) {
        console.log(`\n--- Testing getUnifiedTableSchema for ${id} ---`);
        try {
            const schema = await getUnifiedTableSchema(id);
            console.log(`Result for ${id} (${schema.length} columns):`);
            console.log(JSON.stringify(schema, null, 2).slice(0, 500) + '...');
        } catch (error) {
            console.error(`Failed for ${id}:`, error.message);
        }
    }
}

test();
