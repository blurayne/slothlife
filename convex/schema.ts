import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Highscore table — keyed by score (descending) for fast top-N lookup.
// Names are pre-uppercased and clipped to 8 chars by the submit
// mutation; score is a non-negative integer.
export default defineSchema({
  highscores: defineTable({
    name:  v.string(),
    score: v.number(),
    date:  v.number(),
  }).index("by_score", ["score"]),
});
