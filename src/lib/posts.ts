import type { Prisma } from "@prisma/client";
import { getDb } from "./db";
import { SEED_POSTS } from "./seed";
import type { Filters, Post } from "./types";

export const MAX_AGE_DAYS = 45;

function matches(p: Post, f: Filters): boolean {
  const q = f.q.toLowerCase();
  const city = f.city.toLowerCase();
  return (
    (!f.country || p.country === f.country) &&
    (!f.category || p.category === f.category) &&
    (!f.seniority || p.seniority === f.seniority) &&
    (!f.workMode || p.workMode === f.workMode) &&
    (!city || p.city.toLowerCase().includes(city)) &&
    (!q || [p.title, p.company, p.description, p.city].some((s) => s.toLowerCase().includes(q)))
  );
}

export async function listPosts(f: Filters): Promise<{ posts: Post[]; sample: boolean }> {
  const db = getDb();
  if (!db) return { posts: SEED_POSTS.filter((p) => matches(p, f)), sample: true };

  const where: Prisma.PostWhereInput = {
    status: "approved",
    createdAt: { gte: new Date(Date.now() - MAX_AGE_DAYS * 86_400_000) },
  };
  if (f.country) where.country = f.country;
  if (f.category) where.category = f.category;
  if (f.seniority) where.seniority = f.seniority;
  if (f.workMode) where.workMode = f.workMode;
  if (f.city) where.city = { contains: f.city, mode: "insensitive" };
  if (f.q) {
    where.OR = (["title", "company", "description", "city"] as const).map((field) => ({
      [field]: { contains: f.q, mode: "insensitive" },
    }));
  }

  const posts = await db.post.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  return { posts, sample: false };
}
