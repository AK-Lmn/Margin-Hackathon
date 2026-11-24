"use client";
import { InferenceSource } from "firebase/ai";
import { cloudModel, onDeviceModel } from "./firebase";
import {
  cloudPrompt,
  onDevicePrompt,
  parseShortAnswers,
  parseStrategy,
  validateGrounded,
  type Facts,
  type ShortAnswers,
  type Strategy,
} from "./grounding";

export type Source = "ON_DEVICE" | "IN_CLOUD";
export type AiResult<T> = { value: T; source: Source };

/** The model produced something we refuse to show. Carries the reason for the UI. */
export class UngroundedError extends Error {}

type Model = ReturnType<typeof cloudModel>;

async function generate(model: Model, prompt: string): Promise<{ text: string; source: Source }> {
  const r = await model.generateContent(prompt);
  // Read the real source from the SDK. Never guess it.
  const source: Source = r.response.inferenceSource === InferenceSource.ON_DEVICE ? "ON_DEVICE" : "IN_CLOUD";
  return { text: r.response.text(), source };
}

function checkShort(a: ShortAnswers | null, facts: Facts): ShortAnswers {
  if (!a) throw new UngroundedError("The model's reply wasn't in the expected format.");
  const bad = validateGrounded(`${a.profit} ${a.price} ${a.dead}`, facts);
  if (!bad.ok) {
    throw new UngroundedError(
      `The model used a number that isn't in your data (${bad.invented.join(", ")}), so Margin threw the answer away.`,
    );
  }
  return a;
}

let warmed = false;

/**
 * Loads the on-device model ahead of time so the first answer doesn't pay for it.
 * Call from a user gesture (Chrome requires one). Safe to call repeatedly; failures are silent
 * because the real call falls back to cloud anyway.
 */
export function warmUpOnDevice(): void {
  if (warmed) return;
  warmed = true;
  onDeviceModel()
    .initializeDeviceModel()
    .catch(() => {
      warmed = false;
    });
}

/**
 * Three short answers. Tries on-device first (private, works offline), then cloud.
 * Must be called from a click: Chrome needs user activation to start the on-device model.
 */
export async function explainShort(facts: Facts): Promise<AiResult<ShortAnswers>> {
  try {
    const m = onDeviceModel();
    await m.initializeDeviceModel();
    const { text, source } = await generate(m, onDevicePrompt(facts));
    return { value: checkShort(parseShortAnswers(text), facts), source };
  } catch (e) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw e instanceof UngroundedError ? e : new Error("On-device AI isn't available here and you're offline.");
    }
  }
  const { text, source } = await generate(cloudModel(), onDevicePrompt(facts));
  return { value: checkShort(parseShortAnswers(text), facts), source };
}

/** Fuller shop plan. Cloud only. */
export async function shopStrategy(facts: Facts): Promise<AiResult<Strategy>> {
  const { text, source } = await generate(cloudModel(), cloudPrompt(facts));
  const s = parseStrategy(text);
  if (!s) throw new UngroundedError("The model's reply wasn't in the expected format.");
  const bad = validateGrounded(`${s.summary} ${s.steps.join(" ")}`, facts);
  if (!bad.ok) {
    throw new UngroundedError(
      `The model used a number that isn't in your data (${bad.invented.join(", ")}), so Margin threw the plan away.`,
    );
  }
  return { value: s, source };
}
