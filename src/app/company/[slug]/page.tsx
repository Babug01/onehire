import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany } from "@/lib/jobs";
import { COUNTRIES } from "@/lib/options";
import { JobCard, Logo } from "../../ui";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const c = await getCompany((await params).slug);
  if (!c) return { title: "Company not found", robots: { index: false } };
  return {
    title: `${c.name} jobs in Europe`,
    description: `${c.jobs} open tech jobs at ${c.name}${c.industry ? ` (${c.industry})` : ""} in Europe.`,
    alternates: { canonical: `/company/${c.slug}` },
  };
}

export default async function CompanyPage({ params }: { params: Params }) {
  const c = await getCompany((await params).slug);
  if (!c) notFound();
  const people = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(c.name)}`;

  return (
    <>
      <section className="search-panel company-hero">
        <Link className="hero-back" href="/companies">
          ← All companies
        </Link>
        <div className="company-head">
          <Logo name={c.name} domain={c.domain} size={72} />
          <div>
            <h1>{c.name}</h1>
            <p className="search-sub">
              {c.industry && <>{c.industry} · </>}
              {c.jobs} open {c.jobs === 1 ? "job" : "jobs"} in Europe
              {c.domain && (
                <>
                  {" · "}
                  <a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer">
                    {c.domain}
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="detail-actions">
          <a className="btn" href={people} target="_blank" rel="noopener noreferrer nofollow">
            Find a referrer at {c.name} on LinkedIn
          </a>
          <Link className="btn secondary" href={`/?company=${encodeURIComponent(c.name)}`}>
            Search and filter these jobs
          </Link>
        </div>
        <div className="quick-roles">
          {c.categories.map(([cat, n]) => (
            <Link key={cat} href={`/?company=${encodeURIComponent(c.name)}&category=${encodeURIComponent(cat)}`}>
              {cat} <span>{n}</span>
            </Link>
          ))}
          {c.countryCounts.map(([code, n]) => (
            <Link key={code} href={`/?company=${encodeURIComponent(c.name)}&country=${code}`}>
              {COUNTRIES[code] ?? code} <span>{n}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="company-jobs">
        {c.jobList.map((j) => (
          <JobCard key={j.id} job={j} selected={false} href={`/jobs/${j.id}`} />
        ))}
      </div>
    </>
  );
}
