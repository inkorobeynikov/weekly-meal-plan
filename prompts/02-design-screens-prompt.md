# Design Agent Prompt — MVP Screens

## Product Context

**Weekly Meal Planner** — a Telegram mini app + PWA for families in Poland.

The primary surface is a **mobile web app** (opened inside Telegram WebView or as a PWA). It is not a desktop product. Design for a **375–430px wide viewport**, mobile-first.

**Core user:** a planning-parent who is tired of deciding what to cook every week. She opens the app on Sunday, approves a weekly dinner plan the AI built, and shares the shopping list with her family.

**Tone:** warm, practical, family-friendly. Not clinical or fitness-tracker-like. Not childish. Think of it as a smart family kitchen assistant.

---

## Design Principles (must be reflected in every screen)

1. **Show ready decisions first.** AI proposes; user edits. Never show empty forms asking users to fill everything.
2. **Explain why.** Every plan or suggestion should include a brief human-readable reason.
3. **Restrictions are sacred.** Allergies and hard dietary limits must be visually prominent — always.
4. **Collaboration is visible.** Family members are present in the UI (avatars/names) but not noisy.
5. **Promo hints are advisory.** Show as soft labels, never as primary UI.
6. **Optimize for Sunday return.** Every screen should feel like it's part of a weekly habit, not a one-time setup.

---

## Visual Style

- **Platform:** Mobile web / Telegram mini app
- **Color palette:** Warm and natural. Suggest using warm whites, soft greens (for fresh/vegetables), warm amber/orange (for cooking/warmth), cool blue-grey for system states. Avoid cold clinical whites or gym-app aesthetics.
- **Typography:** Clean, readable. Large enough for kitchen use (user may be reading with wet hands). Body min 16px.
- **Cards:** Rounded corners (16px+), soft shadows. Meal cards should feel like recipe cards, not data rows.
- **Bottom navigation:** 4 tabs — Plan / Shopping / Recipes / Family. Persistent. Icons + labels.
- **Buttons:** Full-width primary actions. Rounded. Clear tap targets (min 48px height).
- **Badges:** Use color badges for timing (main shop / buy later), feedback reactions, difficulty, cost.
- **Empty states:** Illustrated, warm, encouraging — not error-like.

---

## Screens to Design

Design the following screens as **mobile mockups (375px wide)**. For each screen, show both the primary state and the most important secondary/empty state where noted.

---

### Screen 1 — W04: Weekly Plan Review ⭐ (most important)

**This is the hero screen. Spend the most detail here.**

Primary state:
- Week header: "May 19–25" + AI reasoning summary (1–2 lines, e.g. "3 quick weekday meals, 2 leftover-friendly, 1 new recipe. No spicy food, no broccoli.")
- 6 dinner cards stacked vertically, each showing:
  - Day label (Monday, Tuesday…)
  - Dish name (large, readable)
  - Badges: time (e.g. "30 min"), difficulty (easy/medium/hard), cost (€/€€/€€€)
  - "Leftovers →" badge on cards where extra portions are planned
  - Kid-friendly ✓ indicator
  - Small action menu icon (replace / details)
- Bottom sticky bar: "Approve Plan" (primary full-width button) + "Regenerate" (ghost/secondary)
- Restriction notice bar near top: "✓ No broccoli · No spicy food · No shellfish" (small but visible)

Secondary state (one dish being replaced):
- Overlay or expanded card with replacement options: simpler / cheaper / healthier / kid-friendly / different style / custom text

---

### Screen 2 — W08: Recipe Card

- Title + badges (time, difficulty, servings, cost)
- Ingredients list with quantities (clean, scannable — like a real recipe card)
- Step-by-step instructions (numbered, readable font)
- Collapsible sections: Leftovers & storage / For kids / Substitutions
- Bottom action row: "Liked it" / "Don't repeat" / "Kids didn't eat" / "Too long"
- "Mark cooked" button (primary)

---

### Screen 3 — W09: Shopping List Overview

