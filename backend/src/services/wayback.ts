import type { WaybackResult } from '@fakescope/shared';

const EMPTY: WaybackResult = { change_percent: null, snapshots_count: 0, first_snapshot: null };
const CDX_URL = 'https://web.archive.org/cdx/search/cdx';

function parseTimestamp(ts: string): string | null {
  if (ts.length < 8) return null;
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T00:00:00Z`;
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

export async function checkWayback(url: string): Promise<WaybackResult> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10_000);

  try {
    const cdxUrl =
      CDX_URL +
      '?' +
      new URLSearchParams({
        url: stripScheme(url),
        output: 'json',
        fl: 'timestamp,length',
        limit: '10',
        filter: 'statuscode:200',
      }).toString();

    const res = await fetch(cdxUrl, { signal: ctrl.signal });
    if (!res.ok) return EMPTY;

    const rows: string[][] = await res.json();
    if (!rows || rows.length <= 1) return EMPTY;

    // rows[0] is the CDX header row; data starts at index 1
    const data = rows.slice(1);
    const first = data[0];
    const last = data[data.length - 1];

    const firstLen = Number(first[1]) || 0;
    const lastLen = Number(last[1]) || 0;

    // change_percent: relative change in archived response size between first and last snapshot
    const changePercent =
      firstLen > 0 && lastLen > 0
        ? Math.round((Math.abs(lastLen - firstLen) / firstLen) * 100)
        : null;

    return {
      change_percent: changePercent,
      snapshots_count: data.length,
      first_snapshot: parseTimestamp(first[0]),
    };
  } catch {
    return EMPTY;
  } finally {
    clearTimeout(timeout);
  }
}
