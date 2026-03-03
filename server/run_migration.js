const db = require('./src/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'migration_premium_v2.sql'), 'utf8');
        const statements = sql
            .replace(/--.*$/gm, '') // Remove comments
            .split(';')
            .map(s => s.trim())
            .filter(s => s !== '' && !s.toUpperCase().startsWith('USE'));

        for (let statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            try {
                await db.query(statement); // Use query for DDL
            } catch (err) {
                console.error(`Error executing statement: ${err.message}`);
            }
        }
        console.log("Migration process finished.");
    } catch (error) {
        console.error("Migration fatal error:", error);
    } finally {
        process.exit();
    }
}

runMigration();
