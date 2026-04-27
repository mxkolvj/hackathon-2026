import { AnalyzeResponse } from "@fakescope/shared";

export function setupMockChrome() {
  if (typeof chrome !== "undefined" && chrome.tabs) return;

  const store: Record<string, unknown> = {};

  (globalThis as any).chrome = {
    tabs: {
      query: async () => [
        {
          url: "https://example.com/news/test-article",
          title: "Test Article",
          active: true,
          id: 1,
        },
      ],
    },
    storage: {
      session: {
        get: async (keys: string[]) => {
          return Object.fromEntries(keys.map((k) => [k, store[k]]));
        },
        set: async (obj: Record<string, unknown>) => {
          Object.assign(store, obj);
        },
      },
      local: {
        get: (_keys: string[], cb: (res: Record<string, unknown>) => void) => {
          cb({ user_hash: "mock-user-123" }); // ← było voter_id, zmień na user_hash
        },
        set: (_obj: Record<string, unknown>, cb?: () => void) => {
          cb?.();
        },
      },
    },
    scripting: {
      executeScript: async () => [
        {
          result: {
            title: "Test Article — Example News",
            text: "This is a mock article body used for local development testing.",
          },
        },
      ],
    },
    runtime: {
      sendMessage: async () => ({}),
      onMessage: { addListener: () => {} },
    },
  };
}
