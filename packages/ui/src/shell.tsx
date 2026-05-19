import {
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { tokens as T } from './tokens.js';
import {
  IconPlan,
  IconCart,
  IconBook,
  IconPeople,
} from './icons.js';

// ─── Frame ─────────────────────────────────────────────────────────────────
// 390×844 phone-shaped surface. In the prototype this had a slim outline; in
// production we render it borderless inside a real viewport but keep the
// fixed dimensions for the design-canvas review mode.
export function Frame({
  children,
  label,
  width = 390,
  height = 844,
  fixed = false,
}: {
  children?: ReactNode;
  label?: string;
  width?: number;
  height?: number;
  /** When true, lock to the prototype 390×844 phone frame (canvas mode). */
  fixed?: boolean;
}) {
  return (
    <div
      className="mp"
      data-screen-label={label}
      style={{
        width: fixed ? width : '100%',
        maxWidth: width,
        height: fixed ? height : '100dvh',
        background: T.bg,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        margin: '0 auto',
        color: T.ink,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── StatusBar ─────────────────────────────────────────────────────────────
// Used only in canvas-mode mockups. Real builds inside a Telegram WebView or
// PWA already have OS chrome and should pass `<StatusBar hidden/>` or omit it.
export function StatusBar({
  ink = T.ink,
  hidden = false,
}: {
  ink?: string;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <div
      style={{
        height: 44,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 15,
        fontWeight: 600,
        color: ink,
        flexShrink: 0,
      }}
    >
      <span style={{ letterSpacing: -0.2 }}>9:41</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill={ink}>
          <rect x="0" y="7" width="3" height="4" rx="0.6" />
          <rect x="5" y="5" width="3" height="6" rx="0.6" />
          <rect x="10" y="2" width="3" height="9" rx="0.6" />
          <rect x="15" y="0" width="2" height="11" rx="0.6" opacity="0.4" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke={ink} strokeWidth="1.4">
          <path d="M1 4.2C2.7 2.7 5 1.8 7.5 1.8s4.8 0.9 6.5 2.4" />
          <path d="M3 6.4c1.2-1 2.8-1.6 4.5-1.6s3.3 0.6 4.5 1.6" />
          <circle cx="7.5" cy="9" r="1" fill={ink} stroke="none" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="2.5" fill="none" stroke={ink} strokeOpacity="0.4" />
          <rect x="2" y="2" width="18" height="8" rx="1.4" fill={ink} />
          <rect x="23.5" y="3.5" width="1.6" height="5" rx="0.5" fill={ink} opacity="0.5" />
        </svg>
      </span>
    </div>
  );
}

// ─── TabBar ────────────────────────────────────────────────────────────────
export type TabId = 'plan' | 'shopping' | 'recipes' | 'family';

type IconElement = ReactElement<{ size?: number; strokeWidth?: number }>;

const tabs: ReadonlyArray<{ id: TabId; label: string; icon: IconElement }> = [
  { id: 'plan',     label: 'Plan',     icon: <IconPlan /> },
  { id: 'shopping', label: 'Shopping', icon: <IconCart /> },
  { id: 'recipes',  label: 'Recipes',  icon: <IconBook /> },
  { id: 'family',   label: 'Family',   icon: <IconPeople /> },
];

export function TabBar({
  active = 'plan',
  onSelect,
}: {
  active?: TabId;
  onSelect?: (id: TabId) => void;
}) {
  return (
    <nav
      aria-label="Primary"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(255,253,249,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: `1px solid ${T.line}`,
        padding: '10px 12px 22px',
        display: 'flex',
        justifyContent: 'space-around',
      }}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect?.(t.id)}
            aria-current={on ? 'page' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              color: on ? T.ink : T.faint,
              padding: '4px 12px',
              position: 'relative',
              background: 'none',
              border: 0,
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isValidElement(t.icon)
                ? cloneElement(t.icon, { size: 22, strokeWidth: on ? 2 : 1.6 })
                : null}
            </span>
            <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, letterSpacing: -0.1 }}>
              {t.label}
            </span>
            {on && (
              <span
                style={{
                  position: 'absolute',
                  bottom: -4,
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  background: T.ink,
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Body ──────────────────────────────────────────────────────────────────
// Scrollable inner column with sane defaults: 18px gutter, top spacing 0,
// bottom 96px to clear the persistent tab bar. Override per screen as needed.
export function Body({
  children,
  pad = '0 18px',
  bottom = 96,
  top = 0,
  style,
}: {
  children?: ReactNode;
  pad?: string;
  bottom?: number;
  top?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: pad,
        paddingTop: top,
        paddingBottom: bottom,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
