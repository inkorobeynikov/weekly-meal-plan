// mp-screens-family.jsx — W14 Family Preferences, W12 Weekly Review, T03 Telegram

// ────────────────────────────────────────────────────────────────────────
// W14 — Family Preferences
// ────────────────────────────────────────────────────────────────────────
function W14() {
  return (
    <Frame label="W14 Family Preferences">
      <Body top={6} bottom={104}>
        {/* Header */}
        <div style={{ padding: '6px 4px 14px' }}>
          <h1 className="mp-display" style={{ margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1.05 }}>
            Family preferences
          </h1>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4, lineHeight: 1.4 }}>
            How AI plans for the Kowalski family. Edit any card to fine-tune next Sunday's plan.
          </div>

          {/* Members row */}
          <div style={{
            marginTop: 14, display: 'flex', gap: 10, padding: '12px 14px',
            background: T.surface, borderRadius: T.rMd, border: `1px solid ${T.line}`,
          }}>
            {[
              { name: 'Ania', role: 'adult', tone: 'amber' },
              { name: 'Piotr', role: 'adult', tone: 'plum' },
              { name: 'Jakub', role: 'age 9', tone: 'sage' },
              { name: 'Zosia', role: 'age 7', tone: 'blue' },
            ].map((m) => (
              <div key={m.name} style={{ flex: 1, textAlign: 'center' }}>
                <Avatar name={m.name} tone={m.tone} size={36}/>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, marginTop: 4 }}>{m.name}</div>
                <div style={{ fontSize: 10.5, color: T.muted }}>{m.role}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Update CTA */}
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', borderRadius: T.rMd, marginBottom: 14,
          background: T.sageSoft, color: '#3F5733', textAlign: 'left',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 15, flexShrink: 0,
            background: 'rgba(255,255,255,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{React.cloneElement(I.refresh, { size: 16, strokeWidth: 2 })}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Update from last week's feedback</div>
            <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 1 }}>3 reactions ready to apply</div>
          </div>
          {React.cloneElement(I.chev, { size: 16 })}
        </button>

        {/* Pref cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrefCard
            tone="restriction"
            label="Restrictions & allergies"
            items={['NO shellfish (Piotr allergy)', 'NO nuts in kid dishes']}
            sub="Hard limits. Never overridden by AI."
            icon={I.alert}
          />
          <PrefCard
            tone="sage"
            label="Likes"
            items={['Pasta', 'Chicken', 'Soups', 'Rice', 'Polish classics']}
            icon={I.heart}
          />
          <PrefCard
            tone="neutral"
            label="Dislikes"
            items={['Broccoli', 'Liver', 'Blue cheese']}
            sub="Avoid in dinners. Kids' picks weighted heavier."
            icon={I.cross}
          />
          <PrefCard
            tone="amber"
            label="Typical breakfasts"
            items={['Eggs', 'Toast', 'Yogurt with granola']}
            icon={I.bowl}
          />
          <Row14
            label="Cooking time"
            value="45 min weekdays · 90 min weekends"
            icon={I.clock}
            tone="amber"
          />
          <Row14
            label="Stores"
            value="Biedronka · Lidl"
            icon={I.bag}
            tone="plum"
          />

          {/* Sliders */}
          <Card style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Iconchip icon={I.euro} tone="sage"/>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Budget</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: T.muted }}>Normal</span>
            </div>
            <Segments labels={['Tight', 'Normal', 'Generous']} active={1}/>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
              <Iconchip icon={I.star} tone="plum"/>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Variety</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: T.muted }}>Balanced</span>
            </div>
            <Segments labels={['Predictable', 'Balanced', 'Adventurous']} active={1}/>
          </Card>
        </div>
      </Body>
      <TabBar active="family"/>
    </Frame>
  );
}

function Iconchip({ icon, tone }) {
  const tones = {
    sage:  [T.sageSoft, '#3F5733'],
    amber: [T.amberSoft, '#8A4F12'],
    plum:  [T.plumSoft, '#5C3550'],
    blue:  [T.blueSoft, '#2A4D63'],
    terra: [T.terraSoft, '#7E2D1A'],
    neutral: [T.surface2, T.ink2],
  }[tone];
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 14, flexShrink: 0,
      background: tones[0], color: tones[1],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{React.cloneElement(icon, { size: 15, strokeWidth: 2 })}</div>
  );
}

