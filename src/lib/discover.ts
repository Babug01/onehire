import type { PrismaClient } from "@prisma/client";
import { COMPANIES, type Ats } from "./companies";
import { getJson, getText, looksRelevant, pMap, xmlAll, xmlText } from "./sources";
import { decodeEntities } from "./text";

const RECHECK_DAYS = 30;

type Pattern = { ats: Ats; params: Record<string, string>; token: (u: URL) => string | undefined };

const firstSegment = (u: URL) => decodeURIComponent(u.pathname.split("/").filter(Boolean)[0] ?? "");
const subdomain = (u: URL) => u.hostname.split(".")[0];
const NOT_COMPANY = new Set(
  "www app api apps careers career jobs job help support docs status blog embed j en de nl fr es partners login signup static cdn assets mail".split(" "),
);

// Where each job system's company boards live; tokens are read from URLs in the Common Crawl index.
const PATTERNS: Pattern[] = [
  {
    ats: "greenhouse",
    params: { url: "boards.greenhouse.io/", matchType: "prefix" },
    token: (u) => (firstSegment(u) === "embed" ? u.searchParams.get("for") ?? undefined : firstSegment(u)),
  },
  { ats: "greenhouse", params: { url: "job-boards.greenhouse.io/", matchType: "prefix" }, token: firstSegment },
  { ats: "lever", params: { url: "jobs.lever.co/", matchType: "prefix" }, token: firstSegment },
  { ats: "levereu", params: { url: "jobs.eu.lever.co/", matchType: "prefix" }, token: firstSegment },
  { ats: "ashby", params: { url: "jobs.ashbyhq.com/", matchType: "prefix" }, token: firstSegment },
  { ats: "recruitee", params: { url: "recruitee.com", matchType: "domain" }, token: subdomain },
  { ats: "teamtailor", params: { url: "teamtailor.com", matchType: "domain" }, token: subdomain },
  { ats: "personio", params: { url: "jobs.personio.de", matchType: "domain" }, token: subdomain },
  { ats: "personio", params: { url: "jobs.personio.com", matchType: "domain" }, token: subdomain },
  { ats: "workable", params: { url: "apply.workable.com/", matchType: "prefix" }, token: firstSegment },
  { ats: "smartrecruiters", params: { url: "jobs.smartrecruiters.com/", matchType: "prefix" }, token: firstSegment },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The Common Crawl index is free but slow and sometimes answers 5xx; retry with backoff. */
async function ccFetch(url: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (res.ok) return res.text();
      if (res.status === 404) return "";
    } catch {
      // retry below
    }
    await sleep(5_000 * 3 ** attempt);
  }
  throw new Error(`Common Crawl index unavailable: ${url}`);
}

async function latestCollections(n: number): Promise<string[]> {
  const info = JSON.parse(await ccFetch("https://index.commoncrawl.org/collinfo.json")) as { id: string }[];
  return info.slice(0, n).map((c) => c.id);
}

const VALID_TOKEN = /^[a-z0-9][a-z0-9._-]{1,60}$/i;

/** Company board tokens per job system, found in the latest Common Crawl collections. */
export async function crawlTokens(collections = 2, log: (m: string) => void = console.log) {
  const found = new Map<string, Set<string>>();
  for (const coll of await latestCollections(collections)) {
    for (const p of PATTERNS) {
      const base = `https://index.commoncrawl.org/${coll}-index?${new URLSearchParams({ ...p.params, output: "json" })}`;
      let pages = 1;
      try {
        pages = (JSON.parse(await ccFetch(`${base}&showNumPages=true`)) as { pages: number }).pages || 1;
      } catch (e) {
        log(`${coll} ${p.params.url}: ${(e as Error).message}`);
        continue;
      }
      const set = found.get(p.ats) ?? new Set<string>();
      for (let page = 0; page < pages; page++) {
        let text = "";
        try {
          text = await ccFetch(`${base}&fl=url&page=${page}`);
        } catch (e) {
          log(`${coll} ${p.params.url} page ${page}: ${(e as Error).message}`);
          continue;
        }
        for (const line of text.split("\n")) {
          try {
            const t = p.token(new URL((JSON.parse(line) as { url: string }).url));
            if (t && VALID_TOKEN.test(t) && !NOT_COMPANY.has(t.toLowerCase())) set.add(t.toLowerCase());
          } catch {
            // skip malformed lines
          }
        }
        await sleep(1_000);
      }
      found.set(p.ats, set);
      log(`${coll} ${p.params.url}: ${pages} pages, ${set.size} ${p.ats} boards so far`);
    }
  }
  return found;
}

