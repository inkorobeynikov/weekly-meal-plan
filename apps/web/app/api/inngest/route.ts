import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { planGenerate } from './functions/plan-generate'
import { shoppingGenerate } from './functions/shopping-generate'

const functions: Parameters<typeof serve>[0]['functions'] = [planGenerate, shoppingGenerate]

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
