/**
 * BetterAuth server instance — the ADDITIVE second auth path for the mobile app.
 *
 * Constructed eagerly. Dev fallbacks keep construction from throwing when the
 * real secrets aren't set: BETTER_AUTH_URL defaults to http://localhost:3000 and
 * the secret / OAuth client ids fall back to placeholders, so importing this file
 * never crashes `next build` / typecheck. Sign-in flows that actually need a real
 * value fail loudly at request time instead. Set the real values via the env for
 * production.
 *
 * NOTE: do NOT wrap `auth` in a Proxy. `toNextJsHandler` (and other better-auth
 * helpers) feature-detect via `'handler' in auth`; a Proxy with an empty target
 * fails that check, gets mistaken for the handler function itself, and throws
 * "auth is not a function" on every /api/auth/* request.
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { bearer } from 'better-auth/plugins'
import { expo } from '@better-auth/expo'
import { db, user, session, account, verification } from '@meal-planner/db'

// Only register a social provider when BOTH its client id and secret are present.
// Registering with empty strings makes BetterAuth log a warning on every request
// and 500 on sign-in attempts, so we omit unconfigured providers entirely.
type SocialProvider = { clientId: string; clientSecret: string }
const socialProviders: Record<string, SocialProvider> = {}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }
}
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  socialProviders.apple = {
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-insecure-secret-change-me',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  emailAndPassword: { enabled: true },
  socialProviders,
  plugins: [expo(), bearer()],
  trustedOrigins: ['mealplanner://'],
})

export type Session = typeof auth.$Infer.Session