type Probe = { name: string; total: number; europeJobs: number };

const pretty = (token: string) => token.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Company name from a career page title like "Jobs at Acme" or "Acme - Careers". */
async function nameFromPage(url: string): Promise<string> {
  const html = await getText(url).catch(() => "");
  const title = decodeEntities(html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1] ?? "").trim();
  return title
    .replace(/^(jobs|careers?|current openings|open positions)\s+(at|@|bij|bei|chez)\s+/i, "")
    .replace(/\s*[-|–:]\s*(jobs|careers?|career page|job board|vacatures|karriere).*$/i, "")
    .replace(/\s+(jobs|careers)$/i, "")
    .trim()
    .slice(0, 80);
}

const count = (items: { title: string; locations: string[]; country?: string }[]) =>
  items.filter((i) => looksRelevant(i.title, i.locations, i.country)).length;

/* eslint-disable @typescript-eslint/no-explicit-any */
const PROBES: Record<Ats, (t: string) => Promise<Probe>> = {
  greenhouse: async (t) => {
    const jobs: any[] = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${t}/jobs`)).jobs ?? [];
    return {
      name: jobs[0]?.company_name || pretty(t),
      total: jobs.length,
      europeJobs: count(jobs.map((x) => ({ title: String(x.title ?? ""), locations: [String(x.location?.name ?? "")] }))),
    };
  },
  lever: (t) => leverProbe("https://api.lever.co", "https://jobs.lever.co", t),
  levereu: (t) => leverProbe("https://api.eu.lever.co", "https://jobs.eu.lever.co", t),
  ashby: async (t) => {
    const jobs: any[] = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${t}`)).jobs ?? [];
    const europeJobs = count(
      jobs.map((x) => ({
        title: String(x.title ?? ""),
        locations: [String(x.location ?? ""), String(x.address?.postalAddress?.addressCountry ?? "")],
      })),
    );
    return { name: europeJobs ? (await nameFromPage(`https://jobs.ashbyhq.com/${t}`)) || pretty(t) : pretty(t), total: jobs.length, europeJobs };
  },
  recruitee: async (t) => {
    const offers: any[] = (await getJson(`https://${t}.recruitee.com/api/offers/`)).offers ?? [];
    return {
      name: offers[0]?.company_name || pretty(t),
      total: offers.length,
      europeJobs: count(offers.map((x) => ({ title: String(x.title ?? ""), locations: [String(x.location ?? ""), String(x.country ?? "")], country: x.country_code }))),
    };
  },
  teamtailor: async (t) => {
    const xml = await getText(`https://${t}.teamtailor.com/jobs.rss`);
    const items = xmlAll(xml, "item");
    const channel = decodeEntities(xml.match(/<channel>\s*<title>([^<]*)<\/title>/)?.[1] ?? "").replace(/^(jobs|careers?)\s+(at|@)\s+/i, "");
    return {
      name: channel.trim() || pretty(t),
      total: items.length,
      europeJobs: count(
        items.map((i) => ({
          title: xmlText(i, "title"),
          locations: xmlAll(i, "tt:location").map((l) => `${xmlText(l, "tt:city")}, ${xmlText(l, "tt:country")}`),
        })),
      ),
    };
  },
  personio: async (t) => {
    let xml = await getText(`https://${t}.jobs.personio.de/xml`).catch(() => "");
    if (!xml.includes("<position>")) xml = await getText(`https://${t}.jobs.personio.com/xml`);
    const positions = xmlAll(xml, "position");
    return {
      name: (positions[0] && xmlText(positions[0], "subcompany")) || pretty(t),
      total: positions.length,
      europeJobs: count(positions.map((p) => ({ title: xmlText(p, "name"), locations: [xmlText(p, "office")] }))),
    };
  },
  workable: async (t) => {
    const j = await getJson(`https://apply.workable.com/api/v1/widget/accounts/${t}`);
    const jobs: any[] = j.jobs ?? [];
    return {
      name: j.name || pretty(t),
      total: jobs.length,
      europeJobs: count(jobs.map((x) => ({ title: String(x.title ?? ""), locations: [`${x.city ?? ""}, ${x.country ?? ""}`] }))),
    };
  },
  smartrecruiters: async (t) => {
    const j = await getJson(`https://api.smartrecruiters.com/v1/companies/${t}/postings?limit=100`);
    const jobs: any[] = j.content ?? [];
    return {
      name: jobs[0]?.company?.name || pretty(t),
      total: j.totalFound ?? jobs.length,
      europeJobs: count(
        jobs.map((x) => ({ title: String(x.name ?? ""), locations: [String(x.location?.fullLocation ?? "")], country: String(x.location?.country ?? "").toUpperCase() })),
      ),
    };
  },
};

