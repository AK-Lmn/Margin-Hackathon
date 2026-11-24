import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { initializeApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import { buildFacts, onDevicePrompt, parseShortAnswers, validateShort } from "./grounding";
import { sampleShop } from "./sample-shop";
import type { Product } from "./types";

/**
 * Live golden test against the real cloud model. Run with: LIVE=1 npx vitest run grounding.live
 * Skipped by default so CI and offline runs stay deterministic.
 */
const env = (() => {
  try {
    return Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .trim()
        .split("\n")
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    ) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
})();

const NOW = new Date("2026-11-24T00:00:00Z");
const p = (o: Partial<Product>): Product => ({
  id: "x", name: "Mug", cost: 5, price: 10, stock: 10, sold: 0, lastSoldDate: "", ...o,
});

const shop = sampleShop(NOW);
const cases: Record<string, ReturnType<typeof buildFacts>> = {
  "sample shop": buildFacts(shop.products, shop.overhead, NOW),
  "price below cost": buildFacts([p({ name: "Stand", cost: 8, price: 5, sold: 4, lastSoldDate: "2026-11-20" })], shop.overhead, NOW),
  "no overhead": buildFacts(shop.products, null, NOW),
  "no sales": buildFacts([p({ name: "Lamp" })], shop.overhead, NOW),
  "no cost": buildFacts([p({ name: "Pin", cost: null, sold: 3, lastSoldDate: "2026-11-20" })], null, NOW),
};

// The web API key only accepts calls from known sites, and App Check is enforced. Browsers send a
// referrer and get tokens from reCAPTCHA; Node has neither, so add a referrer and trade the
// registered debug token (NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN) for a one-time App Check token per call.
const realFetch = globalThis.fetch;
async function appCheckToken(): Promise<string | null> {
  const debugToken = env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN;
  if (!debugToken) return null;
  const project = env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const res = await realFetch(
    `https://firebaseappcheck.googleapis.com/v1/projects/${project}/apps/${env.NEXT_PUBLIC_FIREBASE_APP_ID}:exchangeDebugToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "http://localhost:3001/" },
      body: JSON.stringify({ debugToken, limitedUse: true }),
    },
  );
  return res.ok ? ((await res.json()) as { token: string }).token : null;
}
globalThis.fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("Referer", "http://localhost:3001/");
  if (String(input instanceof Request ? input.url : input).includes("firebasevertexai")) {
    const token = await appCheckToken();
    if (token) headers.set("X-Firebase-AppCheck", token);
  }
  return realFetch(input, { ...init, headers });
};

describe.skipIf(!process.env.LIVE || !env.NEXT_PUBLIC_FIREBASE_API_KEY)("live grounding", () => {
  const app = initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  const model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), { model: "gemini-3.5-flash-lite" });

  for (const [name, facts] of Object.entries(cases)) {
    it(`${name}: reply parses and every number traces to the input`, { timeout: 60_000 }, async () => {
      const r = await model.generateContent(onDevicePrompt(facts));
      const text = r.response.text();
      const a = parseShortAnswers(text);
      expect(a, `unparseable: ${text}`).not.toBeNull();
      const v = validateShort(a!, facts);
      expect(v, `ungrounded: ${text}`).toEqual({ ok: true });
    });
  }
});
