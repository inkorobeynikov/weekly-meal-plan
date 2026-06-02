// HARD-CONSTRAINT allergy guard.
//
// Allergies are HARD CONSTRAINTS — a plan that violates a household allergy
// must NEVER be approvable. These helpers are pure, deterministic and strictly
// typed so the W04 review screen can block approval whenever any planned meal
// collides with a household allergy.

import type { MealWithRecipe, Recipe } from './api';

// ---------------------------------------------------------------------------
// Known allergen vocabulary (Polish canonical term → recognised aliases).
// Used by recipeAllergens() to derive allergens from free-text notes /
// ingredient names when a recipe does not expose a structured allergen list.
// Matching is case-insensitive; aliases cover both Polish and English forms.
// ---------------------------------------------------------------------------

interface AllergenTerm {
  readonly canonical: string;
  readonly aliases: readonly string[];
}

const KNOWN_ALLERGENS: readonly AllergenTerm[] = [
  { canonical: 'Gluten', aliases: ['gluten', 'pszenica', 'wheat', 'mąka', 'flour'] },
  { canonical: 'Orzechy', aliases: ['orzech', 'orzechy', 'nut', 'nuts', 'peanut', 'migdał', 'almond'] },
  { canonical: 'Laktoza', aliases: ['laktoza', 'lactose', 'mleko', 'milk', 'dairy', 'nabiał', 'ser', 'cheese', 'śmietana', 'cream'] },
  { canonical: 'Jajka', aliases: ['jajko', 'jajka', 'jaja', 'egg', 'eggs'] },
  { canonical: 'Ryby', aliases: ['ryba', 'ryby', 'fish', 'łosoś', 'salmon', 'dorsz', 'cod', 'tuńczyk', 'tuna'] },
  { canonical: 'Owoce morza', aliases: ['owoce morza', 'seafood', 'krewetki', 'shrimp', 'shellfish', 'małże', 'mussels', 'krab', 'crab'] },
  { canonical: 'Soja', aliases: ['soja', 'soya', 'soy', 'tofu'] },
  { canonical: 'Sezam', aliases: ['sezam', 'sesame', 'tahini'] },
] as const;

// ---------------------------------------------------------------------------
// Core comparison
// ---------------------------------------------------------------------------

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * True when any meal allergen collides with any household allergy.
 * Case-insensitive, trimmed set intersection — a non-empty intersection is a
 * HARD-CONSTRAINT violation.
 */
export function mealViolatesAllergies(
  mealAllergens: readonly string[],
  householdAllergies: readonly string[],
): boolean {
  if (mealAllergens.length === 0 || householdAllergies.length === 0) return false;

  const householdSet = new Set<string>(
    householdAllergies.map(normalize).filter((v) => v.length > 0),
  );
  if (householdSet.size === 0) return false;

  for (const allergen of mealAllergens) {
    const key = normalize(allergen);
    if (key.length > 0 && householdSet.has(key)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Recipe → allergens
// ---------------------------------------------------------------------------

// A recipe MAY (in future) expose a structured allergens array. The api.ts
// Recipe type does not declare one today, so we read it best-effort without
// widening to `any`.
interface RecipeWithStructuredAllergens {
  allergens?: readonly string[];
}

function readStructuredAllergens(recipe: Recipe): readonly string[] | null {
  const candidate = (recipe as Recipe & RecipeWithStructuredAllergens).allergens;
  if (Array.isArray(candidate) && candidate.every((v) => typeof v === 'string')) {
    return candidate;
  }
  return null;
}

/**
 * Best-effort allergen extraction for a recipe.
 *
 * 1. If the recipe exposes a structured `allergens` array, use it verbatim.
 * 2. Otherwise scan `allergenNotes` + ingredient names for every known
 *    allergen alias and map matches back to their canonical Polish term.
 *
 * Deterministic: canonical terms are returned in KNOWN_ALLERGENS order and
 * de-duplicated.
 */
export function recipeAllergens(recipe: Recipe): string[] {
  const structured = readStructuredAllergens(recipe);
  if (structured) {
    // De-duplicate while preserving first-seen order.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const a of structured) {
      const trimmed = a.trim();
      const key = trimmed.toLowerCase();
      if (trimmed.length > 0 && !seen.has(key)) {
        seen.add(key);
        out.push(trimmed);
      }
    }
    return out;
  }

  const haystackParts: string[] = [];
  if (recipe.allergenNotes) haystackParts.push(recipe.allergenNotes);
  for (const ing of recipe.ingredientsJson) {
    haystackParts.push(ing.name);
  }
  const haystack = normalize(haystackParts.join('  '));

  const found: string[] = [];
  for (const term of KNOWN_ALLERGENS) {
    const hit = term.aliases.some((alias) => haystack.includes(alias));
    if (hit) found.push(term.canonical);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Plan-level conflict detection
// ---------------------------------------------------------------------------

export interface PlanAllergyConflict {
  mealId: string;
  recipeName: string;
  matched: string[];
}

/**
 * Maps over the plan's meals and returns one PlanAllergyConflict per meal whose
 * recipe collides with a household allergy. The `matched` array lists exactly
 * which household allergens were hit (canonical-cased from household input).
 *
 * Allergies are HARD CONSTRAINTS — a non-empty result MUST block plan approval.
 */
export function findPlanAllergyConflicts(
  meals: readonly MealWithRecipe[],
  householdAllergies: readonly string[],
): PlanAllergyConflict[] {
  const household = householdAllergies
    .map((a) => ({ raw: a.trim(), key: normalize(a) }))
    .filter((a) => a.key.length > 0);
  if (household.length === 0) return [];

  const conflicts: PlanAllergyConflict[] = [];
  for (const { meal, recipe } of meals) {
    const allergens = recipeAllergens(recipe);
    if (allergens.length === 0) continue;

    const allergenKeys = new Set<string>(allergens.map(normalize));
    const matched = household
      .filter((h) => allergenKeys.has(h.key))
      .map((h) => h.raw);

    if (matched.length > 0) {
      conflicts.push({
        mealId: meal.id,
        recipeName: recipe.title,
        matched,
      });
    }
  }
  return conflicts;
}