- Progress bar: "12 of 21 bought"
- Filter tabs: All / Main shop / Buy later / Bought
- Category sections (collapsible headers): Vegetables & Fruit / Meat & Fish / Dairy / Pantry / Other
- Each item row:
  - Checkbox (big tap target)
  - Product name + quantity
  - Needed by date (subtle)
  - Promo hint badge (optional, e.g. "🏷 Biedronka promo")
  - Related recipe label (subtle)
- Checked items move to "Bought" section or get strikethrough
- FAB: "+ Add item" in bottom right

---

### Screen 4 — W05: Meal Card Detail / Preview

- Full dish detail before approving the plan
- Dish name + AI reasoning ("Why this meal: chicken is versatile for leftovers and fits your 30-min weekday limit")
- Ingredient list preview (not full recipe)
- Badges: time, difficulty, cost, kid-friendly
- Allergen / restriction safety note
- Action buttons as a horizontal scroll or grid:
  - Keep ✓
  - Make simpler
  - Make cheaper
  - More kid-friendly
  - Replace completely

---

### Screen 5 — W07: Approved Plan (stable view)

- Same card list as W04 but locked (no replace buttons)
- "Plan approved ✓" status header
- Shopping list status card: "Shopping list ready — 24 items" → taps to shopping
- "Share with family" CTA card (invite link)
- Each meal card has "View recipe →" action

---

### Screen 6 — W02: Home / Dashboard

- Today's dinner card (large, prominent)
- Week progress: "Day 3 of 7 · 4 dinners remaining"
- Shopping quick summary: "8 items left to buy"
- CTA section: "Sunday is coming — ready to plan next week?"
- Family activity: small avatar row with "Ania checked 3 items" (subtle)

---

### Screen 7 — W14: Family Preferences

- Summary cards for each preference category:
  - ❤️ Likes: "pasta, chicken, soups, rice"
  - ✗ Dislikes: "broccoli, liver"
  - ⚠️ Restrictions & Allergies: "NO shellfish (allergy)" — visually prominent, red/amber
  - 🍳 Typical breakfasts: "eggs, toast, yogurt"
  - ⏱ Cooking time: "45 min on weekdays"
  - 🛒 Stores: "Biedronka, Lidl"
  - 💰 Budget: Normal · 🌍 Variety: Balanced
- Edit button on each card
- "Update based on last week's feedback" CTA

---

### Screen 8 — T03: Telegram Onboarding Extraction Summary (bot message)

Design as a **Telegram chat message**, not a mini app screen:
- Bot avatar
- Structured summary message in chat bubbles:
  - "Got it! Here's what I understood:"
  - "👨‍👩‍👧‍👦 Family: 2 adults, 2 children (school age)"
  - "🍽 Dinners at home: 6 per week, with leftovers for lunch"
  - "✓ Likes: pasta, chicken, soups"
  - "✗ Avoid: broccoli, spicy"
  - "⚠️ No allergens flagged"
- Two reply buttons: ✅ "That's correct" / ✏️ "Edit"

---

### Screen 9 — W12: Weekly Review

- Previous week's dishes as a scrollable card list
- Quick reaction buttons on each card: 👍 / 🔁 Don't repeat / 👶 Kids didn't eat
- Summary question cards:
  - "Anything to repeat next week?"
  - "Anything to remove?"
  - "Next week vibe?" (simpler / cheaper / more variety / same)
- Cognitive load slider 1–5: "How much did this reduce your meal stress?"
- "Submit review & build next week's plan" button

---

## Deliverable Format

For each screen, produce:
1. A **high-fidelity mobile mockup** at 375px width
2. Label all interactive elements clearly
3. Use realistic placeholder content (Polish family context: names like Ania/Piotr, Polish dishes like "Żurek", "Pierogi z mięsem", "Kotlet schabowy z ziemniakami")
4. Show the bottom navigation bar on all mini app screens (Plan / Shopping / Recipes / Family)

If you can only produce a subset, prioritize in this order: W04 → W09 → W08 → W07 → W05 → W02 → W14 → W12 → T03

---

## What NOT to design

- Desktop layouts
- Login/registration screens (auth is via Telegram — invisible to user)
- Admin panels
- Nutrition tracking dashboards (this is NOT a fitness/calorie app)
- Medical or clinical UI
