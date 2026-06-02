/**
 * Integration test for the BetterAuth email sign-up / sign-in flow.
 *
 * The web app has no test runner configured, so this uses the built-in
 * `node:test` runner (run with `node --test` once a loader for TS is available,
 * e.g. `node --import tsx --test apps/web/__tests__/auth.test.ts`).
 *
 * It requires a live Postgres with the BetterAuth tables migrated, so it SKIPS
 * itself when DATABASE_URL is not set — this keeps CI green without a DB while
 * still typechecking cleanly.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auth } from '../lib/auth-server.js'

const hasDb = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.length > 0

test('BetterAuth email sign-up returns a session token', { skip: !hasDb }, async () => {
  // Unique email per run so re-runs against a persistent DB don't collide.
  const email = `test-${Date.now()}@example.com`
  const password = 'sup3r-secret-pw'

  const signUp = await auth.api.signUpEmail({
    body: { email, password, name: 'Test User' },
    asResponse: true,
  })
  assert.equal(signUp.status, 200, 'sign-up should succeed')

  // A fresh sign-in should also yield a Set-Cookie session token.
  const signIn = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  })
  assert.equal(signIn.status, 200, 'sign-in should succeed')

  const setCookie = signIn.headers.get('set-cookie')
  assert.ok(
    setCookie !== null && setCookie.includes('session_token'),
    'sign-in response should set a session token cookie',
  )
})
