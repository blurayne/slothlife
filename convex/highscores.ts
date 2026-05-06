import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const HS_MAX = 100;
// Plausibility cap on the server. A real game tops out around
// (apples × 15) + (months × 50) + (lives × 250) ≈ ~10k–15k. Anything
// north of 100,000 is almost certainly a tampered submit from the
// browser console. Reject silently (return null) so the legitimate
// retry path doesn't surface a scary error to the player.
const SCORE_CAP = 100_000;

// Rate-limit window for anonymous clientId submits. The browser
// generates a UUID once and stores it in localStorage as
// 'sloth-client-id'; the mutation rejects when more than
// MAX_PER_WINDOW submits land within RATE_WINDOW_MS for that id.
// Determined attackers can clear localStorage to reset, but the
// goal is to stop curl-replay loops, not to be audit-grade.
const RATE_WINDOW_MS  = 60_000;
const MAX_PER_WINDOW  = 3;
// Hard cap on submissions ledger size per clientId so the table
// can't grow without bound on a busy player.
const SUBMISSIONS_KEEP = 32;

// Strip ASCII control chars + DEL. Defined inline as a constructed
// RegExp so the source file stays free of literal control bytes.
const CTRL_RE = new RegExp("[\\u0000-\\u001F\\u007F]", "g");

// list — top N scores in descending order. Public, no auth.
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(HS_MAX, Math.max(1, args.limit ?? HS_MAX));
    const rows = await ctx.db
      .query("highscores")
      .withIndex("by_score")
      .order("desc")
      .take(limit);
    return rows.map((r) => ({
      name:           r.name,
      score:          r.score,
      date:           r.date,
      survivedMonths: r.survivedMonths,
      livesLost:      r.livesLost,
      endReason:      r.endReason,
    }));
  },
});

// submit — insert a single score, then prune anything outside the
// top HS_MAX so the table stays bounded. Sanitisation strips only
// control chars (so "faulbär" survives as "FAULBÄR"), slices by
// Unicode code points to avoid splitting a multi-unit char, and
// upper-cases with locale rules so ä → Ä. Empty / zero scores are
// ignored.
//
// Anti-tamper:
//   * Reject scores above SCORE_CAP.
//   * If clientId is supplied, reject when the same id has already
//     submitted MAX_PER_WINDOW times in the last RATE_WINDOW_MS.
//   * Successful submits append to a `submissions` ledger; older
//     rows past SUBMISSIONS_KEEP for that clientId are pruned in
//     the same mutation so the table stays small.
// MAX_LIVES on the client is 3; cap the array length defensively so
// a tampered submit can't store an oversized array. Keep the cap a
// touch above 3 in case the rules ever grow (e.g. bonus lives).
const LIVES_LOST_CAP = 8;
// Hard ceiling for survivedMonths — the default game ends at 30
// in-game months. Allow a generous multiple (custom dev runs can go
// further) but reject anything astronomically wrong.
const MONTHS_CAP = 10_000;

export const submit = mutation({
  args: {
    name:     v.string(),
    score:    v.number(),
    clientId: v.optional(v.string()),
    // Optional run-summary fields. Sanitised below; missing / bogus
    // values are silently dropped rather than rejected so a stale
    // client never loses an otherwise-valid submit.
    survivedMonths: v.optional(v.number()),
    livesLost: v.optional(v.array(v.object({
      reason: v.union(
        v.literal("fall"),
        v.literal("lightning"),
        v.literal("starve"),
      ),
      month: v.number(),
    }))),
    endReason: v.optional(v.union(
      v.literal("win"),
      v.literal("gameover"),
      v.literal("killed"),
    )),
  },
  handler: async (ctx, args) => {
    const cleaned = (args.name ?? "").replace(CTRL_RE, "").trim();
    const cps = [...cleaned];
    const name =
      (cps.slice(0, 12).join("") || "ANON").toLocaleUpperCase();
    const score = Math.floor(args.score);
    if (score <= 0)        return null;
    if (score > SCORE_CAP) return null;

    // Per-client rate-limit. clientId is optional so legacy callers
    // (and the Convex CLI / dashboard) still work, but in practice
    // every browser submit ships one. Slice to a defensive 64 chars
    // so an attacker can't pump arbitrary blobs into the index.
    const clientId = args.clientId ? args.clientId.slice(0, 64) : undefined;
    if (clientId) {
      const cutoff = Date.now() - RATE_WINDOW_MS;
      const recent = await ctx.db
        .query("submissions")
        .withIndex("by_client_ts", (q) =>
          q.eq("clientId", clientId).gt("ts", cutoff))
        .collect();
      if (recent.length >= MAX_PER_WINDOW) return null;
      await ctx.db.insert("submissions", {
        clientId,
        ts: Date.now(),
      });
      // Prune anything past SUBMISSIONS_KEEP for this clientId so
      // the ledger can't grow without bound on a single player.
      const all = await ctx.db
        .query("submissions")
        .withIndex("by_client_ts", (q) =>
          q.eq("clientId", clientId))
        .order("desc")
        .collect();
      for (let i = SUBMISSIONS_KEEP; i < all.length; i++) {
        await ctx.db.delete(all[i]._id);
      }
    }

    // Sanitise the optional summary fields. All three are stored
    // only when they pass validation; otherwise the row is inserted
    // without them so a buggy client can't poison the table.
    const survivedMonths =
      typeof args.survivedMonths === "number" &&
      Number.isFinite(args.survivedMonths) &&
      args.survivedMonths >= 0 &&
      args.survivedMonths <= MONTHS_CAP
        ? Math.floor(args.survivedMonths)
        : undefined;
    const livesLost = Array.isArray(args.livesLost)
      ? args.livesLost.slice(0, LIVES_LOST_CAP).map((l) => ({
          reason: l.reason,
          month:
            Number.isFinite(l.month) && l.month >= 0 && l.month <= MONTHS_CAP
              ? Math.floor(l.month)
              : 0,
        }))
      : undefined;
    const endReason = args.endReason;

    const id = await ctx.db.insert("highscores", {
      name,
      score,
      date: Date.now(),
      ...(survivedMonths !== undefined ? { survivedMonths } : {}),
      ...(livesLost      !== undefined ? { livesLost }      : {}),
      ...(endReason      !== undefined ? { endReason }      : {}),
    });
    // Trim: keep only the top HS_MAX entries.
    const rows = await ctx.db
      .query("highscores")
      .withIndex("by_score")
      .order("desc")
      .collect();
    for (let i = HS_MAX; i < rows.length; i++) {
      await ctx.db.delete(rows[i]._id);
    }
    return id;
  },
});
