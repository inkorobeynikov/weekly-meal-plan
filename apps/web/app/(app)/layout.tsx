import Link from 'next/link'

const TABS = [
  { href: '/plan', label: 'Plan' },
  { href: '/shopping', label: 'Zakupy' },
  { href: '/recipes', label: 'Przepisy' },
  { href: '/family', label: 'Rodzina' },
] as const

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 px-4 py-4 pb-20">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 border-t bg-white/95 backdrop-blur dark:bg-black/95">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className="flex items-center justify-center px-2 py-3 text-sm"
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
