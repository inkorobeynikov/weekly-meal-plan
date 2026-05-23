'use client'

import { useEffect, useState } from 'react'
import { getToken, setToken } from '../../lib/api-client'

// Minimal shape of the Telegram Mini App SDK we rely on (loaded in root layout).
interface TelegramWebApp {
  initData: string
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

type GateState = 'checking' | 'authed' | 'no-telegram' | 'error'

async function authenticate(initData: string): Promise<boolean> {
  const res = await fetch('/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ initData }),
  })
  if (!res.ok) return false
  const data = (await res.json().catch(() => null)) as { token?: string } | null
  // Server also sets an HttpOnly cookie; storing the token lets us send it as a
  // Bearer header on later API calls (cookie is not readable from JS).
  if (data?.token) setToken(data.token)
  return true
}

export function AuthGate({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [state, setState] = useState<GateState>('checking')

  useEffect(() => {
    let cancelled = false

    async function run(): Promise<void> {
      // Already authenticated in this browser/webview from a previous open.
      if (getToken()) {
        setState('authed')
        return
      }

      const tg = window.Telegram?.WebApp
      if (tg) {
        try {
          tg.ready()
          tg.expand()
        } catch {
          /* SDK present but not in a Telegram context */
        }
      }

      const initData = tg?.initData
      if (!initData) {
        setState('no-telegram')
        return
      }

      try {
        const ok = await authenticate(initData)
        if (cancelled) return
        setState(ok ? 'authed' : 'error')
      } catch {
        if (!cancelled) setState('error')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'authed') return <>{children}</>

  const message =
    state === 'checking'
      ? 'Ładowanie…'
      : state === 'no-telegram'
        ? 'Otwórz aplikację przez przycisk w bocie na Telegramie, aby zobaczyć plan.'
        : 'Nie udało się zalogować. Otwórz aplikację ponownie z Telegrama.'

  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
        color: '#4A4A4A',
        fontSize: 15,
        lineHeight: 1.5,
        background: '#FBF7F1',
      }}
    >
      {message}
    </div>
  )
}
