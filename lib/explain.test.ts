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
  cloudTimeoutMs: 50,
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

describe("guardDevice: the on-device path must never reach the cloud", () => {
  it("does not call the model at all when the browser has no on-device API", async () => {
    const { guardDevice } = await import("./explain");
    let called = false;
    const run: Runner = async () => ((called = true), { text: good, source: "IN_CLOUD" });
    await expect(guardDevice(run, () => false)("x")).rejects.toThrow(/not available/);
    expect(called).toBe(false);
  });
  it("refuses an answer that the SDK says came from the cloud", async () => {
    const { guardDevice } = await import("./explain");
    await expect(guardDevice(ok(good, "IN_CLOUD"), () => true)("x")).rejects.toThrow(/cloud/i);
  });
  it("passes a genuine on-device answer through", async () => {
    const { guardDevice } = await import("./explain");
    await expect((await guardDevice(ok(good, "ON_DEVICE"), () => true)("x")).source).toBe("ON_DEVICE");
  });
  it("without the on-device API, the app asks for consent instead of calling the cloud", async () => {
    const { guardDevice } = await import("./explain");
    let cloudCalled = false;
    const cloud: Runner = async () => ((cloudCalled = true), { text: good, source: "IN_CLOUD" });
    const sdkLeak = ok(good, "IN_CLOUD"); // what the SDK does with no adapter: answers from the cloud
    await expect(
      explainWith(facts, deps({ device: guardDevice(sdkLeak, () => false), cloud, allowCloud: false })),
    ).rejects.toBeInstanceOf(CloudConsentError);
    expect(cloudCalled).toBe(false);
  });
});

describe("a stalled cloud call does not spin forever", () => {
  it("gives up after the cloud timeout and says so", async () => {
    await expect(
      explainWith(facts, deps({ device: fails, cloud: hangs, cloudTimeoutMs: 20 })),
    ).rejects.toThrow(/cloud model took too long/i);
  });
});

describe("the consent prompt carries the real reason on-device failed", () => {
  it("passes the device error message along", async () => {
    const reasonErr = async () => {
      throw new Error("Local LanguageModel API not available in this environment.");
    };
    try {
      await explainWith(facts, deps({ device: reasonErr, allowCloud: false }));
      throw new Error("should have asked for consent");
    } catch (e) {
      expect(e).toBeInstanceOf(CloudConsentError);
      expect((e as CloudConsentError).reason).toContain("LanguageModel API not available");
    }
  });
  it("has a reason even for a stuck model", async () => {
    try {
      await explainWith(facts, deps({ device: hangs, deviceTimeoutMs: 20, allowCloud: false }));
      throw new Error("should have asked for consent");
    } catch (e) {
      expect((e as CloudConsentError).reason).toMatch(/took too long/);
    }
  });
});

describe("explainCloudOnly: the seller chose the cloud model", () => {
  const cloudDeps = (o: Partial<{ cloud: Runner; online: () => boolean; cloudTimeoutMs: number }> = {}) => ({
    cloud: ok(good, "IN_CLOUD") as Runner,
    online: () => true,
    cloudTimeoutMs: 50,
    ...o,
  });
  it("answers from the cloud and reports the cloud as the source", async () => {
    const { explainCloudOnly } = await import("./explain");
    const r = await explainCloudOnly(facts, cloudDeps());
    expect(r.source).toBe("IN_CLOUD");
    expect(r.value.profit.length).toBeGreaterThan(0);
  });
  it("says so when there is no connection, without trying", async () => {
    const { explainCloudOnly } = await import("./explain");
    let called = false;
    const cloud: Runner = async () => ((called = true), { text: good, source: "IN_CLOUD" });
    await expect(explainCloudOnly(facts, cloudDeps({ cloud, online: () => false }))).rejects.toThrow(/offline/i);
    expect(called).toBe(false);
  });
  it("still refuses an answer with numbers that are not in the data", async () => {
    const { explainCloudOnly } = await import("./explain");
    await expect(explainCloudOnly(facts, cloudDeps({ cloud: ok(invented, "IN_CLOUD") }))).rejects.toBeInstanceOf(UngroundedError);
  });
  it("gives up on a stalled cloud call", async () => {
    const { explainCloudOnly } = await import("./explain");
    await expect(explainCloudOnly(facts, cloudDeps({ cloud: hangs, cloudTimeoutMs: 20 }))).rejects.toThrow(/took too long/);
  });
});
