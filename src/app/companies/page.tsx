import type { Metadata } from "next";
import Link from "next/link";
import { listCompanies } from "@/lib/jobs";
import { COUNTRIES } from "@/lib/options";
import { ago, Logo } from "../ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Companies hiring in Europe",
  description: "Tech companies with open jobs in Europe, with their roles, countries and who to ask for a referral.",
  alternates: { canonical: "/companies" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FEATURED = 120;

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const raw = sp.q;
  const q = ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim().slice(0, 60);
  const all = await listCompanies();
  const ql = q.toLowerCase();
  const companies = ql ? all.filter((c) => `${c.name} ${c.industry}`.toLowerCase().includes(ql)) : all;
  const featured = companies.slice(0, FEATURED);
  const others = companies.slice(FEATURED);
  const totalJobs = all.reduce((n, c) => n + c.jobs, 0);

  return (
    <>
      <section className="search-panel">
        <h1>Companies hiring in Europe</h1>
        <p className="search-sub">
          {all.length.toLocaleString("en")} companies with {totalJobs.toLocaleString("en")} open tech jobs. Open a company to
          see all its roles and find someone there who can refer you.
        </p>
        <form className="search-form" method="get" role="search">
          <div className="search-main search-main-short">
            <input name="q" defaultValue={q} placeholder="Company name or industry, e.g. payments" aria-label="Company" />
            <button className="btn search-btn" type="submit">
              Find company
            </button>
          </div>
        </form>
      </section>

      {companies.length === 0 && (
        <div className="empty">
          No company matches &quot;{q}&quot;. <Link href="/companies">Show all companies</Link>
        </div>
      )}

      {featured.length > 0 && (
        <section className="company-section">
          <h2>{q ? `Matching companies` : `Most open jobs`}</h2>
          <div className="company-grid">
            {featured.map((c) => (
              <Link key={c.slug} href={`/company/${c.slug}`} className="company-card">
                <Logo name={c.name} domain={c.domain} size={48} />
                <div>
                  <h3>{c.name}</h3>
                  <div className="muted">{c.industry}</div>
                  <div className="company-meta">
                    <strong>{c.jobs}</strong> open {c.jobs === 1 ? "job" : "jobs"}
                    <span> · {c.countries.slice(0, 3).map((k) => COUNTRIES[k] ?? k).join(", ")}</span>
                  </div>
                  <div className="company-latest">Latest posted {ago(c.latest)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="company-section">
          <h2>All other companies ({others.length.toLocaleString("en")})</h2>
          <div className="company-list">
            {others.map((c) => (
              <Link key={c.slug} href={`/company/${c.slug}`}>
                {c.domain && <Logo name={c.name} domain={c.domain} size={20} />}
                {c.name} <span>{c.jobs}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
