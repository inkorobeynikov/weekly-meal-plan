// Font loader for client-side hosts that don't preload via a framework (e.g.
// the standalone HTML mockup). In Next.js / Vite apps prefer the framework's
// native font handling instead and import { fontCss } if you only need the
// scoped CSS rules.

import { tokens as T } from './tokens.js';

export const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Manrope:wght@400;500;600;700&display=swap';

export const fontCss = `
.mp-display{font-family:'Bricolage Grotesque',ui-sans-serif,system-ui,-apple-system,sans-serif;letter-spacing:-0.02em}
.mp{font-family:'Manrope',ui-sans-serif,system-ui,-apple-system,sans-serif;color:${T.ink};-webkit-font-smoothing:antialiased}
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
