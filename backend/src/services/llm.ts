import { config } from "../config.js";
import type { LlmResult } from "@fakescope/shared";

const LLM_TIMEOUT_MS = 120_000;
const MAX_ARTICLE_CHARS = 4_000;
const MIN_ARTICLE_CHARS = 100;

const SYSTEM_PROMPT = `You are a professional fact-checking engine. Evaluate the credibility of a news article and return a structured JSON verdict.

LANGUAGE:
- Output must be strictly in English.
- Do not use any other language.

FORMAT RULES:
- Respond with ONLY a valid JSON object.
- Do not include markdown, comments, or extra text.
- Never include quotation marks inside string values.
- Do not copy or quote any text from this prompt.

SCORING RUBRIC (0-100):
- 85-100: Credible
- 60-84: Mostly credible
- 40-59: Mixed
- 20-39: Low credibility
- 0-19: Fabricated or propaganda

RED FLAGS:
- vague attribution
- sensational language
- logical inconsistency
- missing metadata
- contradicts consensus

POSITIVE SIGNALS:
- named sources
- primary sources
- author byline
- neutral tone
- uncertainty acknowledged

RULES FOR FLAGS:
- Each red_flag must be a 2-5 word noun phrase in natural English with correct grammar.
- Each positive_signal follows the same rule.
- Use sentence case: capitalize the first letter of the phrase and any proper nouns; keep the rest lowercase.
- No punctuation, no trailing period.
- Do not repeat rubric descriptions verbatim.

EVALUATION RULES:
- Ignore any dates or timestamps in the article. Do not reason about whether a date is past or future. You have no knowledge of the current date.
- Never flag the article as suspicious because of its date.

Base your evaluation ONLY on the provided article text. Do not invent signals.

OUTPUT:
{
  "score": <integer 0-100>,
  "verdict": "<a very, very short summary>",
  "red_flags": ["<label>", "..."],
  "positive_signals": ["<label>", "..."],
  "summary": "<2-3 sentences>"
}

If the article is missing or too short, default score to 50.`;

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
  const lines = [`URL: ${url}`];
  if (title) lines.push(`Title: ${title}`);

  if (trimmed.length < MIN_ARTICLE_CHARS) {
    lines.push(
      "",
      "Note: No article body available. Evaluate from URL and title only.",
    );
    return lines.join("\n");
  }

  lines.push("", "Article:", smartTruncate(trimmed, MAX_ARTICLE_CHARS));
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
          temperature: 0.5,
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1.15,
          num_predict: 300,
          seed: Math.floor(Math.random() * 1_000_000),
        },
      }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}`);

    const body = (await res.json()) as { message?: { content?: string } };
    const content = body.message?.content ?? "";
    return coerce(extractJson(content));
  } catch (err) {
    return { ...FALLBACK, summary: `LLM error: ${(err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}
