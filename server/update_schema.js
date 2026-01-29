
const db = require('./src/db');

async function updateSchema() {
    try {
        console.log('Adding photos column to rooms table...');
        // We use TEXT or JSON. Let's use JSON if possible, but TEXT is safer for compatibility if we are unsure of MySQL version.
        // The user mentioned `mysql2`.
        // Let's check if column exists first? 
        // Or just try ALTER IGNORE? No.
        // Simple ADD COLUMN IF NOT EXISTS is not standard in ALL mysql versions (only newer ones).
        // Better to just run it and catch error if it exists.

        await db.execute(`
      ALTER TABLE rooms
      ADD COLUMN photos JSON
    `);
        console.log('Successfully added photos column (JSON type).');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Column photos already exists. Skipping.');
        } else {
            console.error('Failed to add column:', error);
            // Fallback to TEXT if JSON not supported?
            // console.log('Trying TEXT type...');
            // await db.execute('ALTER TABLE rooms ADD COLUMN photos TEXT');
        }
    } finally {
        process.exit();
    }
}

updateSchema();
