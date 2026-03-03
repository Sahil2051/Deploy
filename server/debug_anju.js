const mysql = require('mysql2/promise');

async function check() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'shelter_auth'
    });

    try {
        const [rows] = await connection.execute("SELECT id, full_name, email, is_premium, premium_until, premium_plan FROM users WHERE full_name LIKE '%anju%' OR full_name LIKE '%didi%'");
        console.log('--- TARGET USERS ---');
        console.log(JSON.stringify(rows, null, 2));

        const [all] = await connection.execute("SELECT count(*) as count FROM users");
        console.log('Total users:', all[0].count);

        const [premium] = await connection.execute("SELECT count(*) as count FROM users WHERE is_premium = 1");
        console.log('Premium users:', premium[0].count);

    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

check();
