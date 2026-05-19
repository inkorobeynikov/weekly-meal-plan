import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  // Don't throw at import time in environments where the DB isn't reachable
  // (e.g. typecheck, tooling). Throw lazily when the client is actually used.
  console.warn('[db] DATABASE_URL is not set — DB queries will fail at runtime')
}

const queryClient = postgres(connectionString ?? '', {
  max: 10,
  idle_timeout: 20,
})

export const db = drizzle(queryClient, { schema })
export type DB = typeof db
