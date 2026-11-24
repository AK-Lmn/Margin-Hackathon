"use client";
import { InferenceSource } from "firebase/ai";
import { explainCloudOnly, explainWith, guardDevice, type Runner, type Source } from "./explain";
import { cloudModel, onDeviceModel } from "./firebase";
import type { Facts } from "./grounding";

export { CloudConsentError, UngroundedError, type AiResult } from "./explain";

const DEVICE_TIMEOUT_MS = 30_000;
const CLOUD_TIMEOUT_MS = 30_000;

const toSource = (s: unknown): Source => (s === InferenceSource.ON_DEVICE ? "ON_DEVICE" : "IN_CLOUD");

/** Chrome's Prompt API. Without it the SDK would answer "on-device" requests from the cloud. */
const hasPromptApi = () => typeof self !== "undefined" && "LanguageModel" in self && !!(self as { LanguageModel?: unknown }).LanguageModel;

const deviceRunner: Runner = guardDevice(async (prompt) => {
  const m = onDeviceModel();
  await m.initializeDeviceModel();
  const r = await m.generateContent(prompt);
  return { text: r.response.text(), source: toSource(r.response.inferenceSource) };
}, hasPromptApi);

const cloudRunner: Runner = async (prompt) => {
  const r = await cloudModel().generateContent(prompt);
  return { text: r.response.text(), source: toSource(r.response.inferenceSource) };
};

let warmed = false;

/**
 * Loads the on-device model ahead of time so the first answer doesn't pay for it.
 * Call from a user gesture (Chrome requires one). Safe to call repeatedly; failures are silent
 * because the real call handles them.
 */
export function warmUpOnDevice(): void {
  if (warmed || !hasPromptApi()) return;
  warmed = true;
  onDeviceModel()
    .initializeDeviceModel()
    .catch(() => {
      warmed = false;
    });
}

/**
 * Three short answers. Must be called from a click: Chrome needs user activation to start the
 * on-device model. `allowCloud` is the seller's consent to send their products to the cloud model.
 */
export function explainShort(facts: Facts, allowCloud: boolean) {
  return explainWith(facts, {
    device: deviceRunner,
    cloud: cloudRunner,
    online: () => typeof navigator === "undefined" || navigator.onLine,
    allowCloud,
    deviceTimeoutMs: DEVICE_TIMEOUT_MS,
    cloudTimeoutMs: CLOUD_TIMEOUT_MS,
  });
}

/** Cloud model only, because the seller chose it. Their consent is handled by the caller. */
export function explainInCloud(facts: Facts) {
  return explainCloudOnly(facts, {
    cloud: cloudRunner,
    online: () => typeof navigator === "undefined" || navigator.onLine,
    cloudTimeoutMs: CLOUD_TIMEOUT_MS,
  });
}
