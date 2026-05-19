import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'

// Functions will be registered here as the product grows.
const functions: Parameters<typeof serve>[0]['functions'] = []

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
