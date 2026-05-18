// mp-system.jsx — shared tokens, primitives, icons for Mealplan screens

// ─── Tokens ───────────────────────────────────────────────────────────────
const T = {
  // surfaces
  bg:        '#FBF7F1',   // warm canvas
  surface:   '#FFFFFF',   // cards
  surface2:  '#F4EFE6',   // inset / chip bg
  line:      'rgba(31, 27, 22, 0.08)',
  line2:     'rgba(31, 27, 22, 0.14)',

  // ink
  ink:       '#1F1B16',
  ink2:      '#4A4239',
  muted:     '#7A6F62',
  faint:     '#A89E91',

  // accents (oklch-compatible, warm)
  sage:      '#6E8C5A',   // fresh / safe / kid-friendly
  sageSoft:  '#E7EFDD',
  amber:     '#C8761F',   // cooking / warmth / time
  amberSoft: '#F8E9D2',
  terra:     '#B5482F',   // allergies / restriction
  terraSoft: '#F4D9CF',
  blue:      '#3F6E89',   // system / info
  blueSoft:  '#DDE8EF',
  plum:      '#7A4E6B',   // promo / nice-to-have
  plumSoft:  '#EEDDE7',

  // radii
  rSm: 10, rMd: 14, rLg: 20, rXl: 28,
};

// ─── Type ─────────────────────────────────────────────────────────────────
// Load Google Fonts once
(() => {
  if (document.getElementById('mp-fonts')) return;
  const link = document.createElement('link');
  link.id = 'mp-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Manrope:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
  const css = document.createElement('style');
  css.textContent = `
    .mp-display{font-family:'Bricolage Grotesque',ui-sans-serif,system-ui,-apple-system,sans-serif;letter-spacing:-0.02em}
    .mp{font-family:'Manrope',ui-sans-serif,system-ui,-apple-system,sans-serif;color:${T.ink};-webkit-font-smoothing:antialiased}
    .mp *{box-sizing:border-box}
    .mp ::-webkit-scrollbar{display:none}
    .mp button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
  `;
  document.head.appendChild(css);
})();

