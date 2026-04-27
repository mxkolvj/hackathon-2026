import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import redisPlugin from "./plugins/redis.js";
import supabasePlugin from "./plugins/supabase.js";
import analyzeRoute from "./routes/analyze.js";
import votesRoute from "./routes/votes.js";
import domainRoute from "./routes/domain.js";

const app = Fastify({
  logger: true,
  // Reject requests with extra body fields instead of silently stripping them.
  ajv: { customOptions: { removeAdditional: false } },
});

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = config.corsOrigins.some((o) => {
      if (o === "*") return true;
      if (o.endsWith("*")) return origin.startsWith(o.slice(0, -1));
      return o === origin;
    });
    cb(null, allowed);
  },
});

// Global rate limit — per-route overrides are set in each route file.
await app.register(rateLimit, {
  global: true,
  max: 60,
  timeWindow: "1 minute",
  // Run AFTER schema validation so 400 errors don't consume rate-limit slots.
  hook: "preHandler",
});

await app.register(redisPlugin);
await app.register(supabasePlugin);

app.addHook("onSend", async (_req, reply, payload) => {
  if (
    typeof payload === "string" &&
    reply.getHeader("content-type")?.toString().includes("application/json")
  ) {
    try {
      return JSON.stringify(JSON.parse(payload), null, 2);
    } catch {
      return payload;
    }
  }
  return payload;
});

app.get("/health", async () => ({ ok: true }));

await app.register(analyzeRoute);
await app.register(votesRoute);
await app.register(domainRoute);

app.listen({ port: config.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
