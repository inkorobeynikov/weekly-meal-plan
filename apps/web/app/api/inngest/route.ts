import { serve } from 'inngest/next'
import { feedbackReminder } from '@meal-planner/bot/jobs/feedback-reminder'
import { inngest } from '@/lib/inngest'
import { planGenerate } from './functions/plan-generate'
import { shoppingGenerate } from './functions/shopping-generate'

const functions: Parameters<typeof serve>[0]['functions'] = [
  planGenerate,
  shoppingGenerate,
  feedbackReminder,
]

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
