import fp from "fastify-plugin";
import Redis from "ioredis";
import { config } from "../config.js";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(async (app) => {
  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    retryStrategy: () => null, // don't spam reconnects if Redis is down
    enableOfflineQueue: false,
  });
  redis.on("error", (err) => app.log.warn({ err }, "redis error"));
  try {
    await redis.connect();
  } catch (err) {
    app.log.warn({ err }, "redis connect failed — continuing without cache");
  }
  app.decorate("redis", redis);
  app.addHook("onClose", async () => {
    await redis.quit().catch(() => {});
  });
});
