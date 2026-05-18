// mp-screens-cook.jsx — W08 Recipe, W09 Shopping, W02 Home

// ────────────────────────────────────────────────────────────────────────
// W08 — Recipe Card
// ────────────────────────────────────────────────────────────────────────
function W08() {
  const ingredients = [
    ['Kotlety schabowe (4 szt.)', '~600 g'],
    ['Bułka tarta', '1 szklanka'],
    ['Jajka', '2 szt.'],
    ['Mąka pszenna', '½ szklanki'],
    ['Ziemniaki', '1 kg'],
    ['Mleko, masło', 'do puree'],
    ['Sól, pieprz', 'do smaku'],
    ['Olej do smażenia', '~200 ml'],
  ];
  const steps = [
    'Rozbij kotlety tłuczkiem do grubości ~1 cm. Posól, popieprz z obu stron.',
    'Przygotuj 3 talerze: mąka, roztrzepane jajka, bułka tarta. Obtocz kotlety kolejno.',
    'Ziemniaki obierz, ugotuj w osolonej wodzie ~20 min. Odcedź, ugnieć z masłem i mlekiem.',
    'Rozgrzej olej na średnim ogniu. Smaż kotlety 4-5 minut z każdej strony, do złotego koloru.',
    'Odsącz na ręczniku papierowym. Podawaj z ziemniakami i kiszoną kapustą.',
  ];

  const [open, setOpen] = React.useState('leftovers');

  return (
    <Frame label="W08 Recipe">
      <Body top={0} bottom={120}>
        <div style={{ margin: '0 -18px' }}>
          <Placeholder height={180} label="dish photo · schabowy" radius={0}/>
        </div>

        {/* Title block lifts over photo */}
        <div style={{
          background: T.bg, marginTop: -28, padding: '18px 4px 0', position: 'relative',
          borderTopLeftRadius: T.rXl, borderTopRightRadius: T.rXl,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Polish classic</div>
          <h2 className="mp-display" style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
            Kotlet schabowy z ziemniakami
          </h2>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Badge tone="amber" icon={I.clock}>45 min</Badge>
            <Badge tone="neutral" icon={I.flame}>Easy</Badge>
            <Badge tone="neutral" icon={I.bowl}>4 portions</Badge>
            <Badge tone="neutral" icon={I.euro}>€€</Badge>
            <Badge tone="sage" icon={I.kid}>Kid-ok</Badge>
          </div>
        </div>

        {/* Ingredients */}
        <Section title="Ingredients">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {ingredients.map(([name, qty], i) => (
              <div key={name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}`,
              }}>
                <span style={{ fontSize: 14.5, color: T.ink }}>{name}</span>
                <span style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>{qty}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Steps */}
        <Section title="Steps">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 14 }}>
                <div className="mp-display" style={{
                  width: 28, height: 28, borderRadius: 14, flexShrink: 0,
                  background: T.surface, border: `1px solid ${T.line2}`,
                  color: T.ink, fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</div>
                <div style={{ fontSize: 14.5, lineHeight: 1.5, color: T.ink2, paddingTop: 4 }}>{s}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Collapsibles */}
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Collapsible
            label="Leftovers & storage"
            icon={I.repeat}
            open={open === 'leftovers'}
            onToggle={() => setOpen(open === 'leftovers' ? null : 'leftovers')}
          >
            Cooked cutlets keep 2 days in the fridge. Reheat covered, low heat, with a splash of water — they stay tender. Great for school lunchboxes (Tuesday plan reuses 2 portions).
          </Collapsible>
          <Collapsible label="For kids" icon={I.kid} open={open === 'kids'} onToggle={() => setOpen(open === 'kids' ? null : 'kids')}>
            Skip pepper. Slice thin before serving. Ania likes hers with ketchup, Jakub with cucumber salad.
          </Collapsible>
          <Collapsible label="Substitutions" icon={I.copy} open={open === 'subs'} onToggle={() => setOpen(open === 'subs' ? null : 'subs')}>
            Use chicken breast for a lighter version. Panko instead of bułka tarta gives a crispier crust.
          </Collapsible>
        </div>

        {/* Feedback row */}
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 10 }}>
            How was it?
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Liked it', tone: 'sage', icon: I.heart },
              { label: 'Don\u2019t repeat', tone: 'neutral', icon: I.cross },
              { label: 'Kids skipped', tone: 'neutral', icon: I.kid },
              { label: 'Too long', tone: 'neutral', icon: I.clock },
            ].map((b) => (
              <button key={b.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 14px', borderRadius: 999,
                background: b.tone === 'sage' ? T.sageSoft : T.surface,
                color: b.tone === 'sage' ? '#3F5733' : T.ink2,
                border: `1px solid ${b.tone === 'sage' ? 'transparent' : T.line2}`,
                fontSize: 13, fontWeight: 600,
              }}>
                {React.cloneElement(b.icon, { size: 14, strokeWidth: 2 })}
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </Body>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 84,
        padding: '10px 18px 14px',
        background: 'linear-gradient(180deg, rgba(251,247,241,0) 0%, #FBF7F1 30%)',
      }}>
        <Button variant="sage" icon={I.check}>Mark cooked</Button>
      </div>
      <TabBar active="recipes"/>
    </Frame>
  );
}

function Section({ title, children, action }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <h3 className="mp-display" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Collapsible({ label, icon, open, onToggle, children }) {
  return (
    <div style={{
      borderRadius: T.rMd, background: T.surface, border: `1px solid ${T.line}`, overflow: 'hidden',
    }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px',
        width: '100%', textAlign: 'left',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 13, background: T.surface2,
          color: T.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{React.cloneElement(icon, { size: 14, strokeWidth: 2 })}</div>
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: T.ink }}>{label}</span>
        <span style={{ color: T.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          {React.cloneElement(I.chevDown, { size: 16 })}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', fontSize: 13.5, lineHeight: 1.5, color: T.ink2 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// W09 — Shopping List
// ────────────────────────────────────────────────────────────────────────
function W09() {
  const data = [
    { cat: 'Vegetables & Fruit', items: [
      { name: 'Ziemniaki', qty: '1 kg', date: 'Mon', recipe: 'Schabowy', done: true },
      { name: 'Szpinak świeży', qty: '150 g', date: 'Tue', recipe: 'Makaron z kurczakiem', promo: 'Biedronka' },
      { name: 'Cebula', qty: '3 szt.', date: 'Wed', recipe: 'Żurek', done: true },
      { name: 'Czosnek', qty: '1 główka', date: 'Tue' },
      { name: 'Cytryna', qty: '2 szt.', date: 'Fri', recipe: 'Łosoś' },
    ]},
    { cat: 'Meat & Fish', items: [
      { name: 'Kotlety schabowe', qty: '600 g', date: 'Mon', recipe: 'Schabowy' },
      { name: 'Pierś z kurczaka', qty: '500 g', date: 'Tue', promo: 'Lidl' },
      { name: 'Filet z łososia', qty: '400 g', date: 'Fri', recipe: 'Łosoś' },
      { name: 'Biała kiełbasa', qty: '300 g', date: 'Wed' },
    ]},
    { cat: 'Dairy', items: [
      { name: 'Śmietana 18%', qty: '200 ml', date: 'Tue', done: true },
      { name: 'Parmezan', qty: '100 g', date: 'Tue' },
      { name: 'Mleko', qty: '1 L', date: 'Mon', done: true },
    ]},
    { cat: 'Pantry', items: [
      { name: 'Penne', qty: '500 g', date: 'Tue' },
      { name: 'Bułka tarta', qty: '1 op.', date: 'Mon' },
    ]},
  ];
  const total = data.reduce((s, c) => s + c.items.length, 0);
  const bought = data.reduce((s, c) => s + c.items.filter(x => x.done).length, 0);
  const [tab, setTab] = React.useState('All');
  const tabs = ['All', 'Main shop', 'Buy later', 'Bought'];

  return (
    <Frame label="W09 Shopping List">
      <Body top={6} bottom={104}>
        {/* Header */}
        <div style={{ padding: '6px 4px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h1 className="mp-display" style={{ margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1.05 }}>Shopping</h1>
            <span style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>For May 19 – 25</span>
          </div>

          {/* Progress */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.ink2, marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>{bought} of {total} bought</span>
              <span style={{ color: T.muted }}>{Math.round(bought/total*100)}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: T.surface2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${bought/total*100}%`, background: T.sage, borderRadius: 4 }}/>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            marginTop: 14, display: 'flex', gap: 6, overflowX: 'auto',
          }}>
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '8px 14px', borderRadius: 999,
                background: tab === t ? T.ink : T.surface,
                color: tab === t ? T.bg : T.ink2,
                border: `1px solid ${tab === t ? 'transparent' : T.line2}`,
                fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.map((c) => (
            <Category key={c.cat} cat={c}/>
          ))}
        </div>
      </Body>

      {/* FAB */}
      <button style={{
        position: 'absolute', right: 20, bottom: 104,
        width: 56, height: 56, borderRadius: 28,
        background: T.ink, color: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 10px 28px -8px rgba(31,27,22,0.45)',
      }}>{React.cloneElement(I.plus, { size: 24, strokeWidth: 2.4 })}</button>

      <TabBar active="shopping"/>
    </Frame>
  );
}

