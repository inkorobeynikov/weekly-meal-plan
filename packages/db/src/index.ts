export * from './schema.js'
export * from './client.js'
export * from './auth-schema.js'
// Re-export common query helpers so app code can build Drizzle queries without
// taking a direct dependency on `drizzle-orm` (keeps a single ORM instance).
export { eq, and, or, sql } from 'drizzle-orm'
