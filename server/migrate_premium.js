
const db = require('./src/db');

async function migratePremium() {
    try {
        console.log('Migrating database for Premium Features...');

        // 1. Update Users Table
        console.log('Updating users table...');
        try {
            await db.execute('ALTER TABLE users ADD COLUMN is_premium TINYINT(1) DEFAULT 0');
            console.log('Added is_premium column.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') console.log('is_premium column already exists.');
            else throw err;
        }

        try {
            await db.execute('ALTER TABLE users ADD COLUMN premium_until DATETIME DEFAULT NULL');
            console.log('Added premium_until column.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') console.log('premium_until column already exists.');
            else throw err;
        }

        // 2. Update Rooms Table
        console.log('Updating rooms table...');
        try {
            await db.execute('ALTER TABLE rooms ADD COLUMN latitude DECIMAL(10, 8) DEFAULT NULL');
            console.log('Added latitude column.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') console.log('latitude column already exists.');
            else throw err;
        }

        try {
            await db.execute('ALTER TABLE rooms ADD COLUMN longitude DECIMAL(11, 8) DEFAULT NULL');
            console.log('Added longitude column.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') console.log('longitude column already exists.');
            else throw err;
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

migratePremium();
