import type { NextRequest } from 'next/server'

export async function POST(_req: NextRequest): Promise<Response> {
  // TODO: wire grammY webhook adapter (webhookCallback(bot, 'std/http'))
  // and authenticate using the Telegram secret token header.
  return new Response('ok', { status: 200 })
}
