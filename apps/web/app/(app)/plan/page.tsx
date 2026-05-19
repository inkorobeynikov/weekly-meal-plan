'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PlannedMeal, Recipe, WeeklyPlan } from '@meal-planner/db'
import {
  Badge,
  Body,
  Button,
  Card,
  IconCheck,
  IconClock,
  IconEuro,
  IconFlame,
  IconRefresh,
  IconRepeat,
  RestrictionStrip,
  tokens as T,
} from '@meal-planner/ui'
import { ApiError, get, post } from '../../../lib/api-client'

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

const SHORT_DAY_PL = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'] as const

const DIFFICULTY_LABEL: Record<Recipe['difficulty'], string> = {
  easy: 'Łatwe',
  medium: 'Średnie',
  hard: 'Trudne',
}

const COST_LABEL: Record<Recipe['costLevel'], string> = {
  cheap: '€',
  moderate: '€€',
  expensive: '€€€',
}

function formatDay(isoDate: string): { name: string; short: string; day: string } {
  const d = new Date(`${isoDate}T00:00:00Z`)
  const dow = d.getUTCDay()
  return {
    name: DAY_NAMES_PL[dow]!,
    short: SHORT_DAY_PL[dow]!,
    day: String(d.getUTCDate()),
  }
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

export default function PlanPage(): React.JSX.Element {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PlanResponse | null>(null)
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [swappingId, setSwappingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      setLoading(true)
      setError(null)
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
          if (value.plan.status === 'approved') {
            router.replace('/plan/approved')
            return
          }
          setData(value)
        } else {
          const err = planResult.reason
          if (err instanceof ApiError && err.status === 404) {
            setData(null)
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load plan')
          }
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

  async function handleGenerate(): Promise<void> {
    setGenerating(true)
    try {
      await post('/api/plans/generate')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation')
      setGenerating(false)
    }
  }

  async function handleApprove(): Promise<void> {
    if (!data) return
    setApproving(true)
    try {
      await post(`/api/plans/${data.plan.id}/approve`)
      router.push('/plan/approved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve plan')
      setApproving(false)
    }
  }

  async function handleSwap(mealId: string): Promise<void> {
    if (!data) return
    setSwappingId(mealId)
    try {
      const result = await post<{ meal: PlannedMeal }>(
        `/api/plans/${data.plan.id}/meals/${mealId}/replace`,
      )
      // Refetch to get the new recipe joined in
      const fresh = await get<PlanResponse>('/api/plans/current')
      setData(fresh)
      void result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replace meal')
    } finally {
      setSwappingId(null)
    }
  }

  if (loading) return <SkeletonPlan />

  if (!data) {
    return (
      <EmptyState
        generating={generating}
        error={error}
        restrictions={restrictions}
        onGenerate={handleGenerate}
      />
    )
  }

  return (
    <Body top={6} bottom={140}>
      <div style={{ padding: '6px 4px 14px' }}>
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

        {data.plan.aiReasoningSummary && (
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              borderRadius: 14,
              background: '#FFFFFF',
              border: `1px solid ${T.line}`,
              display: 'flex',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                flexShrink: 0,
                background: T.ink,
                color: T.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              ai
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.45, color: T.ink2 }}>
              {data.plan.aiReasoningSummary}
            </div>
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <RestrictionStrip
            items={restrictions.length > 0 ? restrictions : ['Brak ograniczeń']}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.meals.map(({ meal, recipe }) => (
          <DayCard
            key={meal.id}
            meal={meal}
            recipe={recipe}
            swapping={swappingId === meal.id}
            onSwap={() => handleSwap(meal.id)}
          />
        ))}
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
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

      <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
        <Button
          variant="ghost"
          full={false}
          icon={<IconRefresh />}
          onClick={handleGenerate}
          style={{ flex: '0 0 auto', padding: '0 18px' }}
        >
          {generating ? 'Generowanie…' : 'Odrzuć i generuj'}
        </Button>
        <Button
          variant="primary"
          icon={<IconCheck />}
          onClick={handleApprove}
          style={{ flex: 1 }}
        >
          {approving ? 'Zatwierdzanie…' : 'Zatwierdź plan'}
        </Button>
      </div>
    </Body>
  )
}

function DayCard({
  meal,
  recipe,
  swapping,
  onSwap,
}: {
  meal: PlannedMeal
  recipe: Recipe
  swapping: boolean
  onSwap: () => void
}): React.JSX.Element {
  const dayInfo = formatDay(String(meal.date))
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div
          style={{
            width: 46,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            padding: '6px 0',
            background: T.surface2,
            color: T.ink2,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            {dayInfo.short}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
            {dayInfo.day}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 600,
              lineHeight: 1.2,
              color: T.ink,
              letterSpacing: -0.2,
            }}
          >
            {swapping ? 'Generowanie…' : recipe.title}
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
            <Badge tone="neutral" icon={<IconFlame />} size="sm">
              {DIFFICULTY_LABEL[recipe.difficulty]}
            </Badge>
            <Badge tone="neutral" icon={<IconEuro />} size="sm">
              {COST_LABEL[recipe.costLevel]}
            </Badge>
            {meal.leftoversPlanned && (
              <Badge tone="blue" icon={<IconRepeat />} size="sm">
                Reszki
              </Badge>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              onClick={onSwap}
              disabled={swapping}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                background: 'transparent',
                border: `1px solid ${T.line2}`,
                color: T.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: swapping ? 'wait' : 'pointer',
                opacity: swapping ? 0.6 : 1,
              }}
            >
              <IconRefresh size={14} strokeWidth={2} />
              Zamień
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function EmptyState({
  generating,
  error,
  restrictions,
  onGenerate,
}: {
  generating: boolean
  error: string | null
  restrictions: string[]
  onGenerate: () => void
}): React.JSX.Element {
  return (
    <Body top={6} bottom={140}>
      <div style={{ padding: '6px 4px 14px' }}>
        <h1
          style={{
            margin: '2px 0 0',
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.05,
            color: T.ink,
          }}
        >
          Plan na ten tydzień
        </h1>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            color: T.muted,
            lineHeight: 1.45,
          }}
        >
          Nie masz jeszcze planu na ten tydzień. Wygeneruj nowy, dopasowany do
          Twojej rodziny.
        </p>
        <div style={{ marginTop: 14 }}>
          <RestrictionStrip
            items={restrictions.length > 0 ? restrictions : ['Brak ograniczeń']}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            margin: '12px 0',
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

      <div style={{ marginTop: 32 }}>
        <Button
          variant="primary"
          icon={<IconRefresh />}
          onClick={onGenerate}
        >
          {generating ? 'Generowanie…' : 'Generuj plan na ten tydzień'}
        </Button>
        {generating && (
          <p
            style={{
              marginTop: 12,
              textAlign: 'center',
              fontSize: 12.5,
              color: T.muted,
            }}
          >
            Może to potrwać minutę. Odśwież stronę, gdy plan będzie gotowy.
          </p>
        )}
      </div>
    </Body>
  )
}

function SkeletonPlan(): React.JSX.Element {
  return (
    <Body top={6} bottom={140}>
      <div style={{ padding: '6px 4px 14px' }}>
        <div
          style={{
            width: 160,
            height: 14,
            borderRadius: 6,
            background: T.surface2,
          }}
        />
        <div
          style={{
            marginTop: 8,
            width: 220,
            height: 28,
            borderRadius: 8,
            background: T.surface2,
          }}
        />
        <div
          style={{
            marginTop: 14,
            height: 44,
            borderRadius: 999,
            background: T.surface2,
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 96,
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
