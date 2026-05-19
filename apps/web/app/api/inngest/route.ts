import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { planGenerate } from './functions/plan-generate'

const functions: Parameters<typeof serve>[0]['functions'] = [planGenerate]

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
