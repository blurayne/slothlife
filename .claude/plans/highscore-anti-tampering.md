# Plan: Highscore anti-tampering — plausibility cap + per-client rate limit

## Context

The Convex `highscores:submit` mutation currently only checks that
the score is positive — anyone with the browser console can call it
with `score: 9999999` and the row lands on the leaderboard. The two
cheapest, server-side mitigations from the suggestion list are:

1. **Plausibility cap.** Reject any score above a hard upper bound
   that no honest game could produce (`SCORE_CAP = 100_000`).
2. **Per-client rate-limit.** Cap submissions per anonymous client
   (UUID v4 stored in `localStorage['sloth-client-id']`) at
   `MAX_PER_WINDOW = 3 per RATE_WINDOW_MS = 60_000 ms`.

Both run on the server, so they apply equally to the GitHub Pages
build (no Convex, just localStorage — moot) and the Vercel build
(Convex source-of-truth — protected). A determined attacker can
clear localStorage to reset the rate-limit counter; that's
acceptable. The point is to stop curl-replay loops and obviously
fake scores, not to make the game audit-grade.

## Changes

### Commit A — `convex: plausibility cap on highscore submit`

`convex/highscores.ts`:

```ts
const SCORE_CAP = 100_000;        // generous; legit games top out
                                  // around ~10k
…
const score = Math.floor(args.score);
if (score <= 0)        return null;
if (score > SCORE_CAP) return null;
```

`null` keeps the existing "score below threshold → silently drop"
behaviour rather than throwing — the client already calls
`_refreshHighscoresFromConvex()` after submit, so a rejected score
just won't appear on the next refresh. No client change needed.

### Commit B — `convex+frontend: per-client rate-limit (3 / 60s)`

#### `convex/schema.ts`

Add a `submissions` table indexed by client + ts. Used only for
rate-limit checks; pruned aggressively so it stays small.

```ts
submissions: defineTable({
  clientId: v.string(),
  ts:       v.number(),
}).index("by_client_ts", ["clientId", "ts"]),
```

#### `convex/highscores.ts`

```ts
const RATE_WINDOW_MS  = 60_000;
const MAX_PER_WINDOW  = 3;
const SUBMISSIONS_KEEP = 32;     // hard cap per clientId
…
export const submit = mutation({
  args: {
    name:     v.string(),
    score:    v.number(),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // … existing name sanitisation + score cap …

    if (args.clientId) {
      const cutoff = Date.now() - RATE_WINDOW_MS;
      const recent = await ctx.db
        .query("submissions")
        .withIndex("by_client_ts", (q) =>
          q.eq("clientId", args.clientId!).gt("ts", cutoff))
        .collect();
      if (recent.length >= MAX_PER_WINDOW) return null;
      await ctx.db.insert("submissions", {
        clientId: args.clientId,
        ts: Date.now(),
      });
      // Prune anything past SUBMISSIONS_KEEP for this clientId.
      const all = await ctx.db
        .query("submissions")
        .withIndex("by_client_ts", (q) =>
          q.eq("clientId", args.clientId!))
        .order("desc")
        .collect();
      for (let i = SUBMISSIONS_KEEP; i < all.length; i++) {
        await ctx.db.delete(all[i]._id);
      }
    }
    // … existing insert + trim …
  },
});
```

#### `assets/main.js`

Generate / read a UUID v4 once and pass it on every submit:

```js
function _slothClientId(){
  const KEY = 'sloth-client-id';
  let id = null;
  try { id = localStorage.getItem(KEY); } catch(_){}
  if(!id){
    id = (crypto.randomUUID && crypto.randomUUID()) ||
         ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
           const r = Math.random()*16 | 0;
           return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
         }));
    try { localStorage.setItem(KEY, id); } catch(_){}
  }
  return id;
}
```

Then in `insertHighscore`:

```js
await client.mutation('highscores:submit', {
  name: sanitized,
  score: s,
  clientId: _slothClientId(),
});
```

No UI change. If the server rejects the submit (rate-limit / cap),
the existing `console.warn('Convex highscores submit failed:', e)`
catches it silently; the local in-memory entry stays for the rest
of the page session, but disappears on the next
`_refreshHighscoresFromConvex()`. That's acceptable for an
anti-tamper pathway — we're not asking the user to re-enter their
name.

## Critical files

- `convex/highscores.ts` — score cap + rate-limit logic.
- `convex/schema.ts` — new `submissions` table + index.
- `assets/main.js` — `_slothClientId()` + pass into submit.

## Verification

1. **Score cap.** Open the deployed site, in DevTools:
   ```js
   const m = await import('https://esm.sh/convex@1.16.0/browser');
   const c = new m.ConvexClient(window.CONVEX_URL);
   await c.mutation('highscores:submit', {
     name: 'CHEATER', score: 9999999,
     clientId: 'test-client',
   });
   ```
   `null` returned, top-100 dialog still doesn't show "CHEATER".
   A score of `5000` from the same call still works — confirms the
   cap is the only thing blocking.

2. **Rate-limit.** From the same console, fire the mutation 5
   times in quick succession with realistic scores (e.g. 100). The
   first 3 land; the next 2 return `null` and don't appear in the
   dialog. After 60 s, fresh submissions go through again.

3. **Honest play.** Play a real game, end it, save score, refresh.
   Score appears as expected.

4. **Schema migration.** Push triggers `npx convex deploy` in the
   Vercel workflow, which adds the `submissions` table. Existing
   highscore rows are untouched.

## Commit & deploy

Two commits, each pushed to `main` so the Pages + Vercel + Convex
auto-deploy chain runs once per logical change:

A. `convex: plausibility cap on highscore submit (SCORE_CAP=100_000)` — `convex/highscores.ts` only.
B. `convex+frontend: rate-limit highscore submits per anonymous clientId (3/60s)` — schema + mutation + `_slothClientId()`.

`PLAN.md` gets two new ticked entries pointing at this file.
