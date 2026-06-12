import { useCallback, useEffect, useRef, useState } from 'react';

import { generatePlan, getWeeklyPlan, type PlanWithMealsAndRecipes } from './api';

// ---------------------------------------------------------------------------
// Shared async plan-generation pattern (F1).
//
// Generating a weekly plan is asynchronous: POST /api/plans/generate only
// ENQUEUES a background (Inngest) job and returns fast. The finished plan shows
// up later, so every screen that kicks off generation must poll for it.
//
// This hook centralises that pattern so plan/index, plan/review and the
// shopping "new week" flow all behave identically:
//   - start generation,
//   - poll getWeeklyPlan() on a fixed interval,
//   - STOP once a caller-supplied predicate says the fresh plan has arrived,
//   - give up after a hard ceiling of polls (never poll forever) and surface an
//     explicit error so the UI can show a "Spróbuj ponownie" action.
// ---------------------------------------------------------------------------

/** Poll cadence in ms. The POST returns fast; the job finishes seconds later. */
export const POLL_INTERVAL_MS = 8000;

/**
 * Maximum number of polls before we give up. ~15 polls × 8s ≈ 2 minutes. After
 * this we switch to an error state instead of polling indefinitely.
 */
export const MAX_POLLS = 15;

export const GENERATION_TIMEOUT_MESSAGE =
  'Generowanie planu trwa zbyt długo. Spróbuj ponownie.';

export type GenerationPhase = 'idle' | 'generating' | 'error';

export interface UsePlanGenerationOptions {
  /**
   * Returns true once the polled plan is the freshly generated one we are
   * waiting for. Defaults to "any plan with at least one meal". Screens that
   * must distinguish a NEW plan from a stale one (e.g. review) can pass a
   * predicate comparing plan ids / created timestamps.
   */
  isReady?: (plan: PlanWithMealsAndRecipes) => boolean;
  /** Called once with the ready plan when generation completes. */
  onReady?: (plan: PlanWithMealsAndRecipes) => void;
}

export interface UsePlanGeneration {
  phase: GenerationPhase;
  /** True while a generation request is in flight or we are polling for it. */
  generating: boolean;
  /** Explicit error message to surface to the user (timeout or request error). */
  error: string | null;
  /** Kick off generation + polling. No-op if already generating. */
  start: () => Promise<void>;
  /** Clear any error and return to idle (e.g. before a manual retry). */
  reset: () => void;
}

function defaultIsReady(plan: PlanWithMealsAndRecipes): boolean {
  return plan.meals.length > 0;
}

export function usePlanGeneration(
  options: UsePlanGenerationOptions = {},
): UsePlanGeneration {
  const { isReady = defaultIsReady, onReady } = options;

  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callbacks in refs so the polling effect does not need them
  // in its dependency list (which would restart the interval on every render).
  const isReadyRef = useRef(isReady);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    isReadyRef.current = isReady;
    onReadyRef.current = onReady;
  });

  // Poll counter — drives the ceiling. We bump it to (re)start the effect.
  const [pollTick, setPollTick] = useState(0);
  const pollCountRef = useRef(0);

  const reset = useCallback((): void => {
    setPhase('idle');
    setError(null);
    pollCountRef.current = 0;
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (phase === 'generating') return;
    setError(null);
    pollCountRef.current = 0;
    setPhase('generating');
    try {
      await generatePlan();
      // Begin polling.
      setPollTick((t) => t + 1);
    } catch (err) {
      setPhase('error');
      setError(
        err instanceof Error ? err.message : 'Nie udało się rozpocząć generowania.',
      );
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'generating') return;
    let cancelled = false;

    const poll = async (): Promise<void> => {
      pollCountRef.current += 1;
      try {
        const plan = await getWeeklyPlan();
        if (cancelled) return;
        if (isReadyRef.current(plan)) {
          setPhase('idle');
          pollCountRef.current = 0;
          onReadyRef.current?.(plan);
          return;
        }
      } catch {
        // 404 / transient failure: keep polling until the ceiling.
        if (cancelled) return;
      }
      if (pollCountRef.current >= MAX_POLLS) {
        if (cancelled) return;
        setPhase('error');
        setError(GENERATION_TIMEOUT_MESSAGE);
        return;
      }
      // Schedule the next poll.
      if (!cancelled) setPollTick((t) => t + 1);
    };

    const id = setTimeout(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // pollTick advances each cycle to re-arm the timeout; phase gates the loop.
  }, [phase, pollTick]);

  return {
    phase,
    generating: phase === 'generating',
    error,
    start,
    reset,
  };
}
