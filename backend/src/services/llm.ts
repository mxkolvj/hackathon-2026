import { config } from "../config.js";
import type { LlmResult } from "@fakescope/shared";

const LLM_TIMEOUT_MS = 120_000;
const MAX_ARTICLE_CHARS = 4_000;
const MIN_ARTICLE_CHARS = 100;

const SYSTEM_PROMPT = `You are a professional fact-checking engine. Evaluate the credibility of a news article and return a structured JSON verdict.

SCORING RUBRIC (0-100):
- 85-100: Credible. Named sources, verifiable facts, neutral tone.
- 60-84:  Mostly credible but minor issues (anonymous sources, slight sensationalism).
- 40-59:  Mixed. Significant unsourced claims, emotional language, inconsistencies.
- 20-39:  Low credibility. Multiple red flags, misleading framing.
- 0-19:   Fabricated or extreme propaganda. No sourcing, conspiracy framing.

RED FLAGS:
- Vague attribution ("sources say", "experts claim")
- Sensational/emotionally loaded language
- Logical fallacies, headlines contradicting body
- Missing dates, authors, or publication info
- Claims contradicting scientific or historical consensus

POSITIVE SIGNALS:
- Named, credentialed sources
- References to primary sources
- Identifiable author byline
- Neutral tone, acknowledgement of uncertainty

Base your evaluation ONLY on the provided article text. Do not invent flags or signals not directly evidenced. If unsure, give fewer flags rather than guessing.

OUTPUT — respond with ONLY this JSON object, no prose, no markdown, no extra fields:
{
  "score": <integer 0-100>,
  "verdict": "<one crisp sentence>",
  "red_flags": ["<flag>", ...],
  "positive_signals": ["<signal>", ...],
  "summary": "<2-3 sentences>"
}

If the article is missing or too short to evaluate, base score on URL and title alone, defaulting to 50 unless the title is clearly sensational.`;

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
    lines.push("", "Note: No article body available. Evaluate from URL and title only.");
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
        options: { temperature: 0.2, num_predict: 400, num_ctx: 2048 },
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