function PrefCard({ tone, label, items, sub, icon }) {
  const restriction = tone === 'restriction';
  return (
    <Card style={{
      padding: 14,
      background: restriction ? T.terraSoft : T.surface,
      border: `1px solid ${restriction ? '#E2B2A1' : T.line}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Iconchip icon={icon} tone={restriction ? 'terra' : tone}/>
        <span style={{
          fontSize: 14, fontWeight: 700,
          color: restriction ? '#7E2D1A' : T.ink,
          letterSpacing: -0.1, flex: 1,
        }}>{label}</span>
        <button style={{ color: T.muted, padding: 4 }}>{React.cloneElement(I.edit, { size: 16 })}</button>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map((x) => (
          <span key={x} style={{
            padding: '4px 10px', borderRadius: 999,
            background: restriction ? 'rgba(126,45,26,0.12)' : T.surface2,
            color: restriction ? '#7E2D1A' : T.ink2,
            fontSize: 12.5, fontWeight: 600,
            border: restriction ? `1px solid rgba(126,45,26,0.25)` : 'none',
          }}>{x}</span>
        ))}
      </div>
      {sub && (
        <div style={{
          marginTop: 8, fontSize: 11.5, color: restriction ? '#7E2D1A' : T.muted,
          opacity: restriction ? 0.85 : 1,
        }}>{sub}</div>
      )}
    </Card>
  );
}

function Row14({ label, value, icon, tone }) {
  return (
    <Card style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
      <Iconchip icon={icon} tone={tone}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{value}</div>
      </div>
      <button style={{ color: T.muted, padding: 4 }}>{React.cloneElement(I.edit, { size: 16 })}</button>
    </Card>
  );
}

function Segments({ labels, active }) {
  return (
    <div style={{ display: 'flex', background: T.surface2, padding: 3, borderRadius: 10, gap: 2 }}>
      {labels.map((l, i) => (
        <div key={l} style={{
          flex: 1, padding: '7px 0', textAlign: 'center',
          borderRadius: 8,
          background: i === active ? T.surface : 'transparent',
          color: i === active ? T.ink : T.muted,
          fontSize: 12, fontWeight: 600,
          boxShadow: i === active ? '0 1px 3px rgba(31,27,22,0.08)' : 'none',
        }}>{l}</div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// W12 — Weekly Review
// ────────────────────────────────────────────────────────────────────────
function W12() {
  const last = [
    { day: 'Mon', dish: 'Spaghetti bolognese',     reaction: 'liked' },
    { day: 'Tue', dish: 'Zupa pomidorowa',         reaction: 'kids' },
    { day: 'Wed', dish: 'Kotlety mielone z kaszą', reaction: null },
    { day: 'Thu', dish: 'Naleśniki z serem',       reaction: 'liked' },
    { day: 'Fri', dish: 'Risotto z grzybami',      reaction: 'repeat' },
    { day: 'Sat', dish: 'Kebab w domu',            reaction: 'liked' },
  ];
  const [stress, setStress] = React.useState(4);

  return (
    <Frame label="W12 Weekly Review">
      <Body top={6} bottom={104}>
        {/* Header */}
        <div style={{ padding: '6px 4px 12px' }}>
          <div style={{ fontSize: 13, color: T.muted, fontWeight: 600 }}>Wrap up</div>
          <h1 className="mp-display" style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
            How was last week?
          </h1>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4, lineHeight: 1.4 }}>
            Quick reactions teach the AI. Then we'll build next week.
          </div>
        </div>

        {/* Dish reactions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {last.map((d) => <DishReact key={d.day} dish={d}/>)}
        </div>

        {/* Summary cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SummaryQ
            label="Anything to repeat next week?"
            chips={['Risotto z grzybami', 'Naleśniki', 'Kebab w domu', 'None']}
            selected={[0]}
          />
          <SummaryQ
            label="Anything to remove?"
            chips={['Zupa pomidorowa', 'Kotlety mielone', 'None']}
            selected={[]}
          />
          <SummaryQ
            label="Next week vibe?"
            chips={['Simpler', 'Cheaper', 'More variety', 'Same']}
            selected={[2]}
          />
        </div>

        {/* Stress slider */}
        <Card style={{ marginTop: 14, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Meal stress relief</span>
            <span className="mp-display" style={{ fontSize: 18, fontWeight: 700, color: T.sage }}>{stress}/5</span>
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>How much did the plan reduce your decision load?</div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            {[1,2,3,4,5].map(n => {
              const on = n <= stress;
              return (
                <button key={n} onClick={() => setStress(n)} style={{
                  flex: 1, height: 44, borderRadius: 10,
                  background: on ? T.sage : T.surface2,
                  color: on ? '#fff' : T.muted,
                  fontSize: 14, fontWeight: 700,
                  transition: 'background .12s',
                }}>{n}</button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: T.faint }}>
            <span>Stressful</span><span>Effortless</span>
          </div>
        </Card>
      </Body>

      {/* Bottom CTA */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 84,
        padding: '10px 18px 14px',
        background: 'linear-gradient(180deg, rgba(251,247,241,0) 0%, #FBF7F1 30%)',
      }}>
        <Button variant="primary" icon={I.send}>Submit & build next plan</Button>
      </div>
      <TabBar active="plan"/>
    </Frame>
  );
}

function DishReact({ dish }) {
  const opts = [
    { id: 'liked',  icon: I.thumb,  tone: 'sage',  label: 'Liked' },
    { id: 'repeat', icon: I.repeat, tone: 'plum',  label: 'Repeat' },
    { id: 'kids',   icon: I.kid,    tone: 'amber', label: 'Kids skipped' },
  ];
  return (
    <Card style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          padding: '3px 8px', borderRadius: 6, background: T.surface2,
          fontSize: 10.5, fontWeight: 700, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase',
        }}>{dish.day}</div>
        <span className="mp-display" style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{dish.dish}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {opts.map((o) => {
          const on = dish.reaction === o.id;
          const tones = {
            sage:  [T.sageSoft, '#3F5733'],
            plum:  [T.plumSoft, '#5C3550'],
            amber: [T.amberSoft, '#8A4F12'],
          }[o.tone];
          return (
            <button key={o.id} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '8px 6px', borderRadius: 10,
              background: on ? tones[0] : 'transparent',
              color: on ? tones[1] : T.muted,
              border: `1px solid ${on ? 'transparent' : T.line2}`,
              fontSize: 12, fontWeight: 600,
            }}>
              {React.cloneElement(o.icon, { size: 13, strokeWidth: 2 })}
              {o.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function SummaryQ({ label, chips, selected }) {
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {chips.map((c, i) => {
          const on = selected.includes(i);
          return (
            <span key={c} style={{
              padding: '6px 12px', borderRadius: 999,
              background: on ? T.ink : T.surface2,
              color: on ? T.bg : T.ink2,
              fontSize: 12.5, fontWeight: 600,
              border: `1px solid ${on ? 'transparent' : 'transparent'}`,
            }}>{c}</span>
          );
        })}
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────
// T03 — Telegram bot onboarding extraction summary
// (different chrome: Telegram chat, not a mini-app)
// ────────────────────────────────────────────────────────────────────────
function T03() {
  return (
    <div className="mp" style={{
      width: 390, height: 844, background: '#EFEAE3', position: 'relative',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }} data-screen-label="T03 Telegram Chat">
      <StatusBar/>
      {/* Telegram header */}
      <div style={{
        height: 56, padding: '0 12px', flexShrink: 0,
        background: '#F8F4ED',
        borderBottom: `1px solid rgba(0,0,0,0.06)`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button style={{ color: '#3F6E89', display: 'flex', alignItems: 'center', gap: 2, padding: '4px 4px' }}>
          {React.cloneElement(I.chev, { size: 22, style: { transform: 'rotate(180deg)' }, stroke: '#3F6E89', strokeWidth: 2.4 })}
          <span style={{ fontSize: 17, fontWeight: 500 }}>Chats</span>
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 17, background: T.sage,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}>{React.cloneElement(I.bowl, { size: 18, strokeWidth: 2.2 })}</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, lineHeight: 1.1 }}>Mealplan</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>bot</div>
          </div>
        </div>
        <div style={{ width: 60 }}/>
      </div>

      {/* Chat */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: '16px 12px 100px',
        background: '#EFEAE3 url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'><circle cx=\'20\' cy=\'20\' r=\'1\' fill=\'rgba(0,0,0,0.04)\'/></svg>") repeat',
      }}>
        {/* Date stamp */}
        <div style={{ textAlign: 'center', margin: '4px 0 14px' }}>
          <span style={{
            padding: '3px 10px', borderRadius: 999,
            background: 'rgba(0,0,0,0.18)', color: '#fff',
            fontSize: 11, fontWeight: 600,
          }}>Today</span>
        </div>

        {/* user bubble */}
        <UserBubble time="14:21">
          We are a family of 4. Two kids, 9 and 7. We cook dinner at home most weekdays. Piotr is allergic to shellfish. The kids hate broccoli. We shop at Biedronka mostly.
        </UserBubble>

        {/* bot bubbles */}
        <BotBubble time="14:21">
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Got it! Here's what I understood:</div>
        </BotBubble>

        <BotBubble time="14:21" tight>
          <Line label="Family"   value="2 adults, 2 children (age 9 & 7)" icon={I.people} tone="plum"/>
          <Line label="Dinners"  value="6 per week at home, leftovers for lunch" icon={I.bowl} tone="amber"/>
          <Line label="Likes"    value="pasta, chicken, soups" icon={I.heart} tone="sage"/>
          <Line label="Avoid"    value="broccoli, spicy food" icon={I.cross} tone="neutral"/>
          <Line label="Allergens" value="shellfish (Piotr)" icon={I.alert} tone="terra" critical/>
          <Line label="Shopping" value="Biedronka primarily, Lidl backup" icon={I.bag} tone="neutral" last/>
        </BotBubble>

        <BotBubble time="14:21">
          <div style={{ fontSize: 13.5, color: T.ink2, lineHeight: 1.45 }}>
            Did I miss anything? You can edit later in the family page.
          </div>
        </BotBubble>
      </div>

      {/* Bot reply keyboard */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: '#F8F4ED', borderTop: `1px solid rgba(0,0,0,0.06)`,
        padding: '10px 10px 28px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <button style={{
          width: '100%', height: 46, borderRadius: 10,
          background: '#3F6E89', color: '#fff',
          fontSize: 15, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {React.cloneElement(I.check, { size: 18, strokeWidth: 2.4 })}
          That's correct
        </button>
        <button style={{
          width: '100%', height: 46, borderRadius: 10,
          background: '#fff', color: '#3F6E89', border: `1px solid rgba(63,110,137,0.25)`,
          fontSize: 15, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {React.cloneElement(I.edit, { size: 16, strokeWidth: 2.2 })}
          Edit
        </button>
      </div>
    </div>
  );
}

function UserBubble({ children, time }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
      <div style={{
        maxWidth: '80%', padding: '8px 12px 10px',
        background: '#E2F3D8', borderRadius: 16, borderBottomRightRadius: 4,
        position: 'relative',
        boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 14.5, lineHeight: 1.4, color: T.ink, paddingRight: 38 }}>{children}</div>
        <div style={{
          position: 'absolute', bottom: 6, right: 10,
          fontSize: 10.5, color: '#4a8a3f', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          {time}
          <svg width="14" height="9" viewBox="0 0 14 9" fill="none" stroke="#4a8a3f" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 5l3 3 6-7M6 8l6-7"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

function BotBubble({ children, time, tight }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: tight ? 4 : 8 }}>
      <div style={{ width: 28, flexShrink: 0 }}>
        {!tight && (
          <div style={{
            width: 28, height: 28, borderRadius: 14, background: T.sage,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{React.cloneElement(I.bowl, { size: 14, strokeWidth: 2.2 })}</div>
        )}
      </div>
      <div style={{
        maxWidth: '82%', padding: '8px 12px 10px',
        background: '#fff', borderRadius: 16, borderBottomLeftRadius: tight ? 16 : 4,
        position: 'relative',
        boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
      }}>
        {children}
        <div style={{
          marginTop: 2, fontSize: 10.5, color: T.faint, textAlign: 'right',
        }}>{time}</div>
      </div>
    </div>
  );
}

function Line({ label, value, icon, tone, critical, last }) {
  const tones = {
    sage:  '#3F5733', amber: '#8A4F12', plum: '#5C3550',
    blue:  '#2A4D63', terra: '#7E2D1A', neutral: T.ink2,
  };
  const bg = {
    sage: T.sageSoft, amber: T.amberSoft, plum: T.plumSoft,
    blue: T.blueSoft, terra: T.terraSoft, neutral: T.surface2,
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '7px 0',
      borderBottom: last ? 'none' : `1px solid ${T.line}`,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 12, flexShrink: 0,
        background: bg[tone], color: tones[tone],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>{React.cloneElement(icon, { size: 13, strokeWidth: 2.2 })}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11.5, fontWeight: 700,
          color: critical ? '#7E2D1A' : T.muted,
          letterSpacing: 0.3, textTransform: 'uppercase',
        }}>{label}{critical && ' · sacred'}</div>
        <div style={{
          fontSize: 13.5, color: critical ? '#7E2D1A' : T.ink,
          fontWeight: critical ? 700 : 500, lineHeight: 1.3, marginTop: 1,
        }}>{value}</div>
      </div>
    </div>
  );
}

Object.assign(window, { W14, W12, T03 });
