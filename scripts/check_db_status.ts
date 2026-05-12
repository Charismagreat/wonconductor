import { callUserDataTool } from "@/egdesk-helpers";

async function checkSchema() {
  try {
    console.log("--- Checking 'user' table schema ---");
    const result = await callUserDataTool('user_data_get_schema', { tableName: 'user' });
    console.log(JSON.stringify(result, null, 2));

    console.log("\n--- Checking database read-only status ---");
    // List tables often returns global metadata
    const tables = await callUserDataTool('user_data_list_tables', {});
    const userTableMetadata = tables?.tables?.find((t: any) => t.tableName === 'user');
    console.log('User Table Metadata:', JSON.stringify(userTableMetadata, null, 2));

    console.log("\n--- Counting current users ---");
    const users = await callUserDataTool('user_data_query', { tableName: 'user' });
    console.log('Current User Count:', users?.rows?.length || 0);
    if (users?.rows) {
        console.log('User IDs:', users.rows.map((u: any) => u.username).join(', '));
    }

  } catch (error) {
    console.error("Error during check:", error);
  }
}

checkSchema();