async function leverProbe(api: string, site: string, t: string): Promise<Probe> {
  const jobs: any[] = await getJson(`${api}/v0/postings/${t}?mode=json`);
  const europeJobs = count(
    jobs.map((x) => ({
      title: String(x.text ?? ""),
      locations: [...(x.categories?.allLocations ?? []), String(x.categories?.location ?? "")],
      country: x.country,
    })),
  );
  return { name: europeJobs ? (await nameFromPage(`${site}/${t}`)) || pretty(t) : pretty(t), total: jobs.length, europeJobs };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const probeBoard = (ats: Ats, token: string) => PROBES[ats](token);

/** Finds career boards in Common Crawl, checks each for European tech jobs and stores the result. */
export async function discoverCareerSites(db: PrismaClient, log: (m: string) => void = console.log) {
  for (const c of COMPANIES) {
    await db.careerSite.upsert({
      where: { ats_token: { ats: c.ats, token: c.token } },
      create: { ats: c.ats, token: c.token, name: c.name, domain: c.domain, industry: c.industry, curated: true, active: true },
      update: { name: c.name, domain: c.domain, industry: c.industry, curated: true, active: true },
    });
  }

  const tokens = await crawlTokens(2, log);
  const recheckBefore = new Date(Date.now() - RECHECK_DAYS * 86_400_000);
  const recent = new Set(
    (await db.careerSite.findMany({ where: { checkedAt: { gte: recheckBefore } }, select: { ats: true, token: true } })).map(
      (s) => `${s.ats}:${s.token}`,
    ),
  );
  const todo = [...tokens].flatMap(([ats, set]) => [...set].map((token) => ({ ats: ats as Ats, token }))).filter((s) => !recent.has(`${s.ats}:${s.token}`));
  log(`boards found: ${[...tokens.values()].reduce((n, s) => n + s.size, 0)}, to check now: ${todo.length}`);

  let active = 0;
  let checked = 0;
  await pMap(todo, 16, async ({ ats, token }) => {
    let probe: Probe | null = null;
    try {
      probe = await PROBES[ats](token);
    } catch {
      // Unreachable or deleted board: remember it as inactive so it is not retried until the next recheck.
    }
    const data = {
      name: probe?.name ?? pretty(token),
      active: !!probe && probe.europeJobs > 0,
      europeJobs: probe?.europeJobs ?? 0,
      checkedAt: new Date(),
    };
    await db.careerSite.upsert({ where: { ats_token: { ats, token } }, create: { ats, token, ...data }, update: data });
    if (data.active) active++;
    if (++checked % 500 === 0) log(`checked ${checked}/${todo.length}, with Europe tech jobs: ${active}`);
  });
  const totalActive = await db.careerSite.count({ where: { active: true } });
  log(`done: checked ${checked}, newly active ${active}, active career sites in total ${totalActive}`);
  return { checked, active, totalActive };
}
