const { executeSQL } = require('./src/egdesk-helpers');

async function main() {
    process.env.NEXT_PUBLIC_EGDESK_API_URL = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_EGDESK_API_KEY = '7a406902-a90d-4aef-a983-c64320c77084';

    const sql = `
        CREATE TABLE IF NOT EXISTS workspace_attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT NOT NULL,
            checkInTime TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            isLate INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `;

    try {
        console.log("Creating workspace_attendance table...");
        await executeSQL(sql);
        console.log("Table successfully created or already exists.");
    } catch (e) {
        console.error("Failed to create table:", e.message);
    }
}

main();
