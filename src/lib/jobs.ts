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
  postedAt: true,
  listings: listingSelect,
} satisfies Prisma.JobSelect;

export type JobCardData = Prisma.JobGetPayload<{ select: typeof cardSelect }>;
export type JobDetailData = Prisma.JobGetPayload<{ include: { listings: typeof listingSelect } }> & { companyJobs: number };

export async function searchJobs(f: JobFilters) {
  const db = getDb();
  if (!db) return null;
  const where = jobWhere(f);
  const [jobs, total, byCategory, sources] = await Promise.all([
    db.job.findMany({
      where,
      orderBy: [{ postedAt: "desc" }, { id: "asc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: cardSelect,
    }),
    db.job.count({ where }),
    db.job.groupBy({ by: ["category"], where: jobWhere(f, true), _count: { _all: true } }),
    db.listing.findMany({ where: { lastSeenAt: { gte: fresh() } }, distinct: ["sourceName"], select: { sourceName: true } }),
  ]);
  return {
    jobs,
    total,
    sourceCount: sources.length,
    categoryCounts: Object.fromEntries(byCategory.map((c) => [c.category, c._count._all])) as Record<string, number>,
  };
}

export async function getJob(id: string): Promise<JobDetailData | null> {
  const db = getDb();
  if (!db || !/^[a-z0-9]{10,40}$/.test(id)) return null;
  const job = await db.job.findUnique({ where: { id }, include: { listings: listingSelect } });
  if (!job) return null;
  const companyJobs = await db.job.count({ where: { company: job.company, lastSeenAt: { gte: fresh() } } });
  return { ...job, companyJobs };
}
