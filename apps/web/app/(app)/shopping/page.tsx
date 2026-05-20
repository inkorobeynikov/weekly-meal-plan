'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PromotionFact, ShoppingList, ShoppingListItem } from '@meal-planner/db'
import type { BuyTiming, ItemStatus } from '@meal-planner/shared'
import { Body, Card, IconCart, IconCheck, tokens as T } from '@meal-planner/ui'
import { ApiError, get, patch } from '../../../lib/api-client.js'

type ShoppingItem = ShoppingListItem & { promoHints?: PromotionFact[] }
type ShoppingResponse = { list: ShoppingList; items: ShoppingItem[] } | null

const BUY_TIMING_LABEL: Record<BuyTiming, string> = {
  main_shop: 'Na główne zakupy',
  later: 'Na później',
  optional_if_near_store: 'Opcjonalne',
}

const BUY_TIMING_ORDER: readonly BuyTiming[] = ['main_shop', 'later', 'optional_if_near_store']

function isBought(status: ItemStatus): boolean {
  return status === 'bought'
}

function formatRange(createdAt: string | Date): string {
  const start = new Date(createdAt)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  const fmt = (d: Date): string =>
    d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${fmt(start)} – ${fmt(end)}`
}

export default function ShoppingPage(): React.JSX.Element {
  const [data, setData] = useState<ShoppingResponse | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    get<ShoppingResponse>('/api/shopping/current')
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof ApiError ? err.message : 'Nie udało się załadować listy'
        setError(msg)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const groupedByTiming = useMemo(() => {
    if (!data) return new Map<BuyTiming, Map<string, ShoppingItem[]>>()
    const byTiming = new Map<BuyTiming, Map<string, ShoppingItem[]>>()
    for (const item of data.items) {
      const timing = item.buyTiming
      let byCat = byTiming.get(timing)
      if (!byCat) {
        byCat = new Map()
        byTiming.set(timing, byCat)
      }
      const cat = item.category || 'Inne'
      const list = byCat.get(cat) ?? []
      list.push(item)
      byCat.set(cat, list)
    }
    return byTiming
  }, [data])

  async function toggleItem(item: ShoppingItem): Promise<void> {
    if (!data) return
    const nextStatus: ItemStatus = isBought(item.status) ? 'pending' : 'bought'
    // Optimistic update
    setData({
      ...data,
      items: data.items.map((it) => (it.id === item.id ? { ...it, status: nextStatus } : it)),
    })
    try {
      await patch(`/api/shopping/items/${item.id}`, { status: nextStatus })
    } catch {
      // Roll back
      setData((cur) => {
        if (!cur) return cur
        return {
          ...cur,
          items: cur.items.map((it) =>
            it.id === item.id ? { ...it, status: item.status } : it,
          ),
        }
      })
    }
  }

  if (error) {
    return (
      <Body top={16}>
        <Header weekStart={null} />
        <Card style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Błąd</div>
          <div style={{ color: T.muted, fontSize: 14 }}>{error}</div>
        </Card>
      </Body>
    )
  }

  if (data === undefined) {
    return (
      <Body top={16}>
        <Header weekStart={null} />
        <div style={{ color: T.muted, fontSize: 14 }}>Ładowanie…</div>
      </Body>
    )
  }

  if (!data) {
    return (
      <Body top={16}>
        <Header weekStart={null} />
        <EmptyState />
      </Body>
    )
  }

  return (
    <Body top={12}>
      <Header weekStart={null} />
      <div style={{ color: T.muted, fontSize: 13, marginBottom: 14 }}>
        {formatRange(data.list.createdAt)}
      </div>

      {BUY_TIMING_ORDER.map((timing) => {
        const byCat = groupedByTiming.get(timing)
        if (!byCat || byCat.size === 0) return null
        return (
          <section key={timing} style={{ marginBottom: 24 }}>
            <h2
              style={{
                margin: '0 0 10px',
                fontSize: 15,
                fontWeight: 700,
                color: T.ink2,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {BUY_TIMING_LABEL[timing]}
            </h2>
            {Array.from(byCat.entries()).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: T.muted,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  {cat}
                </div>
                <Card style={{ overflow: 'hidden' }}>
                  {items.map((item, idx) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggleItem(item)}
                      withDivider={idx < items.length - 1}
                    />
                  ))}
                </Card>
              </div>
            ))}
          </section>
        )
      })}
    </Body>
  )
}

function Header({ weekStart: _weekStart }: { weekStart: string | null }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <IconCart size={22} strokeWidth={2} />
      <h1
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: -0.3,
          color: T.ink,
        }}
      >
        Lista zakupów
      </h1>
    </div>
  )
}

function ItemRow({
  item,
  onToggle,
  withDivider,
}: {
  item: ShoppingItem
  onToggle: () => void
  withDivider: boolean
}): React.JSX.Element {
  const bought = isBought(item.status)
  const promoHints = item.promoHints ?? []
  return (
    <div
      style={{
        borderBottom: withDivider ? `1px solid ${T.line}` : 'none',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <span
          aria-checked={bought}
          role="checkbox"
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: `1.5px solid ${bought ? T.sage : T.line2}`,
            background: bought ? T.sage : 'transparent',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {bought ? <IconCheck size={14} strokeWidth={2.4} /> : null}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 15,
            color: bought ? T.faint : T.ink,
            textDecoration: bought ? 'line-through' : 'none',
          }}
        >
          {item.name}
        </span>
        <span
          style={{
            fontSize: 13,
            color: bought ? T.faint : T.muted,
            textDecoration: bought ? 'line-through' : 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {item.quantity}
          {item.unit ? ` ${item.unit}` : ''}
        </span>
      </button>
      {promoHints.length > 0 ? <PromoBadge promos={promoHints} /> : null}
    </div>
  )
}

function PromoBadge({ promos }: { promos: PromotionFact[] }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const retailer = promos[0]?.retailer ?? ''
  return (
    <div style={{ padding: '0 14px 10px 48px', position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 999,
          border: `1px solid ${T.line2}`,
          background: T.surface2,
          color: T.ink2,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        🏷️ Promocja w {retailer}
      </button>
      {open ? (
        <div
          role="tooltip"
          style={{
            marginTop: 6,
            padding: '10px 12px',
            borderRadius: 10,
            border: `1px solid ${T.line}`,
            background: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            maxWidth: 280,
          }}
        >
          {promos.map((promo, i) => (
            <div
              key={promo.id}
              style={{
                marginTop: i === 0 ? 0 : 10,
                paddingTop: i === 0 ? 0 : 10,
                borderTop: i === 0 ? 'none' : `1px solid ${T.line}`,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                {promo.retailer}
                {promo.priceText ? ` — ${promo.priceText}` : ''}
              </div>
              {promo.conditionsText ? (
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>
                  {promo.conditionsText}
                </div>
              ) : null}
              {promo.requiresLoyaltyApp ? (
                <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
                  Wymaga aplikacji lojalnościowej
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function EmptyState(): React.JSX.Element {
  return (
    <Card style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 15, color: T.muted, lineHeight: 1.5 }}>
        Lista zakupów zostanie wygenerowana po zatwierdzeniu planu
      </div>
    </Card>
  )
}
