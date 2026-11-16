import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { categoryFor, EUROPE_CODES, placeFor, seniorityFor, workModeFor } from "./classify";
import { COMPANIES, type Ats } from "./companies";
import { domainFromText, resolveDomains } from "./domains";
import { BOARD_SOURCES, careerSiteSource, pMap, SOURCES, type RawJob, type Source } from "./sources";
import { companyKey, contactEmailIn, hiringContactIn, tagsFor, titleKey } from "./text";

// Job aggregators re-post other companies' jobs; there is nobody there to refer you.
const AGGREGATORS = /\b(jobgether|jobleads|jooble|talent\.com)\b/i;
// Kept short so tens of thousands of jobs fit the free database; the full ad is one click away.
const MAX_DESCRIPTION = 3_000;
const DELETE_AFTER_DAYS = 30;

type Merged = {
  key: string;
  job: {
    title: string;
    company: string;
    companyDomain: string;
    companyIndustry: string;
    city: string;
    country: string;
    category: string;
    seniority: string;
    workMode: string;
    employmentType: string;
    salary: string;
    description: string;
    contactName: string;
    contactEmail: string;
    visa: boolean;
    relocation: boolean;
    languages: string;
    applyUrl: string;
    postedAt: Date;
  };
  listings: { sourceName: string; sourceKind: string; url: string }[];
};

const knownCompany = new Map(COMPANIES.map((c) => [companyKey(c.name), c]));

function normalize(r: RawJob) {
  if (!r.title || !r.company || typeof r.url !== "string" || !r.url.startsWith("https://")) return null;
  if (AGGREGATORS.test(r.company)) return null;
  const category = categoryFor(r.title);
  if (!category) return null;
  const place = placeFor(r.locations.filter(Boolean), { countryCode: r.countryCode, bareRemoteIsEurope: r.bareRemoteIsEurope });
  if (!place || !EUROPE_CODES.has(place.country)) return null;
  const known = knownCompany.get(companyKey(r.company));
  const full = r.text.trim();
  const text = full.length > MAX_DESCRIPTION ? `${full.slice(0, MAX_DESCRIPTION).replace(/\s+\S*$/, "")} …` : full;
  return {
    key: [companyKey(r.company), titleKey(r.title), place.country, place.city.toLowerCase()].join("|"),
    raw: r,
    job: {
      title: r.title.slice(0, 200),
      company: (known?.name ?? r.company).slice(0, 100),
      companyDomain: r.companyDomain ?? known?.domain ?? "",
      companyIndustry: r.companyIndustry ?? known?.industry ?? "",
      city: place.city,
      country: place.country,
      category,
      seniority: seniorityFor(r.title, r.level ?? ""),
      workMode: workModeFor(...r.modeHints),
      employmentType: (r.employmentType ?? "").slice(0, 60),
      salary: (r.salary ?? "").slice(0, 120),
      description: text,
      contactName: hiringContactIn(full),
      contactEmail: (r.email || contactEmailIn(full)).slice(0, 200),
      ...tagsFor(full),
      applyUrl: (r.applyUrl && r.applyUrl.startsWith("https://") ? r.applyUrl : r.url).slice(0, 1000),
      postedAt: r.published > new Date() ? new Date() : r.published,
    },
  };
}

function addRaw(merged: Map<string, Merged>, r: RawJob) {
  const n = normalize(r);
  if (!n) return;
  const listing = { sourceName: r.sourceName, sourceKind: r.sourceKind, url: r.url.slice(0, 1000) };
  const existing = merged.get(n.key);
  if (!existing) {
    merged.set(n.key, { key: n.key, job: n.job, listings: [listing] });
    return;
  }
  if (!existing.listings.some((l) => l.url === listing.url)) existing.listings.push(listing);
  // Prefer the company's own ad: its apply link and description are the original.
  const existingIsCompany = existing.listings[0].sourceKind === "company";
  if (r.sourceKind === "company" && !existingIsCompany) {
    const idx = existing.listings.findIndex((l) => l.url === listing.url);
    existing.listings.unshift(...existing.listings.splice(idx, 1));
    const old = existing.job;
    existing.job = {
      ...n.job,
      contactName: n.job.contactName || old.contactName,
      contactEmail: n.job.contactEmail || old.contactEmail,
      salary: n.job.salary || old.salary,
      postedAt: n.job.postedAt < old.postedAt ? n.job.postedAt : old.postedAt,
    };
  } else {
    existing.job.contactName ||= n.job.contactName;
    existing.job.contactEmail ||= n.job.contactEmail;
    existing.job.salary ||= n.job.salary;
    if (n.job.postedAt < existing.job.postedAt) existing.job.postedAt = n.job.postedAt;
  }
}