// ─── Icons (line, 1.6 stroke) ─────────────────────────────────────────────
const Icon = ({ d, size = 18, stroke = 'currentColor', fill = 'none', strokeWidth = 1.7, children, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
       strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {children || <path d={d} />}
  </svg>
);
const I = {
  clock:    <Icon><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>,
  flame:    <Icon><path d="M12 3c1.5 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.8-2.5 1.5-3.2C10 9 11 7 12 3z"/></Icon>,
  euro:     <Icon><path d="M17 6.5A6 6 0 0 0 8 9m9 8.5A6 6 0 0 1 8 15M5 10h8M5 13.5h8"/></Icon>,
  kid:      <Icon><circle cx="12" cy="9" r="4"/><path d="M5.5 20c1-3.5 4-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="10" cy="9" r=".7" fill="currentColor"/><circle cx="14" cy="9" r=".7" fill="currentColor"/></Icon>,
  repeat:   <Icon><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16M21 4v4h-4M3 20v-4h4"/></Icon>,
  check:    <Icon><path d="M4 12.5l5 5L20 6.5"/></Icon>,
  plus:     <Icon><path d="M12 5v14M5 12h14"/></Icon>,
  more:     <Icon><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/></Icon>,
  chev:     <Icon><path d="M9 6l6 6-6 6"/></Icon>,
  chevDown: <Icon><path d="M6 9l6 6 6-6"/></Icon>,
  alert:    <Icon><path d="M12 4l9.5 16h-19L12 4z"/><path d="M12 10v4M12 17.2v.1"/></Icon>,
  heart:    <Icon><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></Icon>,
  cross:    <Icon><path d="M6 6l12 12M18 6L6 18"/></Icon>,
  edit:     <Icon><path d="M14 5l5 5L9 20H4v-5L14 5z"/></Icon>,
  tag:      <Icon><path d="M3 12l9-9h8v8l-9 9-8-8z"/><circle cx="15" cy="9" r="1.4"/></Icon>,
  cart:     <Icon><path d="M3 5h2l2.5 11.5a2 2 0 0 0 2 1.5h7.5a2 2 0 0 0 2-1.5L21 8H7"/><circle cx="10" cy="20" r="1.2"/><circle cx="17" cy="20" r="1.2"/></Icon>,
  book:     <Icon><path d="M4 5a2 2 0 0 1 2-2h13v16H7a3 3 0 0 0-3 3V5z"/><path d="M7 17h12"/></Icon>,
  people:   <Icon><circle cx="9" cy="9" r="3.2"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 19c.7-3 3-4.5 5.5-4.5S13.8 16 14.5 19M14.5 14.5c2 0 4 1 5 3.5"/></Icon>,
  plan:     <Icon><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/></Icon>,
  share:    <Icon><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/></Icon>,
  refresh:  <Icon><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/></Icon>,
  bowl:     <Icon><path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M7 8c1-1 2-1 3 0M12 6c1-1 2-1 3 0M17 8c1-1 2-1 3 0"/></Icon>,
  bag:      <Icon><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></Icon>,
  search:   <Icon><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></Icon>,
  home:     <Icon><path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4v-9z"/></Icon>,
  star:     <Icon><path d="M12 4l2.4 5 5.6.8-4 4 1 5.6L12 16.8 6.9 19.4l1-5.6-4-4L9.6 9 12 4z"/></Icon>,
  thumb:    <Icon><path d="M7 10h3V4l4 6v9H8a3 3 0 0 1-3-3v-3a3 3 0 0 1 2-3z"/></Icon>,
  copy:     <Icon><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></Icon>,
  send:     <Icon><path d="M22 3L11 14M22 3l-7 18-4-7-7-4 18-7z"/></Icon>,
  link:     <Icon><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></Icon>,
  pin:      <Icon><path d="M12 21s7-7.5 7-12a7 7 0 0 0-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></Icon>,
  paperclip:<Icon><path d="M19 11l-7.5 7.5a4.5 4.5 0 1 1-6.4-6.4L13 4.5a3 3 0 0 1 4.2 4.2l-8 8a1.5 1.5 0 1 1-2.1-2.1L14 8"/></Icon>,
};

// ─── Frame ────────────────────────────────────────────────────────────────
// Slim phone outline so the design reads as mobile. Width 390, height 844.
function Frame({ children, dark = false, statusInk = T.ink, label }) {
  const W = 390, H = 844;
  return (
    <div className="mp" style={{
      width: W, height: H, background: T.bg, position: 'relative',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }} data-screen-label={label}>
      <StatusBar ink={statusInk} />
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

function StatusBar({ ink = T.ink }) {
  return (
    <div style={{
      height: 44, padding: '0 24px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', fontSize: 15, fontWeight: 600,
      color: ink, flexShrink: 0,
    }}>
      <span style={{ letterSpacing: -0.2 }}>9:41</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* signal */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill={ink}>
          <rect x="0" y="7" width="3" height="4" rx="0.6"/>
          <rect x="5" y="5" width="3" height="6" rx="0.6"/>
          <rect x="10" y="2" width="3" height="9" rx="0.6"/>
          <rect x="15" y="0" width="2" height="11" rx="0.6" opacity="0.4"/>
        </svg>
        {/* wifi */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke={ink} strokeWidth="1.4">
          <path d="M1 4.2C2.7 2.7 5 1.8 7.5 1.8s4.8 0.9 6.5 2.4"/>
          <path d="M3 6.4c1.2-1 2.8-1.6 4.5-1.6s3.3 0.6 4.5 1.6"/>
          <circle cx="7.5" cy="9" r="1" fill={ink} stroke="none"/>
        </svg>
        {/* battery */}
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="2.5" fill="none" stroke={ink} strokeOpacity="0.4"/>
          <rect x="2" y="2" width="18" height="8" rx="1.4" fill={ink}/>
          <rect x="23.5" y="3.5" width="1.6" height="5" rx="0.5" fill={ink} opacity="0.5"/>
        </svg>
      </span>
    </div>
  );
}

// ─── Tab bar ──────────────────────────────────────────────────────────────
function TabBar({ active = 'plan' }) {
  const tabs = [
    { id: 'plan',     label: 'Plan',     icon: I.plan },
    { id: 'shopping', label: 'Shopping', icon: I.cart },
    { id: 'recipes',  label: 'Recipes',  icon: I.book },
    { id: 'family',   label: 'Family',   icon: I.people },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: 'rgba(255,253,249,0.92)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderTop: `1px solid ${T.line}`,
      padding: '10px 12px 22px',
      display: 'flex', justifyContent: 'space-around',
    }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <div key={t.id} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: on ? T.ink : T.faint, padding: '4px 12px',
            position: 'relative',
          }}>
            <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {React.cloneElement(t.icon, { size: 22, strokeWidth: on ? 2 : 1.6 })}
            </div>
            <div style={{ fontSize: 11, fontWeight: on ? 700 : 500, letterSpacing: -0.1 }}>{t.label}</div>
            {on && <div style={{ position: 'absolute', bottom: -4, width: 4, height: 4, borderRadius: 2, background: T.ink }}/>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────
function Badge({ tone = 'neutral', icon, children, size = 'md', strong = false, style }) {
  const tones = {
    neutral: { bg: T.surface2, fg: T.ink2, bd: 'transparent' },
    sage:    { bg: T.sageSoft, fg: '#3F5733', bd: 'transparent' },
    amber:   { bg: T.amberSoft, fg: '#8A4F12', bd: 'transparent' },
    terra:   { bg: T.terraSoft, fg: '#7E2D1A', bd: 'transparent' },
    blue:    { bg: T.blueSoft, fg: '#2A4D63', bd: 'transparent' },
    plum:    { bg: T.plumSoft, fg: '#5C3550', bd: 'transparent' },
    outline: { bg: 'transparent', fg: T.ink2, bd: T.line2 },
  };
  const c = tones[tone];
  const sizes = {
    sm: { pad: '3px 8px', fs: 11, gap: 4, ih: 12 },
    md: { pad: '4px 10px', fs: 12, gap: 5, ih: 13 },
    lg: { pad: '6px 12px', fs: 13, gap: 6, ih: 14 },
  }[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: sizes.gap,
      padding: sizes.pad, borderRadius: 999,
      background: c.bg, color: c.fg, border: `1px solid ${c.bd}`,
      fontSize: sizes.fs, fontWeight: strong ? 700 : 600, lineHeight: 1,
      whiteSpace: 'nowrap', ...style,
    }}>
      {icon && React.cloneElement(icon, { size: sizes.ih, strokeWidth: 2, style: { flexShrink: 0 } })}
      {children}
    </span>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.surface, borderRadius: T.rLg,
      boxShadow: '0 1px 0 rgba(31,27,22,0.04), 0 8px 24px -12px rgba(31,27,22,0.10)',
      border: `1px solid ${T.line}`,
      ...style,
    }}>{children}</div>
  );
}

