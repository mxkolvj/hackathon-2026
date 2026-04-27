import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { VoteRequest, VotesResponse } from "@fakescope/shared";

async function tally(
  app: FastifyInstance,
  url: string,
): Promise<VotesResponse> {
  if (!app.supabase) return { up: 0, down: 0 };
  const { data, error } = await app.supabase
    .from("votes")
    .select("vote")
    .eq("url", url);
  if (error) throw error;
  let up = 0;
  let down = 0;
  for (const r of data ?? []) {
    if (r.vote === 1) up++;
    else if (r.vote === -1) down++;
  }
  return { up, down };
}

export default async function votesRoute(app: FastifyInstance) {
  app.get<{ Querystring: { url?: string } }>("/votes", async (req, reply) => {
    const url = req.query.url;
    if (!url) return reply.code(400).send({ error: "url required" });
    try {
      return await tally(app, url);
    } catch (err) {
      app.log.error({ err }, "votes tally failed");
      return { up: 0, down: 0 };
    }
  });

  app.post<{ Body: VoteRequest }>("/votes", async (req, reply) => {
    const { url, vote } = req.body ?? ({} as VoteRequest);
    if (!url || (vote !== 1 && vote !== -1)) {
      return reply.code(400).send({ error: "url, vote (1 | -1) required" });
    }
    const ip = req.ip ?? "unknown";
    const user_hash = createHash("sha256").update(ip).digest("hex");
    if (!app.supabase)
      return reply.code(503).send({ error: "supabase not configured" });

    const { data: existing } = await app.supabase
      .from("votes")
      .select("id")
      .eq("url", url)
      .eq("user_hash", user_hash)
      .single();

    if (existing) {
      const { error } = await app.supabase
        .from("votes")
        .update({ vote })
        .eq("url", url)
        .eq("user_hash", user_hash);
      if (error) {
        app.log.error({ err: error }, "vote update failed");
        return reply.code(500).send({ error: "vote failed" });
      }
    } else {
      const { error } = await app.supabase
        .from("votes")
        .insert({ url, user_hash, vote });
      if (error) {
        app.log.error({ err: error }, "vote insert failed");
        return reply.code(500).send({ error: "vote failed" });
      }
    }
    return { ok: true };
  });
}