/** Fetches the sources (a few at a time) and merges the same job found on several sites into one entry. */
export async function collectJobs(sources: Source[] = SOURCES, concurrency = 12) {
  const failed: string[] = [];
  let fetched = 0;
  const merged = new Map<string, Merged>();
  await pMap(sources, concurrency, async (s) => {
    try {
      const raws = await s.run();
      fetched += raws.length;
      for (const r of raws) addRaw(merged, r);
    } catch {
      failed.push(s.name);
    }
  });
  return { jobs: [...merged.values()], fetched, failed };
}

/** Curated companies, discovered career sites from the database, and the job boards. */
export async function loadSources(db: PrismaClient): Promise<Source[]> {
  const curated = new Set(COMPANIES.map((c) => `${c.ats}:${c.token.toLowerCase()}`));
  const discovered = await db.careerSite.findMany({ where: { active: true, curated: false } });
  return [
    ...COMPANIES.map(careerSiteSource),
    ...discovered
      .filter((s) => !curated.has(`${s.ats}:${s.token.toLowerCase()}`))
      .map((s) => careerSiteSource({ ats: s.ats as Ats, token: s.token, name: s.name || s.token, domain: s.domain, industry: s.industry })),
    ...BOARD_SOURCES,
  ];
}

const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const hashOf = (job: Merged["job"]) => createHash("sha1").update(JSON.stringify(job)).digest("hex");

export async function ingestJobs(db: PrismaClient) {
  const started = Date.now();
  const sources = await loadSources(db);
  const { jobs, fetched, failed } = await collectJobs(sources);

  const boardCompanies = new Map<string, { name: string; hint: string }>();
  for (const j of jobs) {
    if (j.job.companyDomain) continue;
    const k = companyKey(j.job.company);
    const hint = domainFromText(j.job.company, j.job.description);
    if (!boardCompanies.has(k) || (hint && !boardCompanies.get(k)!.hint)) boardCompanies.set(k, { name: j.job.company, hint });
  }
  const domains = await resolveDomains(db, boardCompanies);
  for (const j of jobs) if (!j.job.companyDomain) j.job.companyDomain = domains.get(companyKey(j.job.company)) ?? "";

  const now = new Date();
  let created = 0;
  let updated = 0;
  let refreshed = 0;
  const idByKey = new Map<string, string>();
  const hashByKey = new Map<string, string>();

  for (const part of chunks(jobs, 500)) {
    const found = await db.job.findMany({
      where: { dedupeKey: { in: part.map((j) => j.key) } },
      select: { id: true, dedupeKey: true, contentHash: true },
    });
    for (const f of found) {
      idByKey.set(f.dedupeKey, f.id);
      hashByKey.set(f.dedupeKey, f.contentHash);
    }
  }

  for (const part of chunks(jobs.filter((j) => !idByKey.has(j.key)), 100)) {
    const rows = await db.job.createManyAndReturn({
      data: part.map((j) => ({ ...j.job, contentHash: hashOf(j.job), dedupeKey: j.key, firstSeenAt: now, lastSeenAt: now })),
      select: { id: true, dedupeKey: true },
      skipDuplicates: true,
    });
    created += rows.length;
    for (const r of rows) idByKey.set(r.dedupeKey, r.id);
  }

  // Ads get edited, and classification rules improve: rewrite jobs whose content changed.
  const changed = jobs.filter((j) => hashByKey.has(j.key) && hashByKey.get(j.key) !== hashOf(j.job));
  for (const part of chunks(changed, 50)) {
    await db.$transaction(
      part.map((j) => {
        const { postedAt, ...rest } = j.job;
        return db.job.update({ where: { id: idByKey.get(j.key)! }, data: { ...rest, contentHash: hashOf(j.job) } });
      }),
    );
    updated += part.length;
  }

  const seen = jobs.filter((j) => idByKey.has(j.key));
  for (const part of chunks(seen, 500)) {
    refreshed += (
      await db.job.updateMany({ where: { id: { in: part.map((j) => idByKey.get(j.key)!) } }, data: { lastSeenAt: now } })
    ).count;
  }

  const listings = seen.flatMap((j) => j.listings.map((l) => ({ ...l, jobId: idByKey.get(j.key)!, lastSeenAt: now })));
  for (const part of chunks(listings, 500)) {
    await db.listing.createMany({ data: part, skipDuplicates: true });
    await db.listing.updateMany({ where: { url: { in: part.map((l) => l.url) } }, data: { lastSeenAt: now } });
  }

  const cutoff = new Date(Date.now() - DELETE_AFTER_DAYS * 86_400_000);
  const deleted = (await db.job.deleteMany({ where: { lastSeenAt: { lt: cutoff } } })).count;
  await db.listing.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });

  return {
    sources: sources.length,
    fetched,
    unique: jobs.length,
    created,
    updated,
    refreshed: refreshed - created,
    deleted,
    listings: listings.length,
    multiSource: jobs.filter((j) => j.listings.length > 1).length,
    failedCount: failed.length,
    failed: failed.slice(0, 50),
    seconds: Math.round((Date.now() - started) / 1000),
  };
}
