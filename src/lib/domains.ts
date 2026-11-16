import type { PrismaClient } from "@prisma/client";
import { companyKey } from "./text";

const LOOKUP_TTL_DAYS = 30;
const MAX_LOOKUPS_PER_RUN = Number(process.env.DOMAIN_LOOKUPS_PER_RUN) || 150;

// Hosts that appear in job ads but never belong to the hiring company.
const GENERIC_HOSTS =
  /(^|\.)(arbeitnow|jobicy|remotive|linkedin|instagram|facebook|twitter|x|youtube|tiktok|glassdoor|indeed|kununu|xing|google|apple|microsoft|github|medium|wikipedia|eeoc|gov|europa|forbes|businessinsider|techcrunch|bit|lnkd|greenhouse|lever|ashbyhq|workable|recruitee|personio|smartrecruiters|teamtailor|join|metaview|calendly|typeform|notion|wellfound|crunchbase|trustpilot)\.[a-z.]+$/;

const DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

const base = (domain: string) => domain.replace(/^www\./, "").split(".").slice(-2)[0].replace(/[^a-z0-9]/g, "");

/** A domain only counts when it clearly matches the company name, to avoid showing someone else's logo. */
function matches(name: string, domain: string): boolean {
  const key = companyKey(name);
  const b = base(domain);
  return key.length >= 3 && b.length >= 3 && (key === b || key.startsWith(b) || b.startsWith(key));
}

export function domainFromText(name: string, text: string): string {
  for (const m of text.matchAll(/https?:\/\/(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/gi)) {
    const host = m[1].toLowerCase();
    if (DOMAIN.test(host) && !GENERIC_HOSTS.test(host) && matches(name, host)) return host;
  }
  return "";
}

async function lookup(name: string): Promise<string> {
  const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return "";
  const hits = (await res.json()) as { name?: string; domain?: string }[];
  const key = companyKey(name);
  const hit = hits.find((h) => h.domain && DOMAIN.test(h.domain) && (companyKey(h.name ?? "") === key || matches(name, h.domain)));
  return hit?.domain?.toLowerCase() ?? "";
}

/** Finds (and remembers) websites for companies we only know from job boards. */
export async function resolveDomains(db: PrismaClient, companies: Map<string, { name: string; hint: string }>) {
  const keys = [...companies.keys()];
  const known = new Map(
    (await db.companyDomain.findMany({ where: { key: { in: keys } } })).map((r) => [r.key, r] as const),
  );
  const stale = Date.now() - LOOKUP_TTL_DAYS * 86_400_000;
  const todo = keys.filter((k) => !known.has(k) || (!known.get(k)!.domain && known.get(k)!.checkedAt.getTime() < stale));

  let looked = 0;
  for (const key of todo) {
    const { name, hint } = companies.get(key)!;
    let domain = hint;
    if (!domain && looked < MAX_LOOKUPS_PER_RUN) {
      looked++;
      domain = await lookup(name).catch(() => "");
    } else if (!domain) continue;
    const row = { key, name, domain, checkedAt: new Date() };
    await db.companyDomain.upsert({ where: { key }, create: row, update: row });
    known.set(key, row);
  }
  return new Map([...known].filter(([, r]) => r.domain).map(([k, r]) => [k, r.domain] as const));
}
