import whoiser from "whoiser";
import type { DomainResult } from "@fakescope/shared";

const SUSPICIOUS_TLDS = new Set([
  "tk",
  "ml",
  "ga",
  "cf",
  "gq",
  "top",
  "xyz",
  "click",
  "link",
  "work",
  "loan",
  "biz",
]);

function extractDomain(rawUrl: string): {
  domain: string;
  isHttps: boolean;
  tld: string;
} {
  const u = new URL(rawUrl);
  const domain = u.hostname.replace(/^www\./, "");
  const tld = domain.split(".").pop() ?? "";
  return { domain, isHttps: u.protocol === "https:", tld };
}

async function checkUrlhaus(
  domain: string,
  signal: AbortSignal,
): Promise<boolean> {
  try {
    const res = await fetch("https://urlhaus-api.abuse.ch/v1/host/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ host: domain }).toString(),
      signal,
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { query_status?: string };
    return body.query_status === "ok";
  } catch {
    return false;
  }
}

async function getDomainAgeMonths(domain: string): Promise<number | null> {
  try {
    const data = (await whoiser(domain, { timeout: 4000 })) as Record<
      string,
      unknown
    >;
    for (const v of Object.values(data)) {
      if (v && typeof v === "object") {
        const created = (v as Record<string, unknown>)["Created Date"];
        if (typeof created === "string") {
          const d = new Date(created);
          if (!isNaN(d.getTime())) {
            return Math.floor(
              (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30),
            );
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function checkDomain(rawUrl: string): Promise<DomainResult> {
  let domain: string;
  let isHttps: boolean;
  let tld: string;
  try {
    ({ domain, isHttps, tld } = extractDomain(rawUrl));
  } catch {
    return { domain: "invalid", domain_score: 30, flags: ["invalid_url"] };
  }

  const flags: string[] = [];
  let score = 100;

  if (!isHttps) {
    score -= 20;
    flags.push("no_https");
  }
  if (SUSPICIOUS_TLDS.has(tld)) {
    score -= 15;
    flags.push(`suspicious_tld:${tld}`);
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 5_000);
  const [ageMonths, malicious] = await Promise.all([
    getDomainAgeMonths(domain),
    checkUrlhaus(domain, ctrl.signal),
  ]);
  clearTimeout(timeout);

  if (ageMonths === null) {
    flags.push("unknown_age");
  } else if (ageMonths < 6) {
    score -= 25;
    flags.push(`young_domain:${ageMonths}mo`);
  }

  if (malicious) {
    score -= 50;
    flags.push("urlhaus_listed");
  }

  return { domain, domain_score: Math.max(0, Math.min(100, score)), flags };
}
