'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Recipe } from '@meal-planner/db'
import {
  Badge,
  Body,
  Button,
  Card,
  IconClock,
  IconEuro,
  IconFlame,
  IconHeart,
  IconPeople,
  IconThumb,
  Placeholder,
  RestrictionStrip,
  tokens as T,
} from '@meal-planner/ui'
import { ApiError, get, post } from '../../../../lib/api-client.js'

const DIFFICULTY_LABEL: Record<Recipe['difficulty'], string> = {
  easy: 'Łatwe',
  medium: 'Średnie',
  hard: 'Trudne',
}

const COST_LABEL: Record<Recipe['costLevel'], string> = {
  cheap: 'Tanie',
  moderate: 'Średnie',
  expensive: 'Drogie',
}

export default function RecipeDetailPage({
  params,
}: {
  params: Promise<{ recipeId: string }>
}): React.JSX.Element {
  const { recipeId } = use(params)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reaction, setReaction] = useState<'liked' | 'dont_repeat' | null>(null)
  const [reactionPending, setReactionPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    get<{ recipe: Recipe }>(`/api/recipes/${recipeId}`)
      .then((res) => {
        if (!cancelled) setRecipe(res.recipe)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof ApiError ? err.message : 'Nie udało się załadować przepisu'
        setError(msg)
      })
    return () => {
      cancelled = true
    }
  }, [recipeId])

  async function react(value: 'liked' | 'dont_repeat'): Promise<void> {
    setReactionPending(true)
    setReaction(value)
    try {
      await post(`/api/feedback`, { recipeId, reaction: value })
    } catch {
      // best-effort feedback; UI keeps the toggle state
    } finally {
      setReactionPending(false)
    }
  }

  if (error) {
    return (
      <Body top={16}>
        <Card style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Błąd</div>
          <div style={{ color: T.muted, fontSize: 14 }}>{error}</div>
        </Card>
      </Body>
    )
  }

  if (!recipe) {
    return (
      <Body top={16}>
        <div style={{ color: T.muted, fontSize: 14 }}>Ładowanie…</div>
      </Body>
    )
  }

  return (
    <Body top={12}>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/plan"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: T.ink2,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← Plan
        </Link>
      </div>

      <Placeholder height={220} label="Recipe photo" />

      <h1
        style={{
          margin: '14px 0 8px',
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: -0.3,
          color: T.ink,
        }}
      >
        {recipe.title}
      </h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <Badge tone="sage" icon={<IconClock />}>
          {recipe.timeMinutes} min
        </Badge>
        <Badge tone="amber" icon={<IconFlame />}>
          {DIFFICULTY_LABEL[recipe.difficulty]}
        </Badge>
        <Badge tone="blue" icon={<IconEuro />}>
          {COST_LABEL[recipe.costLevel]}
        </Badge>
        <Badge tone="neutral" icon={<IconPeople />}>
          {recipe.servings} porcji
        </Badge>
      </div>

      {recipe.allergenNotes ? (
        <div style={{ marginBottom: 16 }}>
          <RestrictionStrip items={[recipe.allergenNotes]} />
        </div>
      ) : null}

      <Section title="Składniki">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {recipe.ingredientsJson.map((ing, i) => (
            <li
              key={`${ing.name}-${i}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: `1px solid ${T.line}`,
                fontSize: 15,
                color: T.ink,
              }}
            >
              <span>{ing.name}</span>
              <span style={{ color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
                {ing.quantity} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Kroki">
        <ol style={{ paddingLeft: 0, margin: 0, listStyle: 'none' }}>
          {recipe.stepsJson.map((step, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                padding: '10px 0',
                borderBottom: `1px solid ${T.line}`,
                fontSize: 15,
                color: T.ink,
                lineHeight: 1.45,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: T.surface2,
                  color: T.ink2,
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      {recipe.substitutionsJson.length > 0 ? (
        <Section title="Zamienniki">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recipe.substitutionsJson.map((sub, i) => (
              <Card key={i} style={{ padding: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
                  {sub.original} → {sub.substitute}
                </div>
                {sub.note ? (
                  <div style={{ marginTop: 4, fontSize: 13, color: T.muted }}>{sub.note}</div>
                ) : null}
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {recipe.leftoversNotes ? (
        <Section title="Resztki">
          <Card style={{ padding: 12 }}>
            <div style={{ fontSize: 14, color: T.ink2, lineHeight: 1.45 }}>
              {recipe.leftoversNotes}
            </div>
          </Card>
        </Section>
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <Button
          variant={reaction === 'liked' ? 'sage' : 'ghost'}
          icon={<IconThumb />}
          onClick={() => react('liked')}
          full
          style={{ opacity: reactionPending ? 0.7 : 1 }}
        >
          Smaczne
        </Button>
        <Button
          variant={reaction === 'dont_repeat' ? 'primary' : 'ghost'}
          icon={<IconHeart />}
          onClick={() => react('dont_repeat')}
          full
          style={{ opacity: reactionPending ? 0.7 : 1 }}
        >
          Nie powtarzać
        </Button>
      </div>
    </Body>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section style={{ marginTop: 20 }}>
      <h2
        style={{
          margin: '0 0 8px',
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: -0.2,
          color: T.ink,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}
