import type { Config } from 'drizzle-kit'
import { config } from 'dotenv'
import { resolve } from 'node:path'

// drizzle-kit runs with cwd = packages/db, so process.env is not pre-populated
// from the monorepo root .env. Load it explicitly so DATABASE_URL is available
// for `db:migrate` / `db:generate` / `db:studio` without exporting it by hand.
config({ path: resolve(__dirname, '../../.env') })

export default {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
} satisfies Config
