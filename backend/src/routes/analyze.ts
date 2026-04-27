import type { FastifyInstance } from 'fastify';
import type { AnalyzeRequest } from '@fakescope/shared';
import { analyzeWithLlm } from '../services/llm.js';
import { checkWayback } from '../services/wayback.js';
import { checkDomain } from '../services/domain.js';
import { aggregate, communityScore } from '../services/score.js';

async function getCommunity(app: FastifyInstance, url: string) {
  if (!app.supabase) return communityScore(0, 0);
  try {
    const { data } = await app.supabase.from('votes').select('vote').eq('url', url);
    let up = 0;
    let down = 0;
    for (const row of data ?? []) {
      if (row.vote === 1) up++;
      else if (row.vote === -1) down++;
    }
    return communityScore(up, down);
  } catch {
    return communityScore(0, 0);
  }
}

export default async function analyzeRoute(app: FastifyInstance) {
  app.post<{ Body: AnalyzeRequest }>('/analyze', async (req, reply) => {
    const { url, title, text } = req.body ?? ({} as AnalyzeRequest);
    if (!url || typeof url !== 'string') {
      return reply.code(400).send({ error: 'url required' });
    }

    const [llm, wayback, domain, community] = await Promise.all([
      analyzeWithLlm({ url, title: title ?? '', text: text ?? '' }),
      checkWayback(url),
      checkDomain(url),
      getCommunity(app, url),
    ]);

    return aggregate({ url, llm, wayback, domain, community });
  });
}
