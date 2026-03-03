const db = require('./src/db');

async function checkTables() {
    try {
        const [rows] = await db.execute("SHOW TABLES");
        const tables = rows.map(r => Object.values(r)[0]);
        console.log("Tables in database:", tables);

        const tablesToCheck = ['bookings', 'booking_logs', 'rooms', 'users'];
        for (const table of tablesToCheck) {
            if (tables.includes(table)) {
                const [countRows] = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`Table ${table} exists with ${countRows[0].count} rows.`);
            } else {
                console.log(`Table ${table} is MISSING.`);
            }
        }
    } catch (error) {
        console.error("Failed to check tables:", error);
    } finally {
        process.exit();
    }
}

checkTables();
