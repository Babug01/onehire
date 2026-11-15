import type { PrismaClient } from "@prisma/client";
import { categoryFor, placeFor, seniorityFor, workModeFor } from "./classify";

export type ImportedJob = {
  title: string;
  company: string;
  city: string;
  country: string;
  category: string;
  seniority: string;
  workMode: string;
  sourceUrl: string;
  platform: string;
  source: string;
  authorName: string;
  description: string;
  createdAt: Date;
};

type Raw = {
  title: string;
  company: string;
  url: string;
  locations: string[];
  countryCode?: string;
  bareRemoteIsEurope?: boolean;
  modeHints: (string | boolean | null | undefined)[];
  description: string;
  published: Date;
};

// Public job board APIs of companies hiring in Europe (board token -> display name).
const GREENHOUSE: Record<string, string> = {
  adyen: "Adyen", algolia: "Algolia", awin: "Awin", bird: "Bird", catawiki: "Catawiki", celonis: "Celonis",
  cloudflare: "Cloudflare", contentful: "Contentful", databricks: "Databricks", datadog: "Datadog", dataiku: "Dataiku",
  elastic: "Elastic", gitlab: "GitLab", grafanalabs: "Grafana Labs", hellofresh: "HelloFresh", mirakl: "Mirakl",
  mongodb: "MongoDB", monzo: "Monzo", n26: "N26", solarisbank: "Solaris", stripe: "Stripe", sumup: "SumUp",
  trivago: "trivago", twilio: "Twilio", typeform: "Typeform", wise: "Wise", wolt: "Wolt",
};
const LEVER: Record<string, string> = {
  agicap: "Agicap", blablacar: "BlaBlaCar", malt: "Malt", palantir: "Palantir", spotify: "Spotify",
};
const ASHBY: Record<string, string> = {
  alan: "Alan", clickhouse: "ClickHouse", deepl: "DeepL", doctolib: "Doctolib", elevenlabs: "ElevenLabs",
  linear: "Linear", lovable: "Lovable", miro: "Miro", mollie: "Mollie", n8n: "n8n", pennylane: "Pennylane",
  photoroom: "Photoroom", pleo: "Pleo", posthog: "PostHog", qonto: "Qonto", sanity: "Sanity", supabase: "Supabase",
  swan: "Swan", synthesia: "Synthesia",
};

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const date = (v: unknown, fallback = new Date()) => {
  const d = typeof v === "number" ? new Date(v) : typeof v === "string" ? new Date(v) : fallback;
  return Number.isNaN(d.getTime()) ? fallback : d;
};

type Fetcher = { name: string; platform: string; source: string; run: () => Promise<Raw[]> };

