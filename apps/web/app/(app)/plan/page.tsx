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
  // Per-meal reason text (shown when the user expands "Zamień" on a card).
  const [reasonByMeal, setReasonByMeal] = useState<Record<string, string>>({})
  // Multi-select mode: pick several meals, give one shared context, regenerate all.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkContext, setBulkContext] = useState('')
  const [bulkRunning, setBulkRunning] = useState(false)

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
    const reason = (reasonByMeal[mealId] ?? '').trim()
    setSwappingId(mealId)
    try {
      await post<{ meal: PlannedMeal }>(
        `/api/plans/${data.plan.id}/meals/${mealId}/replace`,
        reason ? { reason } : undefined,
      )
      const fresh = await get<PlanResponse>('/api/plans/current')
      setData(fresh)
      // Clear the reason input after a successful replace.
      setReasonByMeal((prev) => {
        const next = { ...prev }
        delete next[mealId]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to replace meal')
    } finally {
      setSwappingId(null)
    }
  }

  // Combo: record "dont_repeat" feedback so future plans avoid this recipe,
  // then immediately replace the meal with reason="family disliked this dish".
  async function handleDislikeAndReplace(
    mealId: string,
    recipeId: string,
  ): Promise<void> {
    if (!data) return
    setSwappingId(mealId)
    try {
      await post('/api/feedback', {
        recipeId,
        weeklyPlanId: data.plan.id,
        reaction: 'dont_repeat',
      })
      await post<{ meal: PlannedMeal }>(
        `/api/plans/${data.plan.id}/meals/${mealId}/replace`,
        { reason: 'Family disliked this dish — please propose something quite different.' },
      )
      const fresh = await get<PlanResponse>('/api/plans/current')
      setData(fresh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dislike + replace meal')
    } finally {
      setSwappingId(null)
    }
  }

  function toggleSelected(mealId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(mealId)) next.delete(mealId)
      else next.add(mealId)
      return next
    })
  }

  function toggleSelectMode(): void {
    setSelectMode((on) => {
      if (on) {
        // Leaving select mode → clear staged state so it doesn't leak back in.
        setSelectedIds(new Set())
        setBulkContext('')
      }
      return !on
    })
  }

  async function handleBulkReplace(): Promise<void> {
    if (!data || selectedIds.size === 0) return
    setBulkRunning(true)
    try {
      const mealIds = Array.from(selectedIds)
      const context = bulkContext.trim()
      const result = await post<{ failedCount: number }>(
        `/api/plans/${data.plan.id}/meals/bulk-replace`,
        context ? { mealIds, context } : { mealIds },
      )
      const fresh = await get<PlanResponse>('/api/plans/current')
      setData(fresh)
      setSelectedIds(new Set())
      setBulkContext('')
      setSelectMode(false)
      if (result.failedCount > 0) {
        setError(`Nie udało się zamienić ${result.failedCount} z ${mealIds.length} dań.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk-replace meals')
    } finally {
      setBulkRunning(false)
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

        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={toggleSelectMode}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              background: selectMode ? T.ink : 'transparent',
              color: selectMode ? T.bg : T.ink,
              border: `1px solid ${T.line2}`,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {selectMode ? 'Anuluj zaznaczenie' : 'Wybierz kilka dań'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.meals.map(({ meal, recipe }) => (
          <DayCard
            key={meal.id}
            meal={meal}
            recipe={recipe}
            swapping={swappingId === meal.id}
            reason={reasonByMeal[meal.id] ?? ''}
            onReasonChange={(value) =>
              setReasonByMeal((prev) => ({ ...prev, [meal.id]: value }))
            }
            onSwap={() => handleSwap(meal.id)}
            onDislikeAndReplace={() => handleDislikeAndReplace(meal.id, recipe.id)}
            selectMode={selectMode}
            selected={selectedIds.has(meal.id)}
            onToggleSelect={() => toggleSelected(meal.id)}
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

      {selectMode && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '12px 14px calc(env(safe-area-inset-bottom, 0px) + 14px)',
            background: T.bg,
            borderTop: `1px solid ${T.line}`,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>
            Zaznaczono: {selectedIds.size}
          </div>
          <textarea
            value={bulkContext}
            onChange={(e) => setBulkContext(e.target.value)}
            placeholder={'Kontekst dla AI (opcjonalnie). Np. „nie lubię drożdżówek, więcej ryb, mniej mięsa”'}
            rows={2}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 10,
              border: `1px solid ${T.line2}`,
              fontSize: 13.5,
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <Button
            variant="primary"
            icon={<IconRefresh />}
            onClick={() => {
              if (selectedIds.size === 0 || bulkRunning) return
              void handleBulkReplace()
            }}
          >
            {bulkRunning
              ? `Zamieniam ${selectedIds.size}…`
              : `Zamień zaznaczone (${selectedIds.size})`}
          </Button>
        </div>
      )}
    </Body>
  )
}

function DayCard({
  meal,
  recipe,
  swapping,
  reason,
  onReasonChange,
  onSwap,
  onDislikeAndReplace,
  selectMode,
  selected,
  onToggleSelect,
}: {
  meal: PlannedMeal
  recipe: Recipe
  swapping: boolean
  reason: string
  onReasonChange: (value: string) => void
  onSwap: () => void
  onDislikeAndReplace: () => void
  selectMode: boolean
  selected: boolean
  onToggleSelect: () => void
}): React.JSX.Element {
  const dayInfo = formatDay(String(meal.date))
  const [reasonOpen, setReasonOpen] = useState(false)
  return (
    <Card
      style={{
        padding: 14,
        border: selected ? `2px solid ${T.ink}` : undefined,
        cursor: selectMode ? 'pointer' : 'default',
      }}
      onClick={selectMode ? onToggleSelect : undefined}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        {selectMode && (
          <div
            style={{
              width: 22,
              height: 22,
              flexShrink: 0,
              borderRadius: 6,
              border: `1.5px solid ${selected ? T.ink : T.line2}`,
              background: selected ? T.ink : 'transparent',
              color: T.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {selected ? '✓' : ''}
          </div>
        )}
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
          {!selectMode && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                onClick={() => setReasonOpen((v) => !v)}
                disabled={swapping}
                style={pillStyle(swapping, reasonOpen)}
              >
                <IconRefresh size={14} strokeWidth={2} />
                {reasonOpen ? 'Zamknij' : 'Zamień'}
              </button>
              <button
                type="button"
                onClick={onDislikeAndReplace}
                disabled={swapping}
                style={pillStyle(swapping, false)}
                title={'Zapisz „nie powtarzaj” i wygeneruj inne danie'}
              >
                👎 Nie lubię — zamień
              </button>
            </div>
          )}
          {!selectMode && reasonOpen && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder={'Dlaczego zamieniasz? (opcjonalnie). Np. „za długo gotować w środku tygodnia”'}
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: `1px solid ${T.line2}`,
                  fontSize: 13.5,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={onSwap}
                disabled={swapping}
                style={pillStyle(swapping, true)}
              >
                {swapping ? 'Generowanie…' : 'Wygeneruj nowe danie'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function pillStyle(disabled: boolean, primary: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 999,
    background: primary ? T.ink : 'transparent',
    border: `1px solid ${primary ? T.ink : T.line2}`,
    color: primary ? T.bg : T.ink,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
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
