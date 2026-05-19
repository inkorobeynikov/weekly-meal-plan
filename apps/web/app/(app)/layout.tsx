'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Frame, TabBar, type TabId } from '@meal-planner/ui'

const TAB_TO_PATH: Record<TabId, string> = {
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
  const pathname = usePathname() ?? '/plan'
  const router = useRouter()
  const active = pathnameToTab(pathname)

  return (
    <Frame>
      {children}
      <TabBar active={active} onSelect={(id) => router.push(TAB_TO_PATH[id])} />
    </Frame>
  )
}
