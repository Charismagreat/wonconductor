const { getTableSchema } = require('./egdesk-helpers');

async function checkSchemas() {
  try {
    console.log('--- hometax_sales_tax_invoices ---');
    const taxSchema = await getTableSchema('hometax_sales_tax_invoices');
    console.log(JSON.stringify(taxSchema, null, 2));

    console.log('\n--- hometax_sales_invoices ---');
    const invoiceSchema = await getTableSchema('hometax_sales_invoices');
    console.log(JSON.stringify(invoiceSchema, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkSchemas();
