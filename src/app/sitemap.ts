import type { MetadataRoute } from "next";
import { listCompanies, sitemapJobs } from "@/lib/jobs";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jobs, companies] = await Promise.all([sitemapJobs(), listCompanies()]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/companies`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.3 },
    ...companies.map((c) => ({ url: `${SITE_URL}/company/${c.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
    ...jobs.map((j) => ({ url: `${SITE_URL}/jobs/${j.id}`, lastModified: j.lastSeenAt, changeFrequency: "daily" as const })),
  ];
}
