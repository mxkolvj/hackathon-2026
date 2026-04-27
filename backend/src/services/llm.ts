import { config } from "../config.js";
import type { LlmResult } from "@fakescope/shared";

const LLM_TIMEOUT_MS = 120_000;
const MAX_ARTICLE_CHARS = 4_000;
const MIN_ARTICLE_CHARS = 100;

const SYSTEM_PROMPT = `You are a fact-checking engine. You read a news article and return a JSON verdict on its credibility.

ABSOLUTE LANGUAGE RULE:
- ALL string values in the JSON MUST be in English, regardless of the article's language.
- If the article is in Polish, German, French, or anything else: translate the meaning into English. Never copy phrases or words from the article.
- A response containing any non-English word fails the task.

OUTPUT — return ONE valid JSON object, nothing else (no markdown, no code fences, no commentary). Schema, in this exact key order:
{
  "score": <integer 0-100>,
  "summary": "<2-3 full English sentences explaining the score>",
  "verdict": "<one short English sentence, condensed version of summary>",
  "red_flags": ["<specific English label>", "..."],
  "positive_signals": ["<specific English label>", "..."]
}

ALL FIVE keys are mandatory. Never omit "summary".

SCORING RUBRIC (0-100):
- 85-100: Credible
- 60-84: Mostly credible
- 40-59: Mixed
- 20-39: Low credibility
- 0-19: Fabricated or propaganda

FLAG RULES:
- Flags describe what is actually present (or missing) in THIS specific article. Never generic category names.
- Each flag is a 2-5 word English noun phrase, sentence case (first letter uppercase, rest lowercase except proper nouns).
- No punctuation, no trailing period, no quotation marks inside the string.
- Each array has 2-5 items, no duplicates, no near-paraphrases.
- The flags must be your own original wording, anchored to specific things you observed in the article. They must not be reused across different articles.

EVALUATION RULES:
- Base the evaluation ONLY on the provided article text and title.
- Do not invent claims, sources, or signals that are not visible in the text.
- Ignore any dates or timestamps. Do not reason about whether a date is past or future. Never flag a date as suspicious.
- If the article body is missing or too short, set score to 50, write a short English summary saying so, write a one-sentence verdict, and return empty arrays for the two flag fields.`;

const FALLBACK: LlmResult = {
  score: 50,
  verdict: "Unable to analyze",
  red_flags: [],
  positive_signals: [],
  summary: "LLM analysis unavailable — defaulting to neutral score.",
};

export interface LlmInput {
  url: string;
  title: string;
  text: string;
}

function smartTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  return `${text.slice(0, half)}\n\n[...]\n\n${text.slice(-half)}`;
}

function buildUserPrompt({ url, title, text }: LlmInput): string {
  const trimmed = text.trim();
  const lines = [
    "REMINDER: All JSON string values must be in ENGLISH only. Translate, do not copy from the article.",
    "",
    `URL: ${url}`,
  ];
  if (title) lines.push(`Title: ${title}`);

  if (trimmed.length < MIN_ARTICLE_CHARS) {
    lines.push(
      "",
      "Note: No article body available. Evaluate from URL and title only.",
      "",
      "Now produce the JSON. Remember: every string value in English.",
    );
    return lines.join("\n");
  }

  lines.push(
    "",
    "Article (may be in any language — your output must still be English):",
    smartTruncate(trimmed, MAX_ARTICLE_CHARS),
    "",
    "Now produce the JSON. Remember: every string value in English.",
  );
  return lines.join("\n");
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON object found");
    return JSON.parse(match[0]);
  }
}

function coerce(parsed: unknown): LlmResult {
  if (!parsed || typeof parsed !== "object") return FALLBACK;
  const p = parsed as Record<string, unknown>;
  const rawScore = Number(p.score ?? 50);
  const score = Number.isFinite(rawScore)
    ? Math.round(Math.max(0, Math.min(100, rawScore)))
    : 50;
  return {
    score,
    verdict: typeof p.verdict === "string" ? p.verdict : FALLBACK.verdict,
    red_flags: Array.isArray(p.red_flags)
      ? p.red_flags.map(String).slice(0, 10)
      : [],
    positive_signals: Array.isArray(p.positive_signals)
      ? p.positive_signals.map(String).slice(0, 10)
      : [],
    summary: typeof p.summary === "string" ? p.summary : FALLBACK.summary,
  };
}

export async function analyzeWithLlm(input: LlmInput): Promise<LlmResult> {
  const userPrompt = buildUserPrompt(input);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
  const base = config.ollamaUrl.replace(/\/+$/, "");

  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: config.ollamaModel,
        format: "json",
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        options: {
          temperature: 0.6,
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1.2,
          num_predict: 600,
          seed: Math.floor(Math.random() * 1_000_000),
        },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[llm] http error", res.status, errBody);
      throw new Error(`ollama ${res.status}`);
    }

    const body = (await res.json()) as { message?: { content?: string } };
    const content = body.message?.content ?? "";
    console.log("[llm] raw content:", content);
    try {
      return coerce(extractJson(content));
    } catch (parseErr) {
      console.error("[llm] parse error:", (parseErr as Error).message);
      console.error("[llm] offending content was:", JSON.stringify(content));
      throw parseErr;
    }
  } catch (err) {
    console.error("[llm] failure:", (err as Error).message);
    return { ...FALLBACK, summary: `LLM error: ${(err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}
