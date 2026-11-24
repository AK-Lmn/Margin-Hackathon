"use client";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  ThinkingLevel,
  type GenerativeModel,
} from "firebase/ai";

const CLOUD_MODEL = "gemini-3.5-flash-lite";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

let appCheckOn = false;

function app(): FirebaseApp {
  if (getApps().length) return getApp();
  const a = initializeApp(config);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    if (process.env.NODE_ENV === "development") {
      // Debug token comes from the environment or is generated in the console. Never hardcode one.
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN || true;
    }
    initializeAppCheck(a, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
    appCheckOn = true;
  } else if (process.env.NODE_ENV === "production") {
    console.warn("Margin: App Check is off (no NEXT_PUBLIC_RECAPTCHA_SITE_KEY). Anyone can call the AI with this key.");
  }
  return a;
}

let ai: ReturnType<typeof getAI> | null = null;
function getAi() {
  if (!ai) {
    ai = getAI(app(), { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: appCheckOn });
  }
  return ai;
}

let onDevice: GenerativeModel | null = null;
let cloud: GenerativeModel | null = null;

/** Gemini Nano in Chrome. Throws when unavailable: callers fall back to cloud themselves. */
export function onDeviceModel(): GenerativeModel {
  return (onDevice ??= getGenerativeModel(getAi(), { mode: InferenceMode.ONLY_ON_DEVICE }));
}

export function cloudModel(): GenerativeModel {
  return (cloud ??= getGenerativeModel(getAi(), {
    mode: InferenceMode.ONLY_IN_CLOUD,
    // LOW thinking: these are short rewrites of numbers we already computed, so speed matters more.
    inCloudParams: { model: CLOUD_MODEL, generationConfig: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } },
  }));
}
