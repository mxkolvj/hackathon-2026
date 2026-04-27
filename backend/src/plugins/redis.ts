import fp from "fastify-plugin";

// Prosta klasa emulująca zachowanie Redisa w pamięci RAM
class InMemoryRedisMock {
  private cache = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.cache.get(key) || null;
  }

  // Obsługuje klasyczne app.redis.set("klucz", "wartosc", "EX", 3600)
  async set(
    key: string,
    value: string,
    mode?: string,
    duration?: number,
  ): Promise<string> {
    this.cache.set(key, value);
    if (mode === "EX" && duration) {
      setTimeout(() => {
        this.cache.delete(key);
      }, duration * 1000);
    }
    return "OK";
  }

  async del(key: string): Promise<number> {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    return existed ? 1 : 0;
  }

  // Zaślepki (stubs) dla metod ioredisa używanych w oryginalnym pliku
  on(event: string, handler: any) {
    /* ignorujemy eventy */
  }
  async connect() {
    return Promise.resolve();
  }
  async quit() {
    this.cache.clear();
    return Promise.resolve();
  }
}

declare module "fastify" {
  interface FastifyInstance {
    // Dodajemy 'any', aby TypeScript nie krzyczał w innych plikach,
    // jeśli użyłeś gdzieś w backendzie specyficznej metody z ioredis.
    redis: InMemoryRedisMock | any;
  }
}

export default fp(async (app) => {
  const mockRedis = new InMemoryRedisMock();

  app.log.info("Uruchomiono In-Memory Mock Redis (Hackathon Mode) 🚀");

  // Rejestrujemy naszego mocka pod tym samym kluczem co wcześniej
  app.decorate("redis", mockRedis);

  app.addHook("onClose", async () => {
    await mockRedis.quit();
  });
});
