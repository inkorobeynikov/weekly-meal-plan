/**
 * Quick stats for the imported recipe pool (Phase 13).
 *
 * Usage: pnpm pool-stats
 */
import './load-env.js'
import { eq, sql } from 'drizzle-orm'
import { db, recipes } from '@meal-planner/db'

async function main(): Promise<void> {
  const rows = await db
    .select({
      cuisine: recipes.cuisine,
      count: sql<number>`count(*)::int`,
    })
    .from(recipes)
    .where(eq(recipes.source, 'imported'))
    .groupBy(recipes.cuisine)
    .orderBy(sql`count(*) desc`)
  const total = rows.reduce((acc, r) => acc + r.count, 0)
  console.log(`imported pool size: ${total}`)
  for (const r of rows) console.log(`- ${r.cuisine ?? '(none)'}: ${r.count}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
