import type { Prisma } from "@prisma/client";
import { getDb } from "./db";
import { SEED_POSTS } from "./seed";
import type { Filters, Post } from "./types";

export const MAX_AGE_DAYS = 45;
export const PAGE_SIZE = 30;
// Imported jobs are hidden once the daily import has not seen them for this long.
const STALE_DAYS = 3;

export type Counts = {
  category: Record<string, number>;
  country: Record<string, number>;
  referral: number;
  jobs: number;
};

export type ListResult = { posts: Post[]; total: number; counts: Counts; sample: boolean };

const SEARCH_FIELDS = ["title", "company", "description", "city", "category", "seniority", "workMode"] as const;
type Skip = Partial<Record<"category" | "country" | "kind", true>>;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

// Every word must match some field, so "devops engineer" also finds a Platform Engineer in "DevOps / Cloud".
function searchWords(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[\s,/]+/)
    .filter((w) => w.length >= 2)
    .slice(0, 6);
}

function where(f: Filters, skip: Skip = {}): Prisma.PostWhereInput {
  const and: Prisma.PostWhereInput[] = [
    { status: "approved" },
    {
      OR: [
        { source: "community", createdAt: { gte: daysAgo(MAX_AGE_DAYS) } },
        { source: { not: "community" }, lastSeenAt: { gte: daysAgo(STALE_DAYS) } },
      ],
    },
  ];
  if (f.country && !skip.country) and.push({ country: f.country });
  if (f.category && !skip.category) and.push({ category: f.category });
  if (f.seniority) and.push({ seniority: f.seniority });
  if (f.workMode) and.push({ workMode: f.workMode });
  if (f.city) and.push({ city: { contains: f.city, mode: "insensitive" } });
  if (f.kind === "referral" && !skip.kind) and.push({ source: "community" });
  if (f.kind === "jobs" && !skip.kind) and.push({ source: { not: "community" } });
  for (const w of searchWords(f.q)) {
    and.push({ OR: SEARCH_FIELDS.map((field) => ({ [field]: { contains: w, mode: "insensitive" } })) });
  }
  return { AND: and };
}

function matches(p: Post, f: Filters, skip: Skip = {}): boolean {
  return (
    (!f.country || !!skip.country || p.country === f.country) &&
    (!f.category || !!skip.category || p.category === f.category) &&
    (!f.seniority || p.seniority === f.seniority) &&
    (!f.workMode || p.workMode === f.workMode) &&
    (!f.city || p.city.toLowerCase().includes(f.city.toLowerCase())) &&
    (!f.kind || !!skip.kind || (f.kind === "referral") === (p.source === "community")) &&
    searchWords(f.q).every((w) => SEARCH_FIELDS.some((k) => p[k].toLowerCase().includes(w)))
  );
}

function tally(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

export async function listPosts(f: Filters): Promise<ListResult> {
  const db = getDb();
  if (!db) {
    const hits = SEED_POSTS.filter((p) => matches(p, f));
    const kinds = SEED_POSTS.filter((p) => matches(p, f, { kind: true }));
    return {
      posts: hits.slice((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE),
      total: hits.length,
      sample: true,
      counts: {
        category: tally(SEED_POSTS.filter((p) => matches(p, f, { category: true })).map((p) => p.category)),
        country: tally(SEED_POSTS.filter((p) => matches(p, f, { country: true })).map((p) => p.country)),
        referral: kinds.filter((p) => p.source === "community").length,
        jobs: kinds.filter((p) => p.source !== "community").length,
      },
    };
  }

  const [posts, total, byCategory, byCountry, bySource] = await Promise.all([
    db.post.findMany({ where: where(f), orderBy: { createdAt: "desc" }, skip: (f.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.post.count({ where: where(f) }),
    db.post.groupBy({ by: ["category"], where: where(f, { category: true }), _count: { _all: true } }),
    db.post.groupBy({ by: ["country"], where: where(f, { country: true }), _count: { _all: true } }),
    db.post.groupBy({ by: ["source"], where: where(f, { kind: true }), _count: { _all: true } }),
  ]);

  const referral = bySource.find((s) => s.source === "community")?._count._all ?? 0;
  return {
    posts,
    total,
    sample: false,
    counts: {
      category: Object.fromEntries(byCategory.map((c) => [c.category, c._count._all])),
      country: Object.fromEntries(byCountry.map((c) => [c.country, c._count._all])),
      referral,
      jobs: bySource.reduce((n, s) => n + s._count._all, 0) - referral,
    },
  };
}
