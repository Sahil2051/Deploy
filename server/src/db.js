const mysql = require('mysql2/promise')

const createPool = () => {
  const host = process.env.MYSQL_HOST || '127.0.0.1'
  const user = process.env.MYSQL_USER || 'root'
  const database = process.env.MYSQL_DB || 'shelter_auth'
  const port = Number(process.env.MYSQL_PORT ?? 3306)
  const password = process.env.MYSQL_PASSWORD || ''

  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })
}

const pool = createPool()

module.exports = pool

