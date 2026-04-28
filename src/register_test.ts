import { insertRows } from "@/egdesk-helpers";
import { TABLES } from "./egdesk.config";

async function main() {
  const tableDef = TABLES.table1;
  await insertRows("dashboard_master", [{
    id: "test-report-id",
    name: tableDef.displayName,
    sheetName: "Main Database",
    columns: JSON.stringify(tableDef.columns.map(c => ({ name: c, type: "string" }))),
    ownerId: "1", // Use admin user id
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }]);
  console.log("Report registered!");
}

main().catch(console.error);
