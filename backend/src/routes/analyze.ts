import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AnalyzeResponse } from "@fakescope/shared";
import { analyzeWithLlm } from "../services/llm.js";
// import { checkWayback } from "../services/wayback.js";
import { checkDomain } from "../services/domain.js";
import { aggregate, communityScore } from "../services/score.js";
import { scrapePage } from "../services/scraper.js";

const CACHE_TTL_SECONDS = 60 * 60;

const bodySchema = {
  type: "object",
  required: ["url"],
  properties: {
    url: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const;

type Body = { url: string };

function cacheKey(url: string): string {
  return `analyze:${createHash("sha256").update(url).digest("hex")}`;
}

async function getCommunity(app: FastifyInstance, url: string) {
  if (!app.supabase) return communityScore(0, 0);
  try {
    const { data } = await app.supabase
      .from("votes")
      .select("vote")
      .eq("url", url);
    let up = 0;
    let down = 0;
    for (const row of data ?? []) {
      if (row.vote === 1) up++;
      else if (row.vote === -1) down++;
    }
    return communityScore(up, down);
  } catch {
    return communityScore(0, 0);
  }
}

export default async function analyzeRoute(app: FastifyInstance) {
  app.post<{ Body: Body }>(
    "/analyze",
    { schema: { body: bodySchema } },
    async (req) => {
      const { url } = req.body;
      const key = cacheKey(url);

      try {
        const cached = await app.redis.get(key);
        if (cached) {
          return { ...(JSON.parse(cached) as AnalyzeResponse), cached: true };
        }
      } catch (err) {
        app.log.warn({ err }, "redis read failed");
      }

      const { title, text } = await scrapePage(url);

      const [llm, /*wayback,*/ domain, community] = await Promise.all([
        analyzeWithLlm({ url, title, text }),
        // checkWayback(url),
        checkDomain(url),
        getCommunity(app, url),
      ]);
      const wayback = null;

      const response = aggregate({ url, llm, wayback, domain, community });

      try {
        await app.redis.set(
          key,
          JSON.stringify(response),
          "EX",
          CACHE_TTL_SECONDS,
        );
      } catch (err) {
        app.log.warn({ err }, "redis write failed");
      }

      return response;
    },
  );
}
