/**
 * Side-effect module: load the root .env BEFORE any workspace package is
 * imported. The db client (packages/db/src/client.ts) captures DATABASE_URL
 * at module-init time, and ESM import hoisting would otherwise initialize it
 * before an inline loadEnvFile call runs. Import this FIRST:
 *
 *   import './load-env.js'
 *   import { ... } from '@meal-planner/domain/...'
 *
 * process.loadEnvFile never overrides variables already present in the
 * environment (same semantics as node --env-file).
 */
import { resolve } from 'node:path'

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(resolve(process.cwd(), '.env'))
  } catch {
    // No .env file — rely on the ambient environment.
  }
}
