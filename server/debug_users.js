const mysql = require('mysql2/promise');

async function check() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'shelter_auth'
    });

    try {
        const [rows] = await connection.execute('SELECT id, full_name, email, is_premium, premium_until, premium_plan FROM users');
        console.log('--- ALL USERS ---');
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

check();