function Button({ children, variant = 'primary', icon, full = true, style, onClick }) {
  const variants = {
    primary: { bg: T.ink, fg: '#FBF7F1', bd: 'transparent' },
    ghost:   { bg: 'transparent', fg: T.ink, bd: T.line2 },
    sage:    { bg: T.sage, fg: '#fff', bd: 'transparent' },
    soft:    { bg: T.surface2, fg: T.ink, bd: 'transparent' },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: full ? '100%' : 'auto',
      height: 52, padding: '0 22px', borderRadius: 999,
      background: v.bg, color: v.fg, border: `1px solid ${v.bd}`,
      fontSize: 16, fontWeight: 700, letterSpacing: -0.1,
      ...style,
    }}>
      {icon && React.cloneElement(icon, { size: 18, strokeWidth: 2 })}
      {children}
    </button>
  );
}

// Subtle striped placeholder (in lieu of imagery)
function Placeholder({ width = '100%', height = 120, label, radius = T.rMd, tone = 'warm' }) {
  const stripe = tone === 'warm'
    ? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><path d='M-2 14L14 -2M0 16L16 0M2 18L18 2' stroke='%23E4DCCD' stroke-width='1'/></svg>"
    : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><path d='M-2 14L14 -2M0 16L16 0M2 18L18 2' stroke='%23D9E2DB' stroke-width='1'/></svg>";
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: `${tone === 'warm' ? '#F2EADC' : '#E5EDE3'} url("${stripe}")`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: tone === 'warm' ? '#9B8A6E' : '#6F8770',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase',
    }}>{label}</div>
  );
}

// scrollable body wrapper with safe-area top + bottom-tabbar gap
function Body({ children, pad = '0 18px', bottom = 96, top = 0, style }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto',
      padding: pad, paddingTop: top, paddingBottom: bottom,
      ...style,
    }}>{children}</div>
  );
}

// Restriction strip — terra-tinted, always visible on planning surfaces
function RestrictionStrip({ items = ['No broccoli', 'No spicy', 'No shellfish'] }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 999,
      background: T.terraSoft, color: '#7E2D1A',
      fontSize: 12.5, fontWeight: 600,
    }}>
      {React.cloneElement(I.alert, { size: 15, strokeWidth: 2.2, style: { flexShrink: 0 } })}
      <div style={{ display: 'flex', gap: 0, flex: 1, overflow: 'hidden' }}>
        {items.map((x, i) => (
          <React.Fragment key={i}>
            <span style={{ whiteSpace: 'nowrap' }}>{x}</span>
            {i < items.length - 1 && <span style={{ opacity: 0.45, margin: '0 8px' }}>·</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// Avatar — initial in colored circle
function Avatar({ name = 'A', tone = 'sage', size = 26, ring = false }) {
  const tones = {
    sage:  ['#A8C18D', '#3F5733'],
    amber: ['#E5B36B', '#8A4F12'],
    plum:  ['#C29DB6', '#5C3550'],
    blue:  ['#88AEC6', '#2A4D63'],
    terra: ['#D88971', '#7E2D1A'],
  }[tone];
  return (
    <div style={{
      width: size, height: size, borderRadius: size,
      background: tones[0], color: tones[1],
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 700,
      border: ring ? `2px solid ${T.bg}` : 'none',
      flexShrink: 0,
    }}>{name.slice(0, 1).toUpperCase()}</div>
  );
}

Object.assign(window, { T, I, Icon, Frame, StatusBar, TabBar, Badge, Card, Button, Placeholder, Body, RestrictionStrip, Avatar });
