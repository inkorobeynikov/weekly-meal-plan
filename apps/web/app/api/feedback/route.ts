import { withAuth } from '../../../lib/auth-middleware.js'

export const POST = withAuth(async () => {
  return Response.json({ ok: true })
})
