/**
 * End-to-end tests for the /analyze route.
 * Run with: pnpm exec tsx test-e2e.ts
 * Requires backend running on localhost:3000 (pnpm dev:backend).
 */
export {};

const BASE = 'http://localhost:3000';
let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}`, detail ?? '');
    failed++;
  }
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
}

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
}

// ── /health ───────────────────────────────────────────────────────────────────
console.log('\n/health');
{
  const { status, body } = await get('/health');
  ok('returns 200', status === 200);
  ok('ok: true', (body as { ok?: boolean })?.ok === true);
}

// ── /analyze — validation ────────────────────────────────────────────────────
console.log('\n/analyze — schema validation');
{
  const { status } = await post('/analyze', {});
  ok('missing url → 400', status === 400);
}
{
  const { status } = await post('/analyze', { url: '' });
  ok('empty url → 400', status === 400);
}
{
  const { status } = await post('/analyze', { url: 'https://x.com', extra: 'field' });
  ok('extra field → 400 (additionalProperties: false)', status === 400, `got ${status}`);
}

// ── /analyze — valid request (Ollama may be offline) ────────────────────────
console.log('\n/analyze — full request (Ollama offline → fallback)');
{
  const { status, body, headers } = await post('/analyze', {
    url: 'https://example.com',
    title: 'Test Article',
    text: 'This is a test article body.',
  }) as { status: number; body: Record<string, unknown>; headers: Headers };

  ok('returns 200', status === 200);
  ok('has final_score 0-100',
    typeof body?.final_score === 'number' && body.final_score >= 0 && body.final_score <= 100,
    body?.final_score);
  ok('has llm.score', typeof (body?.llm as Record<string, unknown>)?.score === 'number');
  ok('has wayback field', 'wayback' in body);
  ok('has domain.domain_score', typeof (body?.domain as Record<string, unknown>)?.domain_score === 'number');
  ok('has community field', 'community' in body);
  ok('cached: false (no Redis)', body?.cached === false);
  ok('has generated_at ISO string', typeof body?.generated_at === 'string' && (body.generated_at as string).includes('T'));
  // Rate limiting headers prove the plugin is active
  ok('x-ratelimit-limit header present', headers.has('x-ratelimit-limit'), headers.get('x-ratelimit-limit'));
  ok('x-ratelimit-remaining header present', headers.has('x-ratelimit-remaining'));
  const limit = Number(headers.get('x-ratelimit-limit'));
  ok('per-route limit is 5', limit === 5, `got ${limit}`);
}

// ── /analyze — optional fields ───────────────────────────────────────────────
console.log('\n/analyze — optional fields');
{
  const { status } = await post('/analyze', { url: 'https://example.org' });
  ok('url-only body accepted (title+text default to empty)', status === 200);
}

// ── /domain ──────────────────────────────────────────────────────────────────
console.log('\n/domain');
{
  const { status, body, headers } = await get('/domain?url=https://bbc.com') as { status: number; body: Record<string, unknown>; headers: Headers };
  ok('returns 200', status === 200);
  ok('has domain_score', typeof body?.domain_score === 'number');
  ok('has flags array', Array.isArray(body?.flags));
  ok('x-ratelimit-limit header present (global 60)', headers.has('x-ratelimit-limit'));
  const limit = Number(headers.get('x-ratelimit-limit'));
  ok('global limit is 60', limit === 60, `got ${limit}`);
}
{
  const { status } = await get('/domain');
  ok('missing url → 400', status === 400);
}

// ── LLM graceful handling (Ollama online or offline) ─────────────────────────
console.log('\n/analyze — LLM graceful handling');
{
  const { status, body } = await post('/analyze', {
    url: 'https://llm-grace-test.example',
    title: 'Grace test',
    text: 'Short article about some event.',
  }) as { status: number; body: Record<string, unknown> };

  ok('/analyze always returns 200 (Ollama online or offline)', status === 200, `got ${status}`);
  const llm = body?.llm as Record<string, unknown>;
  ok('llm.score is number 0-100',
    typeof llm?.score === 'number' && (llm.score as number) >= 0 && (llm.score as number) <= 100,
    llm?.score);
  ok('llm.summary is a non-empty string', typeof llm?.summary === 'string' && (llm.summary as string).length > 0, llm?.summary);
}

// ── summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
