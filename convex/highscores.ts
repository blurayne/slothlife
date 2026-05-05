import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const HS_MAX = 10;

// list — top N scores in descending order. Public, no auth.
export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(50, Math.max(1, args.limit ?? HS_MAX));
    const rows = await ctx.db
      .query("highscores")
      .withIndex("by_score")
      .order("desc")
      .take(limit);
    return rows.map((r) => ({
      name:  r.name,
      score: r.score,
      date:  r.date,
    }));
  },
});

// submit — insert a single score, then prune anything outside the
// top HS_MAX so the table stays bounded. Names are sanitised
// (trimmed, max 8 chars, ASCII-ish, uppercased); negative or zero
// scores are ignored.
export const submit = mutation({
  args: { name: v.string(), score: v.number() },
  handler: async (ctx, args) => {
    const name = args.name
      .replace(/[^\x20-\x7E]/g, "")
      .trim()
      .slice(0, 8)
      .toUpperCase() || "ANON";
    const score = Math.floor(args.score);
    if (score <= 0) return null;
    const id = await ctx.db.insert("highscores", {
      name,
      score,
      date: Date.now(),
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
