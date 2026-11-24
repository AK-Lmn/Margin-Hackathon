# Margin — Base Plan (BuildHybridAI 2026)

**What:** Margin — a small-seller app that answers three questions: am I making money, what should I charge, and what's not selling. Merged from three ideas (InTheBlack + PriceIt + DeadStock) into one app.
**Hackathon:** #BuildHybridAI 2026 on Devpost — build a Gen AI app with Firebase AI Logic hybrid inference.
**Deadline:** 30 Nov 2026, 5:00 PM ET = **1 Dec 2026, 6:00 AM Manila**. Submit on the evening of 30 Nov, do not cut it close.
**Team:** solo (registered as "Looking for teammates" — a teammate would add Android, not change the web scope).
**Status:** plan only. No design decided. No code written yet.

## Tech stack

- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **AI:** Firebase AI Logic (`firebase/ai`) — on-device Gemini Nano + cloud Gemini, two separate model instances (see §5)
- **Data:** `localStorage` only (products + monthly overhead, no database for v1)
- **Deploy:** Vercel (git push → preview → prod)

## Design direction

- **Reference:** Robinhood — one hero number + one chart, mobile-first, fast scanning, nothing decorative. (Kim picked it 24 Nov from a second reference batch; the first batch — Mercury, Stripe, Ramp, Wise, Brex, Revolut — was rejected as too enterprise-fintech.)
- **Layout, top to bottom:** one screen; a headline sentence ("You're making $X this month"); true profit in the largest type at the top; one chart under it (profit trend over time); the three AI answers below as three rows, each ending in an action button ("change price", "discount this").
- **Type & colour:** tabular numerals on every money figure; one accent colour; colour means status only (green = profit, red = losing money) and never as the only signal.
- **No:** gradients, glow, glassmorphism, emoji icons, decorative badges, centred hero, filler copy. One icon set (Lucide, already in her stack).
- **Motion:** per her UI animation playbook — 150–250ms, scale 0.97 on press, exits faster than entrances, animate for meaning not decoration, honour reduced-motion.
- **Mobile-first:** the seller is on a cheap phone at a market stall; desktop is secondary. Dense table for the product list, not a card grid.
- **Rules:** her `20-ways-to-unslop-ai-designs.md` checklist applies (one accent, specific headlines, enlarge the main feature, no filler badges, no redundant labels).

## 1. Problem, not the feature

**Who:** micro-sellers — small online sellers, market stalls, tiny shops. People who sell things but have no accounting system.
**Problem:** three questions they can't answer. Am I making money (cash comes in and goes out, no profit tracking)? What should I charge (they guess, and either scare customers off or leave money on the table)? What's not selling (dead stock is money sitting on a shelf)? And the hidden fourth: per-product margin isn't the whole story — a seller can have positive margin on everything and still lose money once rent, bills, supplies, and staff pay are counted.
**Done looks like:** a seller adds their products plus a monthly overhead figure, and gets three clear answers — true profit, a price to charge, and what's dead — plus a break-even line ("sell N units to break even this month") and a warning when they're losing money overall.
**Out of scope (explicit):** full accounting, POS / checkout, payments, inventory ordering, multi-user / teams, tax filing, live competitor tracking (v1 uses seller-entered data only), mobile apps (web only).

## 2. Constraints

- **Budget:** $0 — free tier only (Firebase free tier, Vercel hobby, no paid APIs). Text inference is free within Firebase usage limits.
- **Timeline:** real build days are ~24–30 Nov, with the Kane CLI deadline (26 Nov) in the middle. Call it **3 focused build days max**.
- **Team:** solo. Plan for solo; a teammate is a bonus, not a dependency.
- **Expected users:** judges + demo users. No real traffic, no scale requirements.
- **Security / privacy:** a seller's costs and prices are sensitive business data — they stay on-device for the instant answers; no login, no personal data collected, no tracking. Firebase AI Logic requires App Check — debug tokens are accepted in submissions.
- **Non-functional:** must load fast on cheap phones; must work offline for the core answers (the wifi-off demo — a seller at a market with bad signal); must never invent a cost, a price, or a sale.

## 3. Data first

Two entities, nothing more. No users table, no auth, no backend DB for v1.

**Product** (stored in `localStorage`):
```ts
type Product = {
  id: string;              // e.g. "phone-case-black"
  name: string;            // e.g. "Phone case"
  cost: number;            // what you paid per unit
  price: number;           // what you charge per unit
  stock: number;           // how many you have
  sold: number;            // how many sold this month
  lastSoldDate: string;    // ISO date of the last sale (empty = never sold)
};
```

