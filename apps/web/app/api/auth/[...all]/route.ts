import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '../../../../lib/auth-server.js'

export const { GET, POST } = toNextJsHandler(auth)
