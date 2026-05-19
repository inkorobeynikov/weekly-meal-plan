'use client'

import { useEffect, useState } from 'react'
import type { FamilyPreferences, Household, HouseholdMember } from '@meal-planner/db'
import type { BudgetMode } from '@meal-planner/shared'
import {
  Avatar,
  Body,
  Button,
  Card,
  IconCross,
  IconPlus,
  RestrictionStrip,
  tokens as T,
  type AccentTone,
} from '@meal-planner/ui'
import { ApiError, get, patch } from '../../../lib/api-client.js'

type FamilyResponse = {
  household: Household
  members: HouseholdMember[]
  preferences: FamilyPreferences | null
}

const AVATAR_TONES: readonly AccentTone[] = ['sage', 'amber', 'plum', 'blue', 'terra']

const COOKING_TIME_OPTIONS = [30, 45, 60, 90] as const

const BUDGET_OPTIONS: ReadonlyArray<{ value: BudgetMode; label: string }> = [
  { value: 'economical', label: 'Ekonomiczny' },
  { value: 'normal', label: 'Normalny' },
  { value: 'flexible', label: 'Elastyczny' },
]

type PrefsDraft = {
  likes: string[]
  dislikes: string[]
  hardRestrictions: string[]
  allergies: string[]
  preferredCuisines: string[]
  stores: string[]
  cookingTimeWeekdayMinutes: number
  budgetMode: BudgetMode
}

function toDraft(prefs: FamilyPreferences | null): PrefsDraft {
  return {
    likes: prefs?.likes ?? [],
    dislikes: prefs?.dislikes ?? [],
    hardRestrictions: prefs?.hardRestrictions ?? [],
    allergies: prefs?.allergies ?? [],
    preferredCuisines: prefs?.preferredCuisines ?? [],
    stores: prefs?.stores ?? [],
    cookingTimeWeekdayMinutes: prefs?.cookingTimeWeekdayMinutes ?? 45,
    budgetMode: prefs?.budgetMode ?? 'normal',
  }
}

export default function FamilyPage(): React.JSX.Element {
  const [data, setData] = useState<FamilyResponse | null>(null)
  const [draft, setDraft] = useState<PrefsDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    get<FamilyResponse>('/api/family')
      .then((res) => {
        if (cancelled) return
        setData(res)
        setDraft(toDraft(res.preferences))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof ApiError ? err.message : 'Nie udało się załadować rodziny'
        setError(msg)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function save(): Promise<void> {
    if (!draft) return
    setSaving(true)
    try {
      await patch('/api/family', draft)
      setSavedAt(Date.now())
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Nie udało się zapisać'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (error && !draft) {
    return (
      <Body top={16}>
        <Card style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Błąd</div>
          <div style={{ color: T.muted, fontSize: 14 }}>{error}</div>
        </Card>
      </Body>
    )
  }

  if (!data || !draft) {
    return (
      <Body top={16}>
        <div style={{ color: T.muted, fontSize: 14 }}>Ładowanie…</div>
      </Body>
    )
  }

  return (
    <Body top={12}>
      <h1
        style={{
          margin: '0 0 12px',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: -0.3,
          color: T.ink,
        }}
      >
        Rodzina i preferencje
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {data.members.length === 0 ? (
          <div style={{ color: T.muted, fontSize: 13 }}>Brak członków rodziny</div>
        ) : (
          data.members.map((m, i) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Avatar
                name={m.displayName}
                tone={AVATAR_TONES[i % AVATAR_TONES.length] ?? 'sage'}
                size={44}
              />
              <span style={{ fontSize: 11, color: T.ink2, fontWeight: 600 }}>
                {m.displayName}
              </span>
            </div>
          ))
        )}
      </div>

      <TagSection
        title="Lubimy"
        tone="sage"
        items={draft.likes}
        onChange={(likes) => setDraft({ ...draft, likes })}
        placeholder="np. makaron"
      />

      <TagSection
        title="Nie lubimy"
        tone="amber"
        items={draft.dislikes}
        onChange={(dislikes) => setDraft({ ...draft, dislikes })}
        placeholder="np. brokuły"
      />

      <section style={{ marginTop: 20 }}>
        <h2 style={sectionH}>Alergie i ograniczenia</h2>
        <div style={{ color: T.muted, fontSize: 12, marginBottom: 8 }}>
          To są twarde ograniczenia — przepisy nigdy nie będą ich łamać.
        </div>
        {draft.allergies.length === 0 && draft.hardRestrictions.length === 0 ? null : (
          <div style={{ marginBottom: 10 }}>
            <RestrictionStrip items={[...draft.allergies, ...draft.hardRestrictions]} />
          </div>
        )}
        <TagEditor
          tone="terra"
          items={draft.allergies}
          onChange={(allergies) => setDraft({ ...draft, allergies })}
          placeholder="alergia np. orzechy"
        />
        <div style={{ height: 8 }} />
        <TagEditor
          tone="terra"
          items={draft.hardRestrictions}
          onChange={(hardRestrictions) => setDraft({ ...draft, hardRestrictions })}
          placeholder="ograniczenie np. wieprzowina"
        />
      </section>

      <TagSection
        title="Kuchnie"
        tone="plum"
        items={draft.preferredCuisines}
        onChange={(preferredCuisines) => setDraft({ ...draft, preferredCuisines })}
        placeholder="np. polska"
      />

      <section style={{ marginTop: 20 }}>
        <h2 style={sectionH}>Czas gotowania</h2>
        <SegmentedControl
          options={COOKING_TIME_OPTIONS.map((v) => ({ value: v, label: `${v} min` }))}
          value={draft.cookingTimeWeekdayMinutes}
          onChange={(cookingTimeWeekdayMinutes) =>
            setDraft({ ...draft, cookingTimeWeekdayMinutes })
          }
        />
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 style={sectionH}>Budżet</h2>
        <SegmentedControl
          options={BUDGET_OPTIONS}
          value={draft.budgetMode}
          onChange={(budgetMode) => setDraft({ ...draft, budgetMode })}
        />
      </section>

      <TagSection
        title="Sklepy"
        tone="blue"
        items={draft.stores}
        onChange={(stores) => setDraft({ ...draft, stores })}
        placeholder="np. Biedronka"
      />

      <div style={{ marginTop: 24 }}>
        <Button onClick={save} variant="primary">
          {saving ? 'Zapisywanie…' : 'Zapisz'}
        </Button>
        {savedAt ? (
          <div style={{ marginTop: 8, color: T.muted, fontSize: 12, textAlign: 'center' }}>
            Zapisano
          </div>
        ) : null}
        {error ? (
          <div style={{ marginTop: 8, color: T.terraInk, fontSize: 12, textAlign: 'center' }}>
            {error}
          </div>
        ) : null}
      </div>
    </Body>
  )
}

const sectionH: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: -0.2,
  color: T.ink,
}

function TagSection({
  title,
  tone,
  items,
  onChange,
  placeholder,
}: {
  title: string
  tone: AccentTone
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
}): React.JSX.Element {
  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={sectionH}>{title}</h2>
      <TagEditor tone={tone} items={items} onChange={onChange} placeholder={placeholder} />
    </section>
  )
}

