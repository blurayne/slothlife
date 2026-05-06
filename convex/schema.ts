import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Highscore table — keyed by score (descending) for fast top-N lookup.
// Names are pre-uppercased and clipped to 12 chars by the submit
// mutation; score is a non-negative integer.
//
// `submissions` is the rate-limit ledger. Every accepted submit also
// writes a (clientId, ts) row; the next submit counts how many rows
// exist for the same clientId in the last RATE_WINDOW_MS to decide
// whether to allow it. Rows past SUBMISSIONS_KEEP per clientId are
// pruned by the same mutation so the table stays small.
export default defineSchema({
  highscores: defineTable({
    name:  v.string(),
    score: v.number(),
    date:  v.number(),
    // Optional run-summary fields. All three were added after the
    // initial leaderboard launch — old rows lack them, so v.optional
    // is required for read-side validation to keep accepting them.
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
  }).index("by_score", ["score"]),

  submissions: defineTable({
    clientId: v.string(),
    ts:       v.number(),
  }).index("by_client_ts", ["clientId", "ts"]),
});
