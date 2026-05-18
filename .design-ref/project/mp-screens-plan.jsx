// mp-screens-plan.jsx — W04 (hero), W05, W07

// ─── Data ────────────────────────────────────────────────────────────────
const WEEK = [
  { day: 'Monday',    date: '19', dish: 'Kotlet schabowy z ziemniakami',  time: '45 min', diff: 'easy',   cost: '€€',  kid: true,  leftover: true,  reason: 'Family classic, makes great lunchboxes' },
  { day: 'Tuesday',   date: '20', dish: 'Makaron z kurczakiem i szpinakiem', time: '25 min', diff: 'easy', cost: '€',   kid: true,  leftover: false, reason: 'Weeknight 25-min, kids approved' },
  { day: 'Wednesday', date: '21', dish: 'Żurek z jajkiem i kiełbasą',     time: '30 min', diff: 'medium', cost: '€€',  kid: false, leftover: true,  reason: 'Uses Monday leftover kiełbasa' },
  { day: 'Thursday',  date: '22', dish: 'Pierogi z mięsem',               time: '20 min', diff: 'easy',   cost: '€',   kid: true,  leftover: false, reason: 'Quick — Ania has practice at 18:00', newTag: false },
  { day: 'Friday',    date: '23', dish: 'Łosoś pieczony z warzywami',     time: '35 min', diff: 'medium', cost: '€€€', kid: true,  leftover: false, reason: 'Try-new: oven salmon, low-effort' , newTag: true },
  { day: 'Saturday',  date: '24', dish: 'Pizza domowa z rodziną',         time: '60 min', diff: 'medium', cost: '€€',  kid: true,  leftover: false, reason: 'Weekend cooking-together meal' },
];

const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

function DishMeta({ dish, compact = false, gap = 6 }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap }}>
      <Badge tone="amber" icon={I.clock} size={compact ? 'sm' : 'md'}>{dish.time}</Badge>
      <Badge tone="neutral" icon={I.flame} size={compact ? 'sm' : 'md'}>{DIFF_LABEL[dish.diff]}</Badge>
      <Badge tone="neutral" icon={I.euro} size={compact ? 'sm' : 'md'}>{dish.cost}</Badge>
      {dish.kid && <Badge tone="sage" icon={I.kid} size={compact ? 'sm' : 'md'}>Kid-ok</Badge>}
      {dish.leftover && <Badge tone="blue" icon={I.repeat} size={compact ? 'sm' : 'md'}>Leftovers</Badge>}
      {dish.newTag && <Badge tone="plum" icon={I.star} size={compact ? 'sm' : 'md'}>Try-new</Badge>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// W04 — Weekly Plan Review (hero)
// ────────────────────────────────────────────────────────────────────────
function W04({ replacing = false }) {
  const target = WEEK[2]; // the dish being replaced in the overlay
  return (
    <Frame label="W04 Weekly Plan Review">
      <Body top={6} bottom={replacing ? 280 : 124}>
        {/* Header */}
        <div style={{ padding: '6px 4px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, color: T.muted, fontWeight: 600, letterSpacing: 0.2 }}>Next week</div>
              <h1 className="mp-display" style={{ margin: '2px 0 0', fontSize: 30, fontWeight: 700, lineHeight: 1.05, color: T.ink }}>
                May 19 – 25
              </h1>
            </div>
            <div style={{ display: 'flex', marginRight: -4 }}>
              <Avatar name="A" tone="amber" />
              <div style={{ marginLeft: -8 }}><Avatar name="P" tone="plum" ring/></div>
              <div style={{ marginLeft: -8 }}><Avatar name="J" tone="sage" ring/></div>
            </div>
          </div>

          {/* AI reasoning */}
          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: T.rMd,
            background: '#FFFFFF', border: `1px solid ${T.line}`,
            display: 'flex', gap: 10,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 11, flexShrink: 0,
              background: T.ink, color: T.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, fontFamily: '"Bricolage Grotesque", sans-serif',
            }}>ai</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.45, color: T.ink2 }}>
              <span style={{ color: T.ink, fontWeight: 600 }}>3 quick weekday meals, 2 leftover-friendly, 1 try-new.</span> Skipped broccoli & spicy. Saturday is a cooking-together night.
            </div>
          </div>

          {/* Restrictions */}
          <div style={{ marginTop: 10 }}>
            <RestrictionStrip />
          </div>
        </div>

        {/* Day rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {WEEK.map((d, i) => <DayCard key={i} dish={d} highlight={replacing && i === 2}/>)}
        </div>

        <div style={{ height: 8 }}/>
      </Body>

      {/* Sticky bottom */}
      {!replacing && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 84,
          padding: '12px 18px 14px',
          background: 'linear-gradient(180deg, rgba(251,247,241,0) 0%, #FBF7F1 28%)',
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" full={false} icon={I.refresh} style={{ flex: '0 0 auto', padding: '0 18px' }}>Regenerate</Button>
            <Button variant="primary" icon={I.check} style={{ flex: 1 }}>Approve plan</Button>
          </div>
        </div>
      )}

      {/* Replace overlay */}
      {replacing && <ReplaceSheet dish={target}/>}

      <TabBar active="plan"/>
    </Frame>
  );
}

