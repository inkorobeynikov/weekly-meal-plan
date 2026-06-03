import {
  cloneElement,
  Fragment,
  isValidElement,
  type CSSProperties,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
} from 'react';
import { tokens as T, radii, shadows, accentPair, type AccentTone } from './tokens.js';
import { IconAlert } from './icons.js';

// ─── Badge ─────────────────────────────────────────────────────────────────
export type BadgeTone = AccentTone | 'neutral' | 'outline';
export type BadgeSize = 'sm' | 'md' | 'lg';

type IconElement = ReactElement<{
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
}>;

const badgeTones: Record<BadgeTone, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: T.surface2, fg: T.ink2, bd: 'transparent' },
  sage:    { bg: T.sageSoft, fg: T.sageInk, bd: 'transparent' },
  amber:   { bg: T.amberSoft, fg: T.amberInk, bd: 'transparent' },
  terra:   { bg: T.terraSoft, fg: T.terraInk, bd: 'transparent' },
  blue:    { bg: T.blueSoft, fg: T.blueInk, bd: 'transparent' },
  plum:    { bg: T.plumSoft, fg: T.plumInk, bd: 'transparent' },
  outline: { bg: 'transparent', fg: T.ink2, bd: T.line2 },
};

const badgeSizes: Record<BadgeSize, { pad: string; fs: number; gap: number; ih: number }> = {
  sm: { pad: '3px 8px', fs: 11, gap: 4, ih: 12 },
  md: { pad: '4px 10px', fs: 12, gap: 5, ih: 13 },
  lg: { pad: '6px 12px', fs: 13, gap: 6, ih: 14 },
};

export function Badge({
  tone = 'neutral',
  icon,
  children,
  size = 'md',
  strong = false,
  style,
}: {
  tone?: BadgeTone;
  icon?: IconElement;
  children?: ReactNode;
  size?: BadgeSize;
  strong?: boolean;
  style?: CSSProperties;
}) {
  const c = badgeTones[tone];
  const s = badgeSizes[size];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        padding: s.pad,
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        fontSize: s.fs,
        fontWeight: strong ? 700 : 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon && isValidElement(icon)
        ? cloneElement(icon, { size: s.ih, strokeWidth: 2, style: { flexShrink: 0 } })
        : null}
      {children}
    </span>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────
export function Card({
  children,
  style,
  onClick,
}: {
  children?: ReactNode;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.surface,
        borderRadius: radii.lg,
        boxShadow: shadows.card,
        border: `1px solid ${T.line}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Button ────────────────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'ghost' | 'sage' | 'soft';

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; bd: string }> = {
  primary: { bg: T.sage, fg: '#fff', bd: 'transparent' },
  ghost:   { bg: 'transparent', fg: T.ink, bd: T.line2 },
  sage:    { bg: T.sage, fg: '#fff', bd: 'transparent' },
  soft:    { bg: T.surface2, fg: T.ink, bd: 'transparent' },
};

export function Button({
  children,
  variant = 'primary',
  icon,
  full = true,
  style,
  onClick,
  type = 'button',
}: {
  children?: ReactNode;
  variant?: ButtonVariant;
  icon?: IconElement;
  full?: boolean;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
}) {
  const v = buttonVariants[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: full ? '100%' : 'auto',
        height: 52,
        padding: '0 22px',
        borderRadius: 999,
        background: v.bg,
        color: v.fg,
        border: `1px solid ${v.bd}`,
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: -0.1,
        cursor: 'pointer',
        font: 'inherit',
        ...style,
      }}
    >
      {icon && isValidElement(icon)
        ? cloneElement(icon, { size: 18, strokeWidth: 2 })
        : null}
      {children}
    </button>
  );
}

// ─── Placeholder ───────────────────────────────────────────────────────────
// Subtly-striped fill to stand in for imagery during prototyping. The label
// reads as a monospace caption explaining what should drop here.
export function Placeholder({
  width = '100%',
  height = 120,
  label,
  radius = radii.md,
  tone = 'warm',
}: {
  width?: number | string;
  height?: number | string;
  label?: string;
  radius?: number;
  tone?: 'warm' | 'cool';
}) {
  const stripe =
    tone === 'warm'
      ? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><path d='M-2 14L14 -2M0 16L16 0M2 18L18 2' stroke='%23C9DFA0' stroke-width='1'/></svg>"
      : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><path d='M-2 14L14 -2M0 16L16 0M2 18L18 2' stroke='%23BBD9C2' stroke-width='1'/></svg>";
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: `${tone === 'warm' ? '#EDF6CF' : '#DCEDE2'} url("${stripe}")`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: tone === 'warm' ? '#6E7E45' : '#4E7763',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  );
}

// ─── Restriction strip ─────────────────────────────────────────────────────
// Per design principle #3: restrictions are sacred. Always visible on
// planning surfaces, terra-tinted, alert icon, no truncation games.
export function RestrictionStrip({
  items = ['No broccoli', 'No spicy', 'No shellfish'],
}: { items?: string[] }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 999,
        background: T.terraSoft,
        color: T.terraInk,
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      <IconAlert size={15} strokeWidth={2.2} style={{ flexShrink: 0 }} />
      <div style={{ display: 'flex', gap: 0, flex: 1, overflow: 'hidden' }}>
        {items.map((x, i) => (
          <Fragment key={x}>
            <span style={{ whiteSpace: 'nowrap' }}>{x}</span>
            {i < items.length - 1 && (
              <span style={{ opacity: 0.45, margin: '0 8px' }}>·</span>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────
const avatarTones: Record<AccentTone, readonly [string, string]> = {
  sage:  ['#A8C18D', T.sageInk],
  amber: ['#E5B36B', T.amberInk],
  plum:  ['#C29DB6', T.plumInk],
  blue:  ['#88AEC6', T.blueInk],
  terra: ['#D88971', T.terraInk],
};

export function Avatar({
  name = 'A',
  tone = 'sage',
  size = 26,
  ring = false,
}: {
  name?: string;
  tone?: AccentTone;
  size?: number;
  ring?: boolean;
}) {
  const [bg, fg] = avatarTones[tone];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: bg,
        color: fg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.42,
        fontWeight: 700,
        border: ring ? `2px solid ${T.bg}` : 'none',
        flexShrink: 0,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

// ─── Iconchip ──────────────────────────────────────────────────────────────
// Small rounded-square icon container, used for labelled rows in family
// preferences and similar.
const chipTones: Record<AccentTone | 'neutral', readonly [string, string]> = {
  sage:    accentPair.sage,
  amber:   accentPair.amber,
  plum:    accentPair.plum,
  blue:    accentPair.blue,
  terra:   accentPair.terra,
  neutral: [T.surface2, T.ink2],
};

export function Iconchip({
  icon,
  tone = 'neutral',
  size = 28,
  iconSize = 15,
}: {
  icon: IconElement;
  tone?: AccentTone | 'neutral';
  size?: number;
  iconSize?: number;
}) {
  const [bg, fg] = chipTones[tone];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {isValidElement(icon)
        ? cloneElement(icon, { size: iconSize, strokeWidth: 2 })
        : null}
    </div>
  );
}
