import type { Prisma } from "@prisma/client";
import { getDb } from "./db";

export const PAGE_SIZE = 25;
// Jobs disappear once the daily import has not seen them on any site for this long.
const STALE_DAYS = 3;

export type JobFilters = {
  q: string;
  country: string;
  city: string;
  category: string;
  seniority: string;
  workMode: string;
  company: string;
  posted: string;
  visa: string;
  relocation: string;
  english: string;
  sort: string;
  page: number;
};

const SEARCH_FIELDS = ["title", "company", "city", "category", "companyIndustry", "description"] as const;

const fresh = () => new Date(Date.now() - STALE_DAYS * 86_400_000);

function searchWords(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[\s,/]+/)
    .filter((w) => w.length >= 2)
    .slice(0, 6);
}

function jobWhere(f: JobFilters, skipCategory = false): Prisma.JobWhereInput {
  const and: Prisma.JobWhereInput[] = [{ lastSeenAt: { gte: fresh() } }];
  if (f.country) and.push({ country: f.country });
  if (f.category && !skipCategory) and.push({ category: f.category });
  if (f.seniority) and.push({ seniority: f.seniority });
  if (f.workMode) and.push({ workMode: f.workMode });
  if (f.company) and.push({ company: f.company });
  if (f.city) and.push({ city: { contains: f.city, mode: "insensitive" } });
  const days = Number(f.posted);
  if (days > 0) and.push({ postedAt: { gte: new Date(Date.now() - days * 86_400_000) } });
  if (f.visa) and.push({ visa: true });
  if (f.relocation) and.push({ relocation: true });
  if (f.english) and.push({ languages: "" });
  for (const w of searchWords(f.q)) {
    and.push({ OR: SEARCH_FIELDS.map((field) => ({ [field]: { contains: w, mode: "insensitive" } })) });
  }
  return { AND: and };
}

const listingSelect = {
  where: { lastSeenAt: { gte: fresh() } },
  orderBy: { sourceKind: "desc" as const },
  select: { sourceName: true, sourceKind: true, url: true },
};

const cardSelect = {
  id: true,
  title: true,
  company: true,
  companyIndustry: true,
  city: true,
  country: true,
  category: true,
  seniority: true,
  workMode: true,
  salary: true,
  contactName: true,
  visa: true,
  relocation: true,
  languages: true,
  postedAt: true,
  listings: listingSelect,
} satisfies Prisma.JobSelect;

export type JobCardData = Prisma.JobGetPayload<{ select: typeof cardSelect }>;
export type JobDetailData = Prisma.JobGetPayload<{ include: { listings: typeof listingSelect } }> & { companyJobs: number };

const MAX_RANKED = 3000;

type RankFields = { id: string; title: string; company: string; category: string; city: string; companyIndustry: string; postedAt: Date };

/** Title hits count most, then company/role/city; a small bonus keeps newer jobs higher among equals. */
function score(j: RankFields, words: string[], phrase: string): number {
  const title = j.title.toLowerCase();
  let s = phrase.includes(" ") && title.includes(phrase) ? 15 : 0;
  for (const w of words) {
    if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(title)) s += 10;
    else if (title.includes(w)) s += 6;
    if (j.company.toLowerCase().includes(w)) s += 6;
    if (j.category.toLowerCase().includes(w)) s += 4;
    if (j.city.toLowerCase().includes(w) || j.companyIndustry.toLowerCase().includes(w)) s += 3;
  }
  const ageDays = (Date.now() - j.postedAt.getTime()) / 86_400_000;
  return s + Math.max(0, 3 - ageDays / 10);
}

export async function searchJobs(f: JobFilters) {
  const db = getDb();
  if (!db) return null;
  const where = jobWhere(f);
  const words = searchWords(f.q);
  const byRelevance = words.length > 0 && f.sort !== "newest";

  const pageJobs = async () => {
    if (!byRelevance) {
      return db.job.findMany({
        where,
        orderBy: [{ postedAt: "desc" }, { id: "asc" }],
        skip: (f.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: cardSelect,
      });
    }
    const candidates = await db.job.findMany({
      where,
      take: MAX_RANKED,
      orderBy: { postedAt: "desc" },
      select: { id: true, title: true, company: true, category: true, city: true, companyIndustry: true, postedAt: true },
    });
    const phrase = f.q.toLowerCase().trim();
    const ids = candidates
      .map((c) => ({ id: c.id, s: score(c, words, phrase) }))
      .sort((a, b) => b.s - a.s)
      .slice((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE)
      .map((c) => c.id);
    const rows = await db.job.findMany({ where: { id: { in: ids } }, select: cardSelect });
    return ids.map((id) => rows.find((r) => r.id === id)!).filter(Boolean);
  };

  const [jobs, total, byCategory, sources] = await Promise.all([
    pageJobs(),
    db.job.count({ where }),
    db.job.groupBy({ by: ["category"], where: jobWhere(f, true), _count: { _all: true } }),
    db.listing.findMany({ where: { lastSeenAt: { gte: fresh() } }, distinct: ["sourceName"], select: { sourceName: true } }),
  ]);
  return {
    jobs,
    total,
    byRelevance,
    sourceCount: sources.length,
    categoryCounts: Object.fromEntries(byCategory.map((c) => [c.category, c._count._all])) as Record<string, number>,
  };
}

/** Fresh job ids for the sitemap. */
export async function sitemapJobs() {
  const db = getDb();
  if (!db) return [];
  return db.job.findMany({ where: { lastSeenAt: { gte: fresh() } }, select: { id: true, lastSeenAt: true }, take: 45_000 });
}

export async function getJob(id: string): Promise<JobDetailData | null> {
  const db = getDb();
  if (!db || !/^[a-z0-9]{10,40}$/.test(id)) return null;
  const job = await db.job.findUnique({ where: { id }, include: { listings: listingSelect } });
  if (!job) return null;
  const companyJobs = await db.job.count({ where: { company: job.company, lastSeenAt: { gte: fresh() } } });
  return { ...job, companyJobs };
}