const TONE_BG: Record<AccentTone, string> = {
  sage: T.sageSoft,
  amber: T.amberSoft,
  plum: T.plumSoft,
  blue: T.blueSoft,
  terra: T.terraSoft,
}
const TONE_FG: Record<AccentTone, string> = {
  sage: T.sageInk,
  amber: T.amberInk,
  plum: T.plumInk,
  blue: T.blueInk,
  terra: T.terraInk,
}

function TagEditor({
  tone,
  items,
  onChange,
  placeholder,
}: {
  tone: AccentTone
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
}): React.JSX.Element {
  const [draft, setDraftVal] = useState('')

  function add(): void {
    const value = draft.trim()
    if (!value) return
    if (items.includes(value)) {
      setDraftVal('')
      return
    }
    onChange([...items, value])
    setDraftVal('')
  }

  function remove(value: string): void {
    onChange(items.filter((x) => x !== value))
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {items.map((it) => (
          <span
            key={it}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: TONE_BG[tone],
              color: TONE_FG[tone],
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {it}
            <button
              type="button"
              onClick={() => remove(it)}
              aria-label={`Usuń ${it}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'transparent',
                border: 0,
                padding: 0,
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <IconCross size={12} strokeWidth={2.2} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={draft}
          onChange={(e) => setDraftVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          style={{
            flex: 1,
            height: 36,
            padding: '0 12px',
            borderRadius: 10,
            border: `1px solid ${T.line2}`,
            background: T.surface,
            color: T.ink,
            fontSize: 14,
            font: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={add}
          aria-label="Dodaj"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: `1px solid ${T.line2}`,
            background: T.surface2,
            color: T.ink,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <IconPlus size={16} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (next: T) => void
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        gap: 4,
        background: '#F4EFE6',
        borderRadius: 12,
        width: '100%',
      }}
    >
      {options.map((opt) => {
        const on = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 9,
              border: 0,
              background: on ? '#FFFFFF' : 'transparent',
              color: on ? '#1F1B16' : '#7A6F62',
              fontSize: 13,
              fontWeight: on ? 700 : 600,
              cursor: 'pointer',
              boxShadow: on ? '0 1px 0 rgba(31,27,22,0.04), 0 4px 12px -6px rgba(31,27,22,0.12)' : 'none',
              font: 'inherit',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
