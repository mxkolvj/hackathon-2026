export interface AnalyzeRequest {
  url: string;
  title: string;
  text: string;
}

export interface LlmResult {
  score: number; // 0-100
  verdict: string;
  red_flags: string[];
  positive_signals: string[];
  summary: string;
}

export interface WaybackResult {
  change_percent: number | null;
  snapshots_count: number;
  first_snapshot: string | null; // ISO timestamp
}

export interface DomainResult {
  domain: string;
  domain_score: number; // 0-100
  flags: string[];
}

export interface CommunityResult {
  up: number;
  down: number;
  community_score: number | null; // 0-100
}

export interface AnalyzeResponse {
  url: string;
  final_score: number; // 0-100
  llm: LlmResult;
  wayback: WaybackResult | null;
  domain: DomainResult;
  community: CommunityResult | null;
  cached: boolean;
  generated_at: string; // ISO timestamp
}

export interface VoteRequest {
  url: string;
  vote: 1 | -1;
}

export interface VotesResponse {
  up: number;
  down: number;
}

export const SCORE_WEIGHTS = {
  llm: 0.5,
  domain: 0.25,
  wayback: 0.15,
  community: 0.1,
} as const;

export const SCORE_WEIGHTS_NO_COMMUNITY = {
  llm: 0.6,
  domain: 0.25,
  wayback: 0.15,
} as const;
