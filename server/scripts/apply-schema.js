const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const fs = require('fs')
const { Client } = require('pg')

const splitStatements = (sql) => {
  const stripped = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  return stripped
    .split(/;\s*(?=\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('Set DATABASE_URL (e.g. from Render Postgres) or PG_* variables.')
    process.exit(1)
  }

  const useSsl =
    process.env.PGSSLMODE === 'require' ||
    process.env.DATABASE_SSL === 'true' ||
    /sslmode=require/i.test(url)

  const schemaPath = path.join(__dirname, '../schema/postgres.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')
  const statements = splitStatements(sql)

  const client = new Client({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  })

  await client.connect()
  try {
    for (const stmt of statements) {
      await client.query(stmt)
    }
    console.log(`Applied ${statements.length} schema statements from postgres.sql`)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
