import { queryTable } from "./egdesk-helpers";

async function checkChacho() {
  try {
    console.log("Checking for 'chacho' user using root egdesk-helpers.ts...");
    const result = await queryTable('user', { 
      filters: { username: 'chacho' } 
    });
    
    console.log("Query Result:", JSON.stringify(result, null, 2));
    
    if (result && result.rows && result.rows.length > 0) {
      console.log(`Success: Found ${result.rows.length} record(s) for 'chacho'.`);
      result.rows.forEach((row: any, i: number) => {
        console.log(`[${i+1}] ID: ${row.id}, Username: ${row.username}, CreatedAt: ${row.createdAt}`);
      });
    } else {
      console.log("Not Found: 'chacho' user does not exist in the database.");
    }
    
    // Also list all users to see what's actually there
    console.log("\n--- Current All Users ---");
    const allUsers = await queryTable('user', {});
    console.log("Total Count:", allUsers?.rows?.length || 0);
    allUsers?.rows?.forEach((u: any) => console.log(`- ${u.username} (${u.role})`));

  } catch (error) {
    console.error("Error checking database:", error);
  }
}

checkChacho();
