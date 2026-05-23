'use client'

import { usePathname, useRouter } from 'next/navigation'
import { TabBar, type TabId } from '@meal-planner/ui'
import { AuthGate } from './auth-gate'

const TAB_PATHS: Record<TabId, string> = {
  plan: '/plan',
  shopping: '/shopping',
  recipes: '/recipes',
  family: '/family',
}

function pathnameToTab(pathname: string): TabId {
  if (pathname.startsWith('/shopping')) return 'shopping'
  if (pathname.startsWith('/recipes')) return 'recipes'
  if (pathname.startsWith('/family')) return 'family'
  return 'plan'
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const pathname = usePathname()
  const router = useRouter()
  const active = pathnameToTab(pathname ?? '/plan')

  return (
    <AuthGate>
      <div
        style={{
          position: 'relative',
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          background: '#FBF7F1',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 84 }}>
          {children}
        </div>
        <TabBar active={active} onSelect={(id) => router.push(TAB_PATHS[id])} />
      </div>
    </AuthGate>
  )
}
