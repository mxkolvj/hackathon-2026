import {
  SCORE_WEIGHTS,
  SCORE_WEIGHTS_NO_COMMUNITY,
  type AnalyzeResponse,
  type CommunityResult,
  type DomainResult,
  type LlmResult,
  type WaybackResult,
} from '@fakescope/shared';

function waybackToScore(w: WaybackResult | null): number {
  if (!w || w.change_percent === null) return 50;
  // Lots of snapshots over a long history is a positive signal.
  // Heavy content drift on a single article is mildly negative.
  const stability = Math.max(0, 100 - w.change_percent);
  const longevityBoost = Math.min(20, Math.log2(Math.max(1, w.snapshots_count)) * 5);
  return Math.max(0, Math.min(100, stability * 0.7 + 30 + longevityBoost - 30));
}

export function communityScore(up: number, down: number): CommunityResult {
  const total = up + down;
  const ratio = total === 0 ? 0.5 : up / total;
  const confidence = Math.min(1, total / 20);
  let community_score = null;
  if (up != 0 && down != 0) {
    community_score = Math.round(50 + (ratio - 0.5) * 100 * confidence);
  }
  return { up, down, community_score };
}

export function aggregate(args: {
  url: string;
  llm: LlmResult;
  wayback: WaybackResult | null;
  domain: DomainResult;
  community: CommunityResult | null;
  cached?: boolean;
}): AnalyzeResponse {
  const waybackScore = waybackToScore(args.wayback);
  let final = 0;
    if (!args.community?.community_score) {
      final =
      args.llm.score * SCORE_WEIGHTS_NO_COMMUNITY.llm +
      args.domain.domain_score * SCORE_WEIGHTS_NO_COMMUNITY.domain +
      waybackScore * SCORE_WEIGHTS_NO_COMMUNITY.wayback;

    return {
      url: args.url,
      final_score: Math.max(0, Math.min(100, Math.round(final))),
      llm: args.llm,
      wayback: args.wayback,
      domain: args.domain,
      community: null,
      cached: args.cached ?? false,
      generated_at: new Date().toISOString(),
    };
  } else {
    final =
      args.llm.score * SCORE_WEIGHTS.llm +
      args.domain.domain_score * SCORE_WEIGHTS.domain +
      waybackScore * SCORE_WEIGHTS.wayback +
      args.community.community_score * SCORE_WEIGHTS.community;

    return {
      url: args.url,
      final_score: Math.max(0, Math.min(100, Math.round(final))),
      llm: args.llm,
      wayback: args.wayback,
      domain: args.domain,
      community: args.community,
      cached: args.cached ?? false,
      generated_at: new Date().toISOString(),
    };
  }
}