function DayCard({ dish, highlight }) {
  return (
    <Card style={{
      padding: 14,
      ...(highlight ? { boxShadow: `0 0 0 2px ${T.ink}, 0 12px 32px -12px rgba(31,27,22,0.18)` } : {}),
    }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Day pill */}
        <div style={{
          width: 46, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          borderRadius: 12, padding: '6px 0',
          background: T.surface2, color: T.ink2,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{dish.day.slice(0, 3)}</div>
          <div className="mp-display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{dish.date}</div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div className="mp-display" style={{
              flex: 1, fontSize: 17, fontWeight: 600, lineHeight: 1.2,
              color: T.ink, letterSpacing: -0.2,
            }}>{dish.dish}</div>
            <button style={{
              width: 28, height: 28, borderRadius: 14, color: T.muted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: -2, marginRight: -4,
            }}>{React.cloneElement(I.more, { size: 18 })}</button>
          </div>
          <div style={{ marginTop: 8 }}>
            <DishMeta dish={dish} compact/>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ReplaceSheet({ dish }) {
  const opts = [
    { label: 'Simpler', sub: 'Same idea, fewer steps', icon: I.flame, tone: 'amber' },
    { label: 'Cheaper', sub: 'Use pantry staples', icon: I.euro, tone: 'sage' },
    { label: 'Healthier', sub: 'More veg, less fat', icon: I.heart, tone: 'sage' },
    { label: 'More kid-friendly', sub: 'Mild, familiar', icon: I.kid, tone: 'plum' },
    { label: 'Different cuisine', sub: 'Asian / Italian / …', icon: I.bowl, tone: 'blue' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: T.surface, borderTopLeftRadius: T.rXl, borderTopRightRadius: T.rXl,
      boxShadow: '0 -12px 40px rgba(31,27,22,0.18)',
      padding: '14px 18px 28px',
      maxHeight: '64%', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: T.line2, margin: '0 auto 12px' }}/>
      <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>Replace Wed</div>
      <div className="mp-display" style={{ marginTop: 2, fontSize: 19, fontWeight: 600, color: T.ink, lineHeight: 1.2 }}>
        {dish.dish}
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {opts.map((o) => (
          <button key={o.label} style={{
            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
            padding: '12px 14px', borderRadius: T.rMd,
            background: T.surface2,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 18, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: {
                amber: T.amberSoft, sage: T.sageSoft, plum: T.plumSoft, blue: T.blueSoft,
              }[o.tone],
              color: { amber: '#8A4F12', sage: '#3F5733', plum: '#5C3550', blue: '#2A4D63' }[o.tone],
            }}>{React.cloneElement(o.icon, { size: 18, strokeWidth: 2 })}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{o.label}</div>
              <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>{o.sub}</div>
            </div>
            {React.cloneElement(I.chev, { size: 18, stroke: T.faint })}
          </button>
        ))}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
          padding: '12px 14px', borderRadius: T.rMd,
          border: `1px dashed ${T.line2}`, color: T.muted,
        }}>
          {React.cloneElement(I.edit, { size: 16, strokeWidth: 2 })}
          <span style={{ fontSize: 14, fontWeight: 600 }}>Type your own request…</span>
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// W05 — Meal Card Detail / Preview (pre-approve)
// ────────────────────────────────────────────────────────────────────────
function W05() {
  const d = WEEK[1]; // Makaron with chicken
  const ingredients = [
    '350 g penne',
    '2 piersi z kurczaka',
    '150 g szpinaku (świeży)',
    '200 ml śmietany 18%',
    '2 ząbki czosnku',
    'Parmezan, oliwa',
  ];
  const actions = [
    { label: 'Keep', icon: I.check, tone: 'primary' },
    { label: 'Simpler', icon: I.flame },
    { label: 'Cheaper', icon: I.euro },
    { label: 'Kid-friendly', icon: I.kid },
    { label: 'Replace', icon: I.refresh },
  ];
  return (
    <Frame label="W05 Meal Detail">
      <Body top={6} bottom={180}>
        <div style={{ padding: '4px 4px 8px', display: 'flex', alignItems: 'center', gap: 8, color: T.muted }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {React.cloneElement(I.chev, { size: 18, style: { transform: 'rotate(180deg)' }})}
            <span style={{ fontSize: 13, fontWeight: 600 }}>Tuesday · May 20</span>
          </button>
        </div>

        <Placeholder height={140} label="dish photo · pasta with chicken" radius={T.rLg}/>

        <h2 className="mp-display" style={{ margin: '14px 0 6px', fontSize: 24, fontWeight: 700, lineHeight: 1.15, color: T.ink }}>
          {d.dish}
        </h2>

        <DishMeta dish={d}/>

        {/* AI reasoning */}
        <div style={{
          marginTop: 14, padding: '12px 14px', borderRadius: T.rMd,
          background: T.sageSoft, color: '#3F5733',
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.7 }}>Why this meal</div>
          <div style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.45 }}>
            Chicken is versatile for leftovers. Fits your 30-min weekday limit, and both kids said yes to creamy pasta last month.
          </div>
        </div>

        {/* Allergen safety */}
        <div style={{
          marginTop: 10, padding: '10px 14px', borderRadius: T.rMd,
          background: T.surface, border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 13, background: T.sageSoft,
            color: '#3F5733', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{React.cloneElement(I.check, { size: 14, strokeWidth: 2.5 })}</div>
          <div style={{ fontSize: 12.5, color: T.ink2 }}>
            <span style={{ fontWeight: 600, color: T.ink }}>Safe for your family</span> — no shellfish, no broccoli.
          </div>
        </div>

        {/* Ingredients preview */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 className="mp-display" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Ingredients · 4 portions</h3>
            <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Preview only</span>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
            {ingredients.map((x) => (
              <div key={x} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, color: T.ink2 }}>
                <span style={{ width: 4, height: 4, borderRadius: 2, background: T.faint, flexShrink: 0 }}/>
                <span>{x}</span>
              </div>
            ))}
          </div>
        </div>
      </Body>

      {/* Bottom action grid */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 84,
        padding: '12px 18px 14px',
        background: 'linear-gradient(180deg, rgba(251,247,241,0) 0%, #FBF7F1 30%)',
      }}>
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          paddingBottom: 4, marginBottom: 10,
        }}>
          {actions.slice(1).map((a) => (
            <button key={a.label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', borderRadius: 999,
              background: T.surface, border: `1px solid ${T.line2}`,
              fontSize: 13, fontWeight: 600, color: T.ink2, whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {React.cloneElement(a.icon, { size: 15, strokeWidth: 2 })}
              {a.label}
            </button>
          ))}
        </div>
        <Button variant="primary" icon={I.check}>Keep this dish</Button>
      </div>

      <TabBar active="plan"/>
    </Frame>
  );
}

