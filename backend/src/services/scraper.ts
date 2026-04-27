const FETCH_TIMEOUT_MS = 8_000;
const MAX_TEXT_CHARS = 8_000;
const USER_AGENT = "Fakescope-Bot/1.0 (Educational Fact-Checking)";

export interface ScrapedPage {
  title: string;
  text: string;
}

const EMPTY: ScrapedPage = { title: "", text: "" };

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decodeEntities(s: string): string {
  return s.replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m] ?? m);
}

// Removes guaranteed-noise blocks before any content extraction
function removeNoise(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|iframe|nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gim, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function htmlToText(fragment: string): string {
  return decodeEntities(
    fragment
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

function extractTitle(html: string): string {
  // og:title first (most sites have it and it's cleaner than <title> which often has " | Site Name")
  const og = html.match(/<meta\s+(?:[^>]*?\s)?(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta\s+(?:[^>]*?\s)?content=["']([^"']+)["'][^>]*(?:property|name)=["']og:title["']/i);
  if (og?.[1]) return decodeEntities(og[1]).trim();

  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t?.[1]) return decodeEntities(t[1]).replace(/\s+/g, " ").trim();

  return "";
}

// Common class/id patterns used by news sites for the article body
const CONTENT_PATTERNS = [
  // semantic tag
  /<article\b[^>]*>([\s\S]*?)<\/article>/i,
  /<main\b[^>]*>([\s\S]*?)<\/main>/i,
  // common class & id patterns
  /<(?:div|section)[^>]*(?:class|id)=["'][^"']*(?:article[-_]?body|article[-_]?content|article[-_]?text|articleBody)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i,
  /<(?:div|section)[^>]*(?:class|id)=["'][^"']*(?:post[-_]?body|post[-_]?content|post[-_]?text|entry[-_]?content|entry[-_]?body)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i,
  /<(?:div|section)[^>]*(?:class|id)=["'][^"']*(?:story[-_]?body|story[-_]?content|story[-_]?text|news[-_]?body|news[-_]?content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i,
  /<(?:div|section)[^>]*(?:class|id)=["'][^"']*(?:content[-_]?body|main[-_]?content|text[-_]?content|page[-_]?content|body[-_]?content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i,
];

// Readability-lite: find the block with the most paragraph text density
function densestParagraphBlock(html: string): string {
  const blockRe = /<(?:div|section|td)[^>]*>([\s\S]*?)<\/(?:div|section|td)>/gi;
  let best = "";
  let bestScore = 0;
  let m: RegExpExecArray | null;

  while ((m = blockRe.exec(html)) !== null) {
    const inner = m[1];
    const pMatches = inner.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [];
    const score = pMatches.reduce((acc, p) => acc + htmlToText(p).length, 0);
    if (score > bestScore) {
      bestScore = score;
      best = inner;
    }
  }

  return best;
}

function extractBody(html: string): { text: string; method: string } {
  const clean = removeNoise(html);

  for (const pattern of CONTENT_PATTERNS) {
    const m = clean.match(pattern);
    if (m?.[1]) {
      const text = htmlToText(m[1]);
      if (text.length > 200) {
        return { text, method: pattern.source.slice(1, 40) };
      }
    }
  }

  const dense = densestParagraphBlock(clean);
  if (dense) {
    const text = htmlToText(dense);
    if (text.length > 200) return { text, method: "densest-paragraph-block" };
  }

  return { text: htmlToText(clean), method: "full-body-fallback" };
}

export async function scrapePage(url: string): Promise<ScrapedPage> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  try {
    console.log(`[SCRAPER] fetching ${url}`);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": USER_AGENT },
    });

    if (!res.ok) {
      console.log(`[SCRAPER] HTTP ${res.status} for ${url}`);
      return EMPTY;
    }

    const html = await res.text();
    console.log(`[SCRAPER] raw HTML size: ${html.length} chars`);

    const title = extractTitle(html);
    console.log(`[SCRAPER] title: "${title}"`);

    const { text, method } = extractBody(html);
    const truncated = text.slice(0, MAX_TEXT_CHARS);
    console.log(`[SCRAPER] body method: ${method} | chars before truncate: ${text.length} | after: ${truncated.length}`);
    console.log(`[SCRAPER] text preview: "${truncated.slice(0, 200)}"`);

    return { title, text: truncated };
  } catch (err) {
    console.error(`[SCRAPER] failed for ${url}:`, err);
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }
}
