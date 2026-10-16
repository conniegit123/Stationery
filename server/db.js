import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()

function useSsl() {
  if (process.env.PGSSL === 'false') return false
  if (process.env.PGSSL === 'true') return true
  if (process.env.VERCEL) return true
  const host = process.env.PGHOST || ''
  return host.includes('neon.tech')
}

function createPool() {
  const ssl = useSsl() ? { rejectUnauthorized: false } : false
  const isServerless = Boolean(process.env.VERCEL)

  if (process.env.DATABASE_URL) {
    return new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl,
      max: isServerless ? 1 : 10,
    })
  }

  return new pg.Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    ssl,
    max: isServerless ? 1 : 10,
  })
}

export const pool = createPool()
