import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { planGenerate } from './functions/plan-generate'
import { shoppingGenerate } from './functions/shopping-generate'
import { retentionTrigger } from './functions/retention-trigger'
import { feedbackReminder } from './functions/feedback-reminder'

const functions: Parameters<typeof serve>[0]['functions'] = [
  planGenerate,
  shoppingGenerate,
  feedbackReminder,
  retentionTrigger,
]

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