**Overhead** (monthly, entered once, stored in `localStorage`):
```ts
type Overhead = {
  rent: number;            // monthly rent
  bills: number;           // monthly electricity / water / internet
  supplies: number;        // monthly packaging / supplies
  salaries: number;        // monthly staff pay (0 if solo)
};
```

**Answer:**
```ts
type Answer = {
  trueProfit: number;      // total revenue - total product costs - monthly overhead
  marginPct: number;       // (price - cost) / price, per product
  priceSuggestion: number; // cost + overhead share + target margin
  breakEvenUnits: number;  // monthly overhead / average margin per unit
  deadStock: string[];     // product ids with no sale in 30 days
  losingMoney: boolean;    // true when trueProfit < 0
  source: "ON_DEVICE" | "IN_CLOUD";
};
```

**Rules the whole app obeys:**
- The AI only ever computes from YOUR products and YOUR overhead. It never invents a cost, a price, or a sale.
- Profit is true profit: revenue minus product costs minus overhead. Gross margin alone is never presented as profit.
- If a product has no cost, the app says "add the cost to see your profit" instead of guessing.
- If there's no competitor data, the app says so — it never invents a competitor price.
- Dead stock is no sale in 30 days. Price below cost is flagged as "you're losing money on this" — never silently shown as fine.

## 4. Flows, not screens

**Main flow:** land → add products (or use the sample shop) → enter monthly overhead (or skip it — the app then labels profit as "before overhead") → instant three answers → act on one (change a price, discount dead stock) → next check.

**Loading:** the on-device answers show a brief "crunching…" state; the cloud dashboard shows skeleton rows while it loads.

**Empty states:**
- No products → "add a product first" + a sample-shop button so the demo never starts blank. The sample shop is generic (a small online shop, ~10 products, $ currency — phone case, water bottle, tote bag, notebook, mug) — not tied to any one country or market.
- No overhead entered → profit is labeled "before overhead" and the app prompts "add your monthly costs to see your true profit."

**Error states:**
- Nano unavailable → automatic cloud fallback, badge reads "Cloud". Never a dead end.
- AI call fails → visible error message with a retry, never a silent blank.
- Invalid input (negative price, negative cost) → inline validation, no crash.

**Awkward cases to design now, not later:**
- Price below cost — needs a designed warning ("you're losing money on this"), not a silent number.
- No sales yet — "no sales yet — profit is $0, here's what to price."
- All products selling — "nothing dead — nice."
- A seller with 100+ products — v1 handles a small list; the demo uses ~10.

**Demo flow (3-min video):** open app → sample shop already there → wifi OFF on camera → three answers appear with the "On-device • offline" badge ("you made $X this week, charge $Y for this, discount these 5") → wifi ON → cloud dashboard shows "here's what to do next."

## 5. Architecture + tradeoffs

