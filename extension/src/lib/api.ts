import type { AnalyzeResponse } from "@fakescope/shared";

declare const __BACKEND_URL__: string;
const BACKEND_URL = __BACKEND_URL__;

export class NotArticleError extends Error {
  constructor() {
    super("Open a news article first");
  }
}

class BackendError extends Error {
  constructor(public status: number) {
    super(`backend ${status}`);
  }
}

function friendlyError(e: unknown): string {
  if (e instanceof DOMException && e.name === "AbortError")
    return "Serwer nie odpowiada — spróbuj ponownie.";
  if (e instanceof TypeError && e.message.includes("fetch"))
    return "Brak połączenia z serwerem analizy. Spróbuj ponownie później.";
  if (e instanceof BackendError) {
    if (e.status >= 500) return "Serwer analizy chwilowo niedostępny.";
    if (e.status === 429) return "Zbyt wiele zapytań — poczekaj chwilę.";
    if (e.status === 422) return "Nie udało się przetworzyć treści strony.";
    return `Błąd serwera (${e.status}).`;
  }
  return "Nieznany błąd — spróbuj ponownie.";
}

export async function analyzeCurrentTab(): Promise<AnalyzeResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("No active tab");

  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("edge://") ||
    tab.url.startsWith("about:")
  )
    throw new NotArticleError();

  const cacheKey = `analyze:${tab.url}`;
  const cached = await chrome.storage.session.get([cacheKey]);
  if (cached[cacheKey]) {
    return { ...(cached[cacheKey] as AnalyzeResponse), cached: true };
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: tab.url }),
    });
  } catch (e) {
    throw new Error(friendlyError(e));
  }

  if (!res.ok) throw new Error(friendlyError(new BackendError(res.status)));

  const data = (await res.json()) as AnalyzeResponse;
  await chrome.storage.session.set({ [cacheKey]: data });
  return data;
}

export async function clearCache(url: string): Promise<void> {
  await chrome.storage.session.remove([`analyze:${url}`]); // tablica!
}

export async function voteOnUrl(url: string, vote: 1 | -1): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/votes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, vote }),
    });
  } catch {
    // głosowanie nie jest krytyczne
  }
}

export async function fetchCommunity(
  url: string,
): Promise<{ up: number; down: number }> {
  const res = await fetch(
    `${BACKEND_URL}/votes?url=${encodeURIComponent(url)}`,
  );
  if (!res.ok) throw new Error("failed");
  return res.json();
}
