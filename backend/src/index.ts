import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import supabasePlugin from "./plugins/supabase.js";
import analyzeRoute from "./routes/analyze.js";
import votesRoute from "./routes/votes.js";
import domainRoute from "./routes/domain.js";

const app = Fastify({ logger: true });

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

await app.register(supabasePlugin);

console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_KEY:", process.env.SUPABASE_KEY?.slice(0, 20));

app.get("/health", async () => ({ ok: true }));

await app.register(analyzeRoute);
await app.register(votesRoute);
await app.register(domainRoute);

app.listen({ port: config.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
