import { describe, expect, it } from "vitest";
import { CloudConsentError, UngroundedError, explainWith, type Deps, type Runner } from "./explain";
import { buildFacts, factLines } from "./grounding";
import { sampleShop } from "./sample-shop";

const NOW = new Date("2026-11-24T00:00:00Z");
const shop = sampleShop(NOW);
const facts = buildFacts(shop.products, shop.overhead, NOW);
const l = factLines(facts);
const good = `1. ${l.profit}\n2. ${l.price}\n3. ${l.dead}`;
const invented = `1. ${l.profit}\n2. Charge $13.37 for it.\n3. ${l.dead}`;

const ok = (text: string, source: "ON_DEVICE" | "IN_CLOUD"): Runner => async () => ({ text, source });
const fails: Runner = async () => {
  throw new Error("Nano unavailable");
};
const hangs: Runner = () => new Promise(() => {});

const deps = (o: Partial<Deps>): Deps => ({
  device: ok(good, "ON_DEVICE"),
  cloud: ok(good, "IN_CLOUD"),
  online: () => true,
  allowCloud: true,
  deviceTimeoutMs: 50,
  ...o,
});

describe("explainWith: on-device first, cloud only with consent", () => {
  it("uses on-device when it works, and never touches the cloud", async () => {
    let cloudCalled = false;
    const r = await explainWith(facts, deps({ cloud: async () => ((cloudCalled = true), { text: good, source: "IN_CLOUD" }) }));
    expect(r.source).toBe("ON_DEVICE");
    expect(cloudCalled).toBe(false);
  });
  it("falls back to cloud when on-device fails and the seller agreed", async () => {
    const r = await explainWith(facts, deps({ device: fails }));
    expect(r.source).toBe("IN_CLOUD");
  });
  it("asks for consent instead of sending data to the cloud", async () => {
    let cloudCalled = false;
    const cloud: Runner = async () => ((cloudCalled = true), { text: good, source: "IN_CLOUD" });
    await expect(explainWith(facts, deps({ device: fails, cloud, allowCloud: false }))).rejects.toBeInstanceOf(CloudConsentError);
    expect(cloudCalled).toBe(false);
  });
  it("says so when on-device fails and there is no connection", async () => {
    await expect(explainWith(facts, deps({ device: fails, online: () => false }))).rejects.toThrow(/offline/);
  });
  it("gives up on a stuck on-device model and uses cloud", async () => {
    const r = await explainWith(facts, deps({ device: hangs, deviceTimeoutMs: 20 }));
    expect(r.source).toBe("IN_CLOUD");
  });
  it("a stuck on-device model without consent asks for consent, not a frozen screen", async () => {
    await expect(explainWith(facts, deps({ device: hangs, deviceTimeoutMs: 20, allowCloud: false }))).rejects.toBeInstanceOf(CloudConsentError);
  });
  it("throws away an ungrounded on-device answer and tries cloud", async () => {
    const r = await explainWith(facts, deps({ device: ok(invented, "ON_DEVICE") }));
    expect(r.source).toBe("IN_CLOUD");
  });
  it("shows the reason when the on-device answer is ungrounded and we are offline", async () => {
    await expect(
      explainWith(facts, deps({ device: ok(invented, "ON_DEVICE"), online: () => false })),
    ).rejects.toBeInstanceOf(UngroundedError);
  });
  it("refuses an ungrounded cloud answer too", async () => {
    await expect(
      explainWith(facts, deps({ device: fails, cloud: ok(invented, "IN_CLOUD") })),
    ).rejects.toBeInstanceOf(UngroundedError);
  });
});
