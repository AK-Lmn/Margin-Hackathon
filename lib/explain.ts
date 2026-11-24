import { onDevicePrompt, parseShortAnswers, validateShort, type Facts, type ShortAnswers } from "./grounding";

export type Source = "ON_DEVICE" | "IN_CLOUD";
export type AiResult<T> = { value: T; source: Source };

/** Calls one model with a prompt. The real source comes from the SDK, never guessed. */
export type Runner = (prompt: string) => Promise<{ text: string; source: Source }>;

/** The model produced something we refuse to show. The message says why. */
export class UngroundedError extends Error {}

/** On-device failed and the seller has not agreed to send their data to the cloud. */
export class CloudConsentError extends Error {
  constructor() {
    super("On-device AI isn't available right now.");
  }
}

export type Deps = {
  device: Runner;
  cloud: Runner;
  online: () => boolean;
  /** True once the seller agreed to send product names, costs and prices to the cloud model. */
  allowCloud: boolean;
  /** How long on-device may take before we give up on it. */
  deviceTimeoutMs: number;
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
  if (!d.allowCloud) throw new CloudConsentError();
  return attempt(d.cloud, facts);
}
