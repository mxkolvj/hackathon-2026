import { config } from '../config.js';
import type { LlmResult } from '@fakescope/shared';

const SYSTEM_PROMPT = `You are a professional fact-checking engine. Your sole job is to evaluate the credibility of a news article and return a structured JSON verdict.

SCORING RUBRIC (0–100):
- 85–100: Credible. Named sources, verifiable facts, neutral tone, no logical fallacies.
- 60–84:  Mostly credible but has minor issues (anonymous sources, slight sensationalism).
- 40–59:  Mixed. Significant unsourced claims, emotional language, or internal inconsistencies.
- 20–39:  Low credibility. Multiple red flags: unnamed experts, misleading framing, unverifiable claims.
- 0–19:   Fabricated or extreme propaganda. No sourcing, sensational headlines, conspiracy framing.

RED FLAGS to look for:
- Vague attribution ("sources say", "experts claim", "people are saying")
- Emotionally loaded or sensational language designed to provoke outrage or fear
- Logical fallacies (straw man, false dichotomy, appeal to authority without credentials)
- Headlines that exaggerate or contradict the article body
- Absence of dates, author names, or publication information
- Claims that contradict well-established scientific or historical consensus

POSITIVE SIGNALS to look for:
- Named, credentialed sources with verifiable affiliations
- Links or references to primary sources (studies, official statements, court documents)
- Author byline present and identifiable
- Neutral, measured tone even on controversial topics
- Acknowledgement of opposing viewpoints or uncertainty
- Consistent facts between headline, lead, and body

OUTPUT FORMAT — respond with ONLY this JSON object, no prose, no markdown fences:
{
  "score": <integer 0-100>,
  "verdict": "<one crisp sentence summarising the credibility judgement>",
  "red_flags": ["<specific red flag found>", ...],
  "positive_signals": ["<specific positive signal found>", ...],
  "summary": "<2-3 sentences: what the article claims, what undermines or supports it, overall judgement>"
}

If the article text is missing or too short to evaluate, base the score on the URL domain and title alone and set score to 50 unless the title itself is clearly sensational.`;

const FALLBACK: LlmResult = {
  score: 50,
  verdict: 'Unable to analyze',
  red_flags: [],
  positive_signals: [],
  summary: 'LLM analysis unavailable — defaulting to neutral score.',
};

// Takes beginning + end of long articles to preserve lead and conclusion.
function smartTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  return `${text.slice(0, half)}\n\n[...]\n\n${text.slice(-half)}`;
}

function buildUserPrompt(input: { url: string; title: string; text: string }): string {
  const { url, title, text } = input;
  const trimmed = text.trim();

  if (!trimmed || trimmed.length < 100) {
    return `URL: ${url}\nTitle: ${title}\n\nNote: No article body was provided. Evaluate based on the URL domain and title only.`;
  }

  const article = smartTruncate(trimmed, 4000);
  return `URL: ${url}\nTitle: ${title}\n\nArticle:\n${article}`;
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON object found');
    return JSON.parse(match[0]);
  }
}

function coerce(parsed: unknown): LlmResult {
  if (!parsed || typeof parsed !== 'object') return FALLBACK;
  const p = parsed as Record<string, unknown>;
  const score = Math.max(0, Math.min(100, Number(p.score ?? 50)));
  return {
    score: Number.isFinite(score) ? Math.round(score) : 50,
    verdict: typeof p.verdict === 'string' ? p.verdict : FALLBACK.verdict,
    red_flags: Array.isArray(p.red_flags) ? p.red_flags.map(String).slice(0, 10) : [],
    positive_signals: Array.isArray(p.positive_signals)
      ? p.positive_signals.map(String).slice(0, 10)
      : [],
    summary: typeof p.summary === 'string' ? p.summary : FALLBACK.summary,
  };
}

export async function analyzeWithLlm(input: {
  url: string;
  title: string;
  text: string;
}): Promise<LlmResult> {
  const userPrompt = buildUserPrompt(input);

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 60_000);

  try {
    const res = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: config.ollamaModel,
        format: 'json',
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        options: { temperature: 0.2 },
      }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}`);
    const body = (await res.json()) as { message?: { content?: string } };
    const content = body.message?.content ?? '';
    return coerce(extractJson(content));
  } catch (err) {
    return { ...FALLBACK, summary: `LLM error: ${(err as Error).message}` };
  } finally {
    clearTimeout(timeout);
  }
}
