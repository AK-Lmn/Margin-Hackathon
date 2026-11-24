import { onDevicePrompt, parseShortAnswers, validateShort, type Facts, type ShortAnswers } from "./grounding";

export type Source = "ON_DEVICE" | "IN_CLOUD";
export type AiResult<T> = { value: T; source: Source };

/** Calls one model with a prompt. The real source comes from the SDK, never guessed. */
export type Runner = (prompt: string) => Promise<{ text: string; source: Source }>;

/** The model produced something we refuse to show. The message says why. */
export class UngroundedError extends Error {}

/** On-device failed and the seller has not agreed to send their data to the cloud. */
export class CloudConsentError extends Error {
  /** Why on-device failed, in the model or browser's own words. */
  readonly reason: string;
  constructor(reason = "") {
    super("On-device AI isn't available right now.");
    this.reason = reason;
  }
}

/**
 * Wraps the on-device runner so it can never reach the cloud.
 * The Firebase SDK quietly answers from the cloud when a browser has no Prompt API, even for a model
 * created as on-device only. So check support first (the call is never made), and refuse any answer
 * that the SDK reports as cloud-sourced.
 */
export function guardDevice(run: Runner, supported: () => boolean): Runner {
  return async (prompt) => {
    if (!supported()) throw new Error("On-device AI is not available in this browser.");
    const r = await run(prompt);
    if (r.source !== "ON_DEVICE") throw new Error("The on-device model answered from the cloud, so Margin refused it.");
    return r;
  };
}

export type Deps = {
  device: Runner;
  cloud: Runner;
  online: () => boolean;
  /** True once the seller agreed to send product names, costs and prices to the cloud model. */
  allowCloud: boolean;
  /** How long on-device may take before we give up on it. */
  deviceTimeoutMs: number;
  /** How long the cloud model may take. A stalled request would otherwise spin forever. */
  cloudTimeoutMs: number;
};

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} took too long.`)), ms);
  });
  return Promise.race([p, limit]).finally(() => clearTimeout(timer));
}

function check(text: string, facts: Facts): ShortAnswers {
  const a = parseShortAnswers(text);
  if (!a) throw new UngroundedError("The model's reply wasn't in the expected format.");
  const v = validateShort(a, facts);
  if (!v.ok) {
    throw new UngroundedError(
      `The model used a number that isn't in your data (${v.invented.join(", ")}), so Margin threw the answer away.`,
    );
  }
  return a;
}

async function attempt(run: Runner, facts: Facts): Promise<AiResult<ShortAnswers>> {
  const { text, source } = await run(onDevicePrompt(facts));
  return { value: check(text, facts), source };
}

/**
 * Three short answers. On-device first (private, works offline). Cloud only if the seller agreed,
 * because it sends their product names, costs and prices to Google.
 */
export async function explainWith(facts: Facts, d: Deps): Promise<AiResult<ShortAnswers>> {
  let deviceError: unknown;
  try {
    return await withTimeout(attempt(d.device, facts), d.deviceTimeoutMs, "On-device AI");
  } catch (e) {
    deviceError = e;
  }

  if (!d.online()) {
    throw deviceError instanceof UngroundedError
      ? deviceError
      : new Error("On-device AI isn't available here and you're offline.");
  }
  if (!d.allowCloud) throw new CloudConsentError(deviceError instanceof Error ? deviceError.message : "");
  return withTimeout(attempt(d.cloud, facts), d.cloudTimeoutMs, "The cloud model");
}
