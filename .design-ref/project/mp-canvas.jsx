// mp-canvas.jsx — wires all 9 screens into the design canvas

const FRAME_W = 390;
const FRAME_H = 844;

function App() {
  return (
    <DesignCanvas>
      <DCSection
        id="hero"
        title="W04 · Weekly Plan Review"
        subtitle="The hero. Sunday return. AI proposes, family approves."
      >
        <DCArtboard id="w04-primary" label="Primary — 6 dinners" width={FRAME_W} height={FRAME_H}>
          <W04 />
        </DCArtboard>
        <DCArtboard id="w04-replace" label="Replacing Wednesday" width={FRAME_W} height={FRAME_H}>
          <W04 replacing />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="cook"
        title="W08 · W09 · W02 — Cook, Shop, Home"
        subtitle="Daily-use surfaces. Persistent tab bar across all."
      >
        <DCArtboard id="w08" label="W08 · Recipe Card" width={FRAME_W} height={FRAME_H}>
          <W08 />
        </DCArtboard>
        <DCArtboard id="w09" label="W09 · Shopping List" width={FRAME_W} height={FRAME_H}>
          <W09 />
        </DCArtboard>
        <DCArtboard id="w02" label="W02 · Home / Dashboard" width={FRAME_W} height={FRAME_H}>
          <W02 />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="plan2"
        title="W05 · W07 — Approving a meal, approving a week"
        subtitle="Pre-approve detail · post-approve stable view"
      >
        <DCArtboard id="w05" label="W05 · Meal Card Detail" width={FRAME_W} height={FRAME_H}>
          <W05 />
        </DCArtboard>
        <DCArtboard id="w07" label="W07 · Approved Plan" width={FRAME_W} height={FRAME_H}>
          <W07 />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="family"
        title="W14 · W12 — Family settings & weekly review"
        subtitle="Restrictions are sacred; reactions teach the AI."
      >
        <DCArtboard id="w14" label="W14 · Family Preferences" width={FRAME_W} height={FRAME_H}>
          <W14 />
        </DCArtboard>
        <DCArtboard id="w12" label="W12 · Weekly Review" width={FRAME_W} height={FRAME_H}>
          <W12 />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="onboarding"
        title="T03 — Telegram onboarding"
        subtitle="Different chrome: this lives in Telegram chat, not the mini-app."
      >
        <DCArtboard id="t03" label="T03 · Extraction Summary" width={FRAME_W} height={FRAME_H}>
          <T03 />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
