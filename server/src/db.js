const { Pool } = require('pg')

const toPgPlaceholders = (sql, params) => {
  let i = 0
  const text = sql.replace(/\?/g, () => {
    i += 1
    return `$${i}`
  })
  return { text, values: params }
}

const rewriteMysqlFunctions = (sql) =>
  sql.replace(/\bUTC_TIMESTAMP\(\)/gi, 'NOW()')

const appendReturningId = (sql) => {
  const trimmed = sql.trim()
  if (!/^INSERT\s/i.test(trimmed)) return sql
  if (/\bRETURNING\b/i.test(trimmed)) return sql
  const withoutSemi = sql.replace(/;\s*$/g, '')
  return `${withoutSemi} RETURNING id`
}

const createPool = () => {
  const connectionString = process.env.DATABASE_URL
  const useSsl =
    process.env.PGSSLMODE === 'require' ||
    process.env.DATABASE_SSL === 'true' ||
    (connectionString && /sslmode=require/i.test(connectionString))

  if (connectionString) {
    return new Pool({
      connectionString,
      max: 10,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    })
  }

  const host = process.env.PG_HOST || process.env.MYSQL_HOST || '127.0.0.1'
  const user = process.env.PG_USER || process.env.MYSQL_USER || 'postgres'
  const database = process.env.PG_DATABASE || process.env.MYSQL_DB || 'shelter_auth'
  const port = Number(process.env.PG_PORT || process.env.MYSQL_PORT || 5432)
  const password = process.env.PG_PASSWORD || process.env.MYSQL_PASSWORD || ''

  return new Pool({
    host,
    port,
    user,
    password,
    database,
    max: 10,
  })
}

const pool = createPool()

const formatExecuteResult = (result) => {
  const cmd = result.command
  if (cmd === 'SELECT' || cmd === 'WITH') {
    return [result.rows, undefined]
  }
  if (cmd === 'INSERT') {
    const insertId = result.rows?.[0]?.id
    return [{ insertId: insertId != null ? Number(insertId) : undefined, affectedRows: result.rowCount || 0 }]
  }
  if (cmd === 'UPDATE' || cmd === 'DELETE') {
    return [{ affectedRows: result.rowCount || 0, insertId: 0 }]
  }
  return [result.rows, undefined]
}

const execute = async (sql, params = []) => {
  const normalized = rewriteMysqlFunctions(sql)
  const { text, values } = toPgPlaceholders(normalized, params)
  const finalText = appendReturningId(text)
  const result = await pool.query(finalText, values)
  return formatExecuteResult(result)
}

pool.execute = execute

module.exports = pool