// ────────────────────────────────────────────────────────────────────────
// W07 — Approved Plan
// ────────────────────────────────────────────────────────────────────────
function W07() {
  return (
    <Frame label="W07 Approved Plan">
      <Body top={6} bottom={104}>
        {/* Approved header */}
        <div style={{
          marginBottom: 14, padding: '14px 16px',
          borderRadius: T.rLg, background: T.sage, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 18, flexShrink: 0,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{React.cloneElement(I.check, { size: 20, strokeWidth: 2.5 })}</div>
          <div style={{ flex: 1 }}>
            <div className="mp-display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.2 }}>Plan approved</div>
            <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 1 }}>May 19 – 25 · 6 dinners locked</div>
          </div>
        </div>

        {/* Shopping ready card */}
        <Card style={{ padding: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: T.amberSoft, color: '#8A4F12',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{React.cloneElement(I.cart, { size: 22, strokeWidth: 2 })}</div>
          <div style={{ flex: 1 }}>
            <div className="mp-display" style={{ fontSize: 15, fontWeight: 600 }}>Shopping list ready</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>24 items · est. 142 zł at Biedronka</div>
          </div>
          {React.cloneElement(I.chev, { size: 18, stroke: T.faint })}
        </Card>

        {/* Share card */}
        <Card style={{
          padding: 14, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12,
          background: T.surface, borderStyle: 'dashed',
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: T.plumSoft, color: '#5C3550',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{React.cloneElement(I.share, { size: 20, strokeWidth: 2 })}</div>
          <div style={{ flex: 1 }}>
            <div className="mp-display" style={{ fontSize: 15, fontWeight: 600 }}>Share with family</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>Piotr & Jakub can claim cooking nights</div>
          </div>
          <button style={{
            padding: '8px 14px', borderRadius: 999, background: T.ink, color: T.bg,
            fontSize: 13, fontWeight: 700,
          }}>Invite</button>
        </Card>

        {/* Locked dinner list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {WEEK.map((d, i) => (
            <Card key={i} style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 42, flexShrink: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  borderRadius: 10, padding: '4px 0',
                  background: T.surface2, color: T.ink2,
                }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{d.day.slice(0, 3)}</div>
                  <div className="mp-display" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1 }}>{d.date}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mp-display" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25, color: T.ink }}>{d.dish}</div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: T.muted }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      {React.cloneElement(I.clock, { size: 12 })} {d.time}
                    </span>
                    <span>·</span>
                    <span>{d.cost}</span>
                    {d.kid && <><span>·</span><span style={{ color: '#3F5733' }}>kid-ok</span></>}
                  </div>
                </div>
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  fontSize: 12, fontWeight: 700, color: T.ink2,
                  padding: '6px 8px', borderRadius: 8,
                }}>
                  Recipe {React.cloneElement(I.chev, { size: 12 })}
                </button>
              </div>
            </Card>
          ))}
        </div>
      </Body>
      <TabBar active="plan"/>
    </Frame>
  );
}

Object.assign(window, { W04, W05, W07, WEEK });