- **Single Next.js monolith (App Router), no separate backend.** Simplest deploy, nothing to maintain. Cost: all logic lives client-side, which is fine because Firebase handles the AI.
- **localStorage, not Firestore.** Zero backend, instant loads, private by design (a seller's costs are sensitive). Cost: no cross-device sync (fine for a demo).
- **No auth.** No friction. Cost: no cross-device history (localStorage covers same-device).
- **Firebase AI Logic only, two model instances.** On-device and cloud need *different prompts* (short three answers vs. full shop strategy), so use two models instead of one `PREFER_ON_DEVICE` model:
  ```ts
  import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
  const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
  const onDevice = getGenerativeModel(ai, { mode: InferenceMode.ONLY_ON_DEVICE });
  const cloud = getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD, inCloudParams: { model: "gemini-3.5-flash-lite" } });
  ```
  `ONLY_ON_DEVICE` throws when Nano is unavailable, so the code falls back to cloud itself. Read the real source from `result.response.inferenceSource` (`"ON_DEVICE"` / `"IN_CLOUD"`) for the badge — never guess it. Call `model.initializeDeviceModel()` on the button click (user activation is required) before `generateContent()`.
- **On-device requirements (verified against the Firebase docs):** desktop Chrome 139+ with the flag `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, single-turn text generation only. Mobile gets cloud fallback — plan the demo on desktop Chrome.
- **Hosting:** Vercel, deploy on push.

**ADR (one line):** client-only monolith with localStorage, because the timeline is 3 build days and the data is single-user and sensitive — a backend would add setup time with zero demo value.

## 6. De-risk first

Do the spikes before building anything else. The scary parts:

1. **Nano + fallback (half a day, first):** a throwaway page that calls the SDK, tries on-device, shows the real `inferenceSource`, and forces fallback. If Nano doesn't run on your Chrome, the demo still works via cloud — but you need to know that on day one, not day nine. (The Intindi boilerplate already proved this pattern works with the same SDK — verify it on your Chrome, don't assume.)
2. **Grounded answers prompt:** prompt the model with a fixed product list + overhead and confirm it only returns numbers computed from that data, never invented costs, prices, or sales. Constrain the output format: JSON with the answer fields. Test with 3–4 fixed inputs, including a price-below-cost case and a no-overhead case.
3. **The math:** profit, margin, break-even, and dead-stock logic are pure functions — verify them against hand-computed examples before wiring the AI in. How long the sample shop takes to build sets how realistic the demo data can be.

## 7. Vertical slices

1. **Spike (half a day):** Nano on-device + fallback + grounded answers prompt.
2. **Slice 1 — MVP:** add products + monthly overhead → instant three answers on-device (true profit / price / dead stock). This alone is a submittable entry.
3. **Slice 2:** cloud shop dashboard ("here's what to do next" — pricing strategy, which dead stock to discount first, profit trends, break-even).
4. **Slice 3:** act on answers (change a price, mark discounted) + sample shop + edit/delete products + overhead editing.
5. **Slice 4:** polish, Vercel deploy, demo video, Devpost write-up, open-source LICENSE file.

**Later list (explicitly NOT in scope):** POS / checkout, payments, full accounting, tax, multi-user, live competitor tracking, inventory ordering, mobile apps.

## 8. Quality in, not on

- **Tests:** the profit, margin, break-even, and dead-stock math is pure functions on a fixed product list — unit-test it (price below cost is a loss; no sale in 30 days is dead; margin % is (price minus cost) divided by price; true profit subtracts overhead). The prompt gets a golden test: fixed products + overhead in → every number in the answer must trace back to the input, zero invented costs, prices, or sales.
- **Manual checklist for the demo flow:** wifi-off answers, fallback when Nano is missing, empty product list, product with no cost, price below cost, no sales yet, all selling, overhead missing (labeled "before overhead").
- **Deploys:** Vercel preview per push. Record the video against prod, not localhost.
- **Knowing when it breaks:** no backend, so no alerts. Instead the app always shows the inference-source badge, and any AI failure shows a visible error state with a retry — never a silent blank.

## Build timeline

| When | What |
| --- | --- |
| 24 Nov (tonight) | Spike + sample shop |
| 25–26 Nov | MVP (Slice 1). Kane CLI due 26 Nov, so this must be small |
| 27–28 Nov | Slices 2–3 (cloud dashboard, act on answers) |
| 29 Nov | Polish + Vercel deploy |
| 30 Nov evening | Record video, submit (deadline 1 Dec, 6:00 AM Manila) |

## Submission checklist (Devpost)

- [ ] Public repo with an open-source license file (Apache preferred, any detectable license works)
- [ ] Firebase AI Logic imported AND actually called at runtime (not just named in the README)
- [ ] Demo video ≤ 3 minutes on YouTube, in English or with English subtitles, showing the app working
- [ ] Text description: how Firebase AI Logic was used, features, value proposition
- [ ] Hosted project URL (Vercel) included
- [ ] At least one platform selected (Web / Chrome)

## Handoff notes (for Claude / whoever builds this)

- Build from this doc, not from memory. If a detail here conflicts with something in chat, this doc wins.
- Do not invent costs, prices, or sales. Every number in an answer must trace back to the seller's own products and overhead.
- Profit is always true profit (revenue minus product costs minus overhead). If overhead is missing, label it "before overhead" — never present gross margin as profit.
- Keep the on-device / cloud split real: two models, two prompts, real `inferenceSource` badge. If Nano is unavailable, cloud fallback — never a fake "on-device" label.
- The demo shop is generic (a small online shop, ~10 products, $ currency) — not tied to any one country or market.
- Design direction is decided (see Design direction above): Robinhood-style — one hero number, one chart, mobile-first. Build the flows above in that direction; do not add decoration beyond those rules.