const fetchers: Fetcher[] = [
  ...Object.entries(GREENHOUSE).map(([token, name]) => ({
    name, platform: name, source: "greenhouse",
    run: async () => {
      const j = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`)) as any;
      return (j.jobs ?? []).map((x: any): Raw => ({
        title: String(x.title ?? "").trim(),
        company: x.company_name || name,
        url: x.absolute_url,
        locations: [String(x.location?.name ?? "")],
        modeHints: [x.location?.name],
        description: "",
        published: date(x.first_published ?? x.updated_at),
      }));
    },
  })),
  ...Object.entries(LEVER).map(([token, name]) => ({
    name, platform: name, source: "lever",
    run: async () => {
      const j = (await getJson(`https://api.lever.co/v0/postings/${token}?mode=json`)) as any[];
      return j.map((x: any): Raw => ({
        title: String(x.text ?? "").trim(),
        company: name,
        url: x.hostedUrl,
        locations: [...(x.categories?.allLocations ?? []), String(x.categories?.location ?? "")],
        countryCode: x.country,
        modeHints: [x.workplaceType, x.categories?.location],
        description: [x.categories?.department, x.categories?.team].filter(Boolean).join(" · "),
        published: date(x.createdAt),
      }));
    },
  })),
  ...Object.entries(ASHBY).map(([token, name]) => ({
    name, platform: name, source: "ashby",
    run: async () => {
      const j = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${token}`)) as any;
      return (j.jobs ?? [])
        .filter((x: any) => x.isListed !== false)
        .map((x: any): Raw => ({
          title: String(x.title ?? "").trim(),
          company: name,
          url: x.jobUrl,
          locations: [
            String(x.location ?? ""),
            ...(x.secondaryLocations ?? []).map((s: any) => String(s.location ?? "")),
            String(x.address?.postalAddress?.addressCountry ?? ""),
          ],
          modeHints: [x.workplaceType, x.location],
          description: [x.department, x.team].filter(Boolean).join(" · "),
          published: date(x.publishedAt),
        }));
    },
  })),
  {
    name: "Arbeitnow", platform: "Arbeitnow", source: "arbeitnow",
    run: async () => {
      const out: Raw[] = [];
      for (let page = 1; page <= 3; page++) {
        const j = (await getJson(`https://www.arbeitnow.com/api/job-board-api?page=${page}`)) as any;
        for (const x of j.data ?? []) {
          out.push({
            title: String(x.title ?? "").trim(),
            company: String(x.company_name ?? "").trim(),
            url: x.url,
            locations: [String(x.location ?? "")],
            bareRemoteIsEurope: true,
            countryCode: /germany|deutschland/i.test(String(x.location)) ? "DE" : undefined,
            modeHints: [x.remote === true, x.location],
            description: (x.tags ?? []).slice(0, 3).join(" · "),
            published: date(typeof x.created_at === "number" ? x.created_at * 1000 : undefined),
          });
        }
        if (!j.links?.next) break;
      }
      return out;
    },
  },
];

function toJob(r: Raw, f: Fetcher): ImportedJob | null {
  if (!r.title || !r.company || typeof r.url !== "string" || !r.url.startsWith("https://")) return null;
  if (AGGREGATORS.test(r.company)) return null;
  const category = categoryFor(r.title);
  if (!category) return null;
  const place = placeFor(r.locations.filter(Boolean), { countryCode: r.countryCode, bareRemoteIsEurope: r.bareRemoteIsEurope });
  if (!place || !EUROPE_CODES.has(place.country)) return null;
  return {
    title: r.title.slice(0, 160),
    company: r.company.slice(0, 80),
    city: place.city,
    country: place.country,
    category,
    seniority: seniorityFor(r.title),
    workMode: workModeFor(...r.modeHints),
    sourceUrl: r.url.slice(0, 500),
    platform: f.source === "arbeitnow" ? "Arbeitnow" : "careers page",
    source: f.source,
    authorName: "",
    description: r.description.slice(0, 300),
    createdAt: r.published,
  };
}

// Job aggregators re-post other companies' jobs; nobody there can refer you.
const AGGREGATORS = /\b(jobgether|jobleads|jooble|talent\.com)\b/i;

const EUROPE_CODES = new Set([
  "NL", "BE", "DE", "FR", "IE", "GB", "ES", "PT", "IT", "PL", "AT", "CH", "SE", "DK", "NO", "FI",
  "CZ", "RO", "GR", "HU", "EE", "LT", "LU", "EU",
]);

export async function fetchJobs(): Promise<{ jobs: ImportedJob[]; fetched: number; failed: string[] }> {
  const failed: string[] = [];
  let fetched = 0;
  const byUrl = new Map<string, ImportedJob>();
  const settled = await Promise.allSettled(fetchers.map((f) => f.run().then((raws) => ({ f, raws }))));
  settled.forEach((s, i) => {
    if (s.status === "rejected") {
      failed.push(fetchers[i].name);
      return;
    }
    fetched += s.value.raws.length;
    for (const r of s.value.raws) {
      const job = toJob(r, s.value.f);
      if (job && !byUrl.has(job.sourceUrl)) byUrl.set(job.sourceUrl, job);
    }
  });
  return { jobs: [...byUrl.values()], fetched, failed };
}

export async function ingestJobs(db: PrismaClient) {
  const started = Date.now();
  const { jobs, fetched, failed } = await fetchJobs();
  const now = new Date();
  let created = 0;
  let refreshed = 0;
  for (let i = 0; i < jobs.length; i += 500) {
    const chunk = jobs.slice(i, i + 500);
    const urls = chunk.map((j) => j.sourceUrl);
    const existing = new Set(
      (await db.post.findMany({ where: { sourceUrl: { in: urls } }, select: { sourceUrl: true } })).map((p) => p.sourceUrl),
    );
    const fresh = chunk.filter((j) => !existing.has(j.sourceUrl));
    if (fresh.length) {
      created += (
        await db.post.createMany({
          data: fresh.map((j) => ({ ...j, status: "approved", lastSeenAt: now })),
          skipDuplicates: true,
        })
      ).count;
    }
    if (existing.size) {
      refreshed += (
        await db.post.updateMany({
          where: { sourceUrl: { in: [...existing] }, source: { not: "community" } },
          data: { lastSeenAt: now },
        })
      ).count;
    }
  }
  return { fetched, kept: jobs.length, created, refreshed, failed, seconds: Math.round((Date.now() - started) / 1000) };
}
