import type { MetadataRoute } from "next";
import { sitemapJobs } from "@/lib/jobs";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await sitemapJobs();
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.3 },
    ...jobs.map((j) => ({ url: `${SITE_URL}/jobs/${j.id}`, lastModified: j.lastSeenAt, changeFrequency: "daily" as const })),
  ];
}
