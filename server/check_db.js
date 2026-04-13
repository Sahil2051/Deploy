const db = require('./src/db');

async function checkTables() {
    try {
        const [rows] = await db.execute("SHOW TABLES");
        console.log("Tables in database:", rows.map(r => Object.values(r)[0]));

        const tablesToCheck = ['bookings', 'booking_logs', 'rooms', 'users'];
        for (const table of tablesToCheck) {
            try {
                const [cols] = await db.execute(`DESCRIBE ${table}`);
                console.log(`\nStructure of ${table}:`);
                console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key })));
            } catch (err) {
                console.error(`\nTable ${table} is MISSING or inaccessible:`, err.message);
            }
        }
    } catch (error) {
        console.error("Failed to check tables:", error);
    } finally {
        process.exit();
    }
}

checkTables();
