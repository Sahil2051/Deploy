const mysql = require('mysql2/promise');

async function fix() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'shelter_auth'
    });

    try {
        // 1. Find Anju
        const [rows] = await connection.execute("SELECT id, full_name FROM users WHERE full_name LIKE '%anju%'");
        if (rows.length === 0) {
            console.log('User Anju not found.');
            return;
        }

        const userId = rows[0].id;
        console.log(`Found Anju with ID: ${userId}`);

        // 2. Build premium_until (30 days from now for Resident as an example, or whatever they bought)
        const premiumUntil = new Date();
        premiumUntil.setDate(premiumUntil.getDate() + 30);
        const formattedDate = premiumUntil.toISOString().slice(0, 19).replace('T', ' ');

        // 3. Update status
        const [result] = await connection.execute(
            "UPDATE users SET is_premium = 1, premium_until = ?, premium_plan = 'month' WHERE id = ?",
            [formattedDate, userId]
        );

        console.log('Update result:', result.info || 'Success');

        // 4. Verify
        const [check] = await connection.execute("SELECT id, full_name, is_premium, premium_plan FROM users WHERE id = ?", [userId]);
        console.log('Final State:', check[0]);

    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

fix();
