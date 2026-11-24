# Margin

Margin is a web app for small sellers who have no accounting system. You enter your products, what they cost and your monthly overhead (rent, bills, supplies, staff pay). It shows your true profit, one price worth changing, and the stock that hasn't sold in 30 days.

It was built for the #BuildHybridAI 2026 hackathon on Devpost. A live copy runs at https://margin-projactsss.vercel.app.

## What it answers

- **Am I making money?** True profit is revenue minus product costs minus overhead. If you haven't entered overhead, the app labels the number "before overhead" and never presents gross margin as profit.
- **What should I charge?** The suggested price covers cost, a share of overhead and a 30% margin. With fewer than 10 units sold the overhead share is left out, because a few sales would put a whole month's rent on each unit. A product with no cost gets a prompt to add one, not a guess.
- **What isn't selling?** A product with stock and no sale in 30 days counts as dead stock. Margin can discount it by 20%, never below cost.

A break-even line shows how many units you need to sell this month to cover overhead.

## How Firebase AI Logic is used

Margin computes every number itself with plain, tested functions. The AI only explains those numbers in plain words, so it never does the math.

- **Two model instances.** `ONLY_ON_DEVICE` runs Chrome's built-in model. `ONLY_IN_CLOUD` runs `gemini-3.5-flash-lite` through Firebase AI Logic. The app tries on-device first because it is private and works offline.
- **Cloud is opt-in.** If on-device AI isn't available, or takes more than 30 seconds, Margin asks before sending your product names, costs and prices to the cloud model. The choice is remembered in your browser.
- **The source label is real.** The badge next to each answer reads the SDK's `inferenceSource` and shows how long the call took.
- **Answers are checked before you see them.** Each of the three answers may only use numbers from its own line of the fact sheet it was given. A number from another line, a made-up number, or a spelled-out number such as "twelve" makes Margin discard the answer and show an error with a retry.

On-device inference needs desktop Chrome 139 or newer with `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` enabled. Other browsers use the cloud option.

## Privacy

Products and overhead are stored in your browser's `localStorage`. There is no account, no database and no tracking. Your data leaves the device only if you agree to the cloud option.

## Run it

You need Node 20 or newer and a Firebase project with AI Logic enabled.

```
npm install
cp .env.example .env.local   # fill in the Firebase web config
npm run dev
```

Set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` to turn on App Check. Without it, anyone who copies the web key from the page can call the AI.

## Tests

```
npm test                          # unit tests, no network
LIVE=1 npx vitest run grounding.live   # checks the real cloud model against the number rules
```

The unit tests cover the profit, margin, break-even and dead-stock math, the price rules, undo, loading saved data, the on-device and cloud fallback, and the number check.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Firebase AI Logic (`firebase/ai`), Vitest. Deployed on Vercel.

## Limits

- Data lives in one browser. There is no sync between devices.
- Prices come only from what you enter. There is no competitor data.
- It is built for a small product list, around ten products in the demo.

## License

Apache 2.0. See `LICENSE`.
