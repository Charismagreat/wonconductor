import { getUnifiedTableSchema } from './src/app/actions/schema-registry';

async function main() {
    const ids = [
        'hometax_sales_exempt_invoices',
        'hometax_purchase_exempt_invoices'
    ];

    for (const id of ids) {
        console.log(`\n=== Schema for ${id} ===`);
        const schema = await getUnifiedTableSchema(id);
        console.log(JSON.stringify(schema, null, 2));
    }
}

main().catch(console.error);
