const db = require('./src/db');
const fs = require('fs');

async function checkTables() {
    let output = "";
    try {
        const [rows] = await db.execute("SHOW TABLES");
        const tables = rows.map(r => Object.values(r)[0]);
        output += `Tables in database: ${JSON.stringify(tables)}\n`;

        const tablesToCheck = ['bookings', 'booking_logs', 'rooms', 'users'];
        for (const table of tablesToCheck) {
            if (tables.includes(table)) {
                const [countRows] = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
                output += `Table ${table} exists with ${countRows[0].count} rows.\n`;

                const [cols] = await db.execute(`DESCRIBE ${table}`);
                output += `Columns in ${table}: ${cols.map(c => c.Field).join(', ')}\n`;
            } else {
                output += `Table ${table} is MISSING.\n`;
            }
        }
    } catch (error) {
        output += `Failed to check tables: ${error.message}\n`;
    } finally {
        fs.writeFileSync('db_check_result.txt', output);
        process.exit();
    }
}

checkTables();