function Category({ cat }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '4px 4px 8px',
      }}>
        <span className="mp-display" style={{ fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: -0.1 }}>
          {cat.cat}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>
          {cat.items.filter(x => x.done).length}/{cat.items.length}
        </span>
        <span style={{ flex: 1, height: 1, background: T.line, marginLeft: 4 }}/>
        <span style={{ color: T.faint, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }}>
          {React.cloneElement(I.chevDown, { size: 14 })}
        </span>
      </button>
      {open && (
        <div style={{ background: T.surface, borderRadius: T.rMd, border: `1px solid ${T.line}`, overflow: 'hidden' }}>
          {cat.items.map((x, i) => <Row key={x.name} item={x} last={i === cat.items.length - 1}/>)}
        </div>
      )}
    </div>
  );
}

function Row({ item, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${T.line}`,
      opacity: item.done ? 0.55 : 1,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 7, flexShrink: 0,
        background: item.done ? T.sage : 'transparent',
        border: `1.6px solid ${item.done ? T.sage : T.line2}`,
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{item.done && React.cloneElement(I.check, { size: 14, strokeWidth: 3 })}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontSize: 14.5, fontWeight: 600, color: T.ink,
            textDecoration: item.done ? 'line-through' : 'none',
          }}>{item.name}</span>
          <span style={{ fontSize: 12.5, color: T.muted, fontWeight: 500 }}>{item.qty}</span>
        </div>
        <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: T.faint }}>need by {item.date}</span>
          {item.recipe && (
            <span style={{ fontSize: 11.5, color: T.muted, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              · {item.recipe}
            </span>
          )}
          {item.promo && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 999, background: T.amberSoft, color: '#8A4F12',
              fontSize: 11, fontWeight: 700,
            }}>
              {React.cloneElement(I.tag, { size: 10, strokeWidth: 2 })}
              {item.promo} promo
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// W02 — Home / Dashboard
// ────────────────────────────────────────────────────────────────────────
function W02() {
  const today = WEEK[2]; // Wednesday — żurek
  return (
    <Frame label="W02 Home">
      <Body top={6} bottom={104}>
        {/* Greeting */}
        <div style={{ padding: '6px 4px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>Wednesday · May 21</div>
              <h1 className="mp-display" style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 700, lineHeight: 1.05 }}>
                Cześć, Ania
              </h1>
            </div>
            <button style={{
              width: 40, height: 40, borderRadius: 20,
              background: T.surface, border: `1px solid ${T.line}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.ink2,
            }}>{React.cloneElement(I.search, { size: 18 })}</button>
          </div>
        </div>

        {/* Today's dinner — hero */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ position: 'relative' }}>
            <Placeholder height={150} label="today's dinner · żurek" radius={0} tone="warm"/>
            <div style={{
              position: 'absolute', top: 12, left: 12,
              padding: '5px 10px', borderRadius: 999,
              background: 'rgba(31,27,22,0.85)', color: T.bg,
              fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
            }}>Tonight</div>
          </div>
          <div style={{ padding: '14px 16px 16px' }}>
            <h2 className="mp-display" style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.15 }}>
              {today.dish}
            </h2>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Badge tone="amber" icon={I.clock}>{today.time}</Badge>
              <Badge tone="blue" icon={I.repeat}>Uses Mon leftovers</Badge>
              <Badge tone="neutral" icon={I.euro}>{today.cost}</Badge>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <Button variant="primary" full={false} icon={I.book} style={{ flex: 1, height: 46 }}>Open recipe</Button>
              <button style={{
                width: 46, height: 46, borderRadius: 23,
                background: T.surface, border: `1px solid ${T.line2}`, color: T.ink2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{React.cloneElement(I.more, { size: 20 })}</button>
            </div>
          </div>
        </Card>

        {/* Quick stats row */}
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat
            top="Day 3 of 7"
            bottom="4 dinners remaining"
            icon={I.plan}
            tone="sage"
          />
          <Stat
            top="8 items"
            bottom="left to buy"
            icon={I.cart}
            tone="amber"
          />
        </div>

        {/* Sunday CTA */}
        <Card style={{
          marginTop: 14, padding: 16,
          background: '#1F1B16', color: T.bg,
          border: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 22, flexShrink: 0,
              background: 'rgba(251,247,241,0.12)', color: T.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{React.cloneElement(I.refresh, { size: 22, strokeWidth: 2 })}</div>
            <div style={{ flex: 1 }}>
              <div className="mp-display" style={{ fontSize: 15, fontWeight: 600, color: T.bg }}>Sunday is in 4 days</div>
              <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 2 }}>Plan next week early — get groceries Sat.</div>
            </div>
            <button style={{
              padding: '8px 14px', borderRadius: 999,
              background: T.bg, color: T.ink,
              fontSize: 12.5, fontWeight: 700,
            }}>Start</button>
          </div>
        </Card>

        {/* Family activity */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h3 className="mp-display" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Family activity</h3>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { name: 'Ania', tone: 'amber', text: 'checked 3 items off the list', when: '12m' },
              { name: 'Piotr', tone: 'plum', text: 'reacted 👍 to Tuesday\u2019s pasta', when: '2h' },
              { name: 'Jakub', tone: 'sage', text: 'opened żurek recipe', when: '4h' },
            ].map((x, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
                <Avatar name={x.name} tone={x.tone} size={24}/>
                <div style={{ flex: 1, fontSize: 13, color: T.ink2 }}>
                  <span style={{ fontWeight: 600, color: T.ink }}>{x.name}</span> {x.text}
                </div>
                <div style={{ fontSize: 11.5, color: T.faint }}>{x.when}</div>
              </div>
            ))}
          </div>
        </div>
      </Body>
      <TabBar active="plan"/>
    </Frame>
  );
}

function Stat({ top, bottom, icon, tone }) {
  const tones = { sage: ['#E7EFDD', '#3F5733'], amber: ['#F8E9D2', '#8A4F12'] };
  const c = tones[tone];
  return (
    <Card style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12, flexShrink: 0,
        background: c[0], color: c[1],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{React.cloneElement(icon, { size: 18, strokeWidth: 2 })}</div>
      <div>
        <div className="mp-display" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>{top}</div>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{bottom}</div>
      </div>
    </Card>
  );
}

Object.assign(window, { W08, W09, W02 });
