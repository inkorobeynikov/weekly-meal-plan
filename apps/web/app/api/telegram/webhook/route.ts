import { webhookCallback } from 'grammy'
import { getBot } from '@meal-planner/bot/bot'

export const POST = webhookCallback(getBot(), 'std/http')
