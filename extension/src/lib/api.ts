import type { AnalyzeResponse } from "@fakescope/shared";

declare const __BACKEND_URL__: string;
const BACKEND_URL = __BACKEND_URL__;

function getOrCreateVoterId(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["user_hash"], (res) => {
      if (res.user_hash) return resolve(res.user_hash);
      const id = crypto.randomUUID();
      chrome.storage.local.set({ user_hash: id }, () => resolve(id));
    });
  });
}

export async function analyzeCurrentTab(): Promise<AnalyzeResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("No active tab");

  // dodaj to:
  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("edge://") ||
    tab.url.startsWith("about:")
  ) {
    throw new Error("Open a news article first");
  }

  const cacheKey = `analyze:${tab.url}`;
  const cached = await chrome.storage.session.get([cacheKey]);
  if (cached[cacheKey]) return cached[cacheKey] as AnalyzeResponse;

  const [extracted] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () =>
      (
        window as unknown as {
          __fakescope_extract?: () => { title: string; text: string };
        }
      ).__fakescope_extract?.() ?? {
        title: document.title,
        text: document.body.innerText.slice(0, 5000),
      },
  });
  const { title, text } = extracted.result ?? {
    title: tab.title ?? "",
    text: "",
  };

  const res = await fetch(`${BACKEND_URL}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: tab.url, title, text }),
  });
  if (!res.ok) throw new Error(`backend ${res.status}`);
  const data = (await res.json()) as AnalyzeResponse;
  await chrome.storage.session.set({ [cacheKey]: data });
  return data;
}

export async function voteOnUrl(url: string, vote: 1 | -1): Promise<void> {
  const user_hash = await getOrCreateVoterId();
  await fetch(`${BACKEND_URL}/votes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, vote, user_hash }),
  });
}
