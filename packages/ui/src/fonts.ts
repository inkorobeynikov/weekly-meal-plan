// Font loader for client-side hosts that don't preload via a framework (e.g.
// the standalone HTML mockup). In Next.js / Vite apps prefer the framework's
// native font handling instead and import { fontCss } if you only need the
// scoped CSS rules.

import { tokens as T } from './tokens.js';

// The design landed on the native system font (SF Pro on Apple) — it gives the
// app an instant "Apple", airy feel with thin weights. We keep Manrope only as
// a fallback for non-Apple platforms that lack a quality system UI font.
export const SYSTEM_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Segoe UI", Roboto, sans-serif';

export const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap';

export const fontCss = `
.mp-display{font-family:${SYSTEM_STACK};letter-spacing:-0.03em;font-weight:700}
.mp{font-family:${SYSTEM_STACK};color:${T.ink};-webkit-font-smoothing:antialiased}
.mp *{box-sizing:border-box}
.mp ::-webkit-scrollbar{display:none}
.mp button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
`;

/** Inject the font link + scoped CSS once per document. SSR-safe (no-op on the server). */
export function ensureFonts(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('mp-fonts')) return;
  const link = document.createElement('link');
  link.id = 'mp-fonts';
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
  const style = document.createElement('style');
  style.id = 'mp-font-css';
  style.textContent = fontCss;
  document.head.appendChild(style);
}
