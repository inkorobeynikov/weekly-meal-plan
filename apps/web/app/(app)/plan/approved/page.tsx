'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PlannedMeal, Recipe, WeeklyPlan } from '@meal-planner/db'
import {
  Badge,
  Body,
  Card,
  IconCheck,
  IconClock,
  IconRepeat,
  Placeholder,
  RestrictionStrip,
  tokens as T,
} from '@meal-planner/ui'
import { ApiError, get } from '../../../../lib/api-client'

interface MealWithRecipe {
  meal: PlannedMeal
  recipe: Recipe
}

interface PlanResponse {
  plan: WeeklyPlan
  meals: MealWithRecipe[]
}

interface RestrictionsResponse {
  allergies: string[]
  hardRestrictions: string[]
}

const DAY_NAMES_PL = [
  'Niedziela',
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
] as const

function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  const dow = d.getUTCDay()
  return `${DAY_NAMES_PL[dow]!} · ${d.getUTCDate()}`
}

function formatWeekRange(weekStartDate: string): string {
  const start = new Date(`${weekStartDate}T00:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  const months = [
    'sty', 'lut', 'mar', 'kwi', 'maj', 'cze',
    'lip', 'sie', 'wrz', 'paź', 'lis', 'gru',
  ]
  return `${start.getUTCDate()} ${months[start.getUTCMonth()]} – ${end.getUTCDate()} ${months[end.getUTCMonth()]}`
}

export default function ApprovedPlanPage(): React.JSX.Element {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PlanResponse | null>(null)
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      try {
        const [planResult, restrictionsResult] = await Promise.allSettled([
          get<PlanResponse>('/api/plans/current'),
          get<RestrictionsResponse>('/api/family/restrictions'),
        ])
        if (cancelled) return

        if (restrictionsResult.status === 'fulfilled') {
          const r = restrictionsResult.value
          setRestrictions([...r.allergies, ...r.hardRestrictions])
        }

        if (planResult.status === 'fulfilled') {
          const value = planResult.value
          if (value.plan.status !== 'approved') {
            router.replace('/plan')
            return
          }
          setData(value)
        } else {
          const err = planResult.reason
          if (err instanceof ApiError && err.status === 404) {
            router.replace('/plan')
            return
          }
          setError(err instanceof Error ? err.message : 'Failed to load plan')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [router])

  if (loading || !data) {
    return (
      <Body top={6} bottom={120}>
        <div style={{ padding: '6px 4px 14px' }}>
          <div
            style={{
              width: 200,
              height: 28,
              borderRadius: 8,
              background: T.surface2,
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 140,
                borderRadius: 14,
                background: T.surface,
                border: `1px solid ${T.line}`,
              }}
            />
          ))}
        </div>
      </Body>
    )
  }

  return (
    <Body top={6} bottom={120}>
      <div style={{ padding: '6px 4px 14px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                color: T.muted,
                fontWeight: 600,
                letterSpacing: 0.2,
              }}
            >
              Plan na ten tydzień
            </div>
            <h1
              style={{
                margin: '2px 0 0',
                fontSize: 28,
                fontWeight: 700,
                lineHeight: 1.05,
                color: T.ink,
              }}
            >
              {formatWeekRange(String(data.plan.weekStartDate))}
            </h1>
          </div>
          <Badge tone="sage" icon={<IconCheck />} size="md" strong>
            Zatwierdzony
          </Badge>
        </div>

        <div style={{ marginTop: 14 }}>
          <RestrictionStrip
            items={restrictions.length > 0 ? restrictions : ['Brak ograniczeń']}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            margin: '0 0 12px',
            padding: '10px 14px',
            borderRadius: 12,
            background: T.terraSoft,
            color: T.terraInk,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.meals.map(({ meal, recipe }) => (
          <Card
            key={meal.id}
            onClick={() => router.push(`/recipes/${recipe.id}`)}
            style={{ padding: 14, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', gap: 12 }}>
              <Placeholder
                width={72}
                height={72}
                radius={14}
                label="meal"
                tone="warm"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    color: T.muted,
                  }}
                >
                  {formatDayLabel(String(meal.date))}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 16,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    color: T.ink,
                    letterSpacing: -0.2,
                  }}
                >
                  {recipe.title}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  <Badge tone="amber" icon={<IconClock />} size="sm">
                    {recipe.timeMinutes} min
                  </Badge>
                  {meal.leftoversPlanned && (
                    <Badge tone="blue" icon={<IconRepeat />} size="sm">
                      Reszki
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Body>
  )
}
