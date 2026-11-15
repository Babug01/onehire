import Link from "next/link";
import { getJob, PAGE_SIZE, searchJobs, type JobFilters } from "@/lib/jobs";
import { CATEGORIES, COUNTRIES, SENIORITY, WORK_MODES } from "@/lib/options";
import { JobCard, JobDetail } from "./ui";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const LABELS: Partial<Record<keyof JobFilters, string>> = {
  q: "Search",
  city: "City",
  country: "Country",
  category: "Role",
  seniority: "Seniority",
  workMode: "Work mode",
  company: "Company",
  posted: "Posted",
};

const POSTED: [string, string][] = [
  ["", "Any time"],
  ["1", "Last 24 hours"],
  ["7", "Last 7 days"],
  ["30", "Last 30 days"],
];

function href(f: JobFilters, change: Partial<JobFilters> & { job?: string }, keepPage = false): string {
  const next = { ...f, ...(keepPage ? {} : { page: 1 }), ...change };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v && !(k === "page" && v === 1)) p.set(k, String(v));
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

function chipLabel(f: JobFilters, k: keyof JobFilters): string {
  if (k === "country") return COUNTRIES[f.country] ?? f.country;
  if (k === "posted") return POSTED.find(([v]) => v === f.posted)?.[1] ?? "";
  if (k === "q") return `"${f.q}"`;
  return String(f[k]);
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return ((Array.isArray(v) ? v[0] : v) ?? "").trim().slice(0, 100);
  };
  const filters: JobFilters = {
    q: one("q"),
    country: one("country"),
    city: one("city"),
    category: one("category"),
    seniority: one("seniority"),
    workMode: one("workMode"),
    company: one("company"),
    posted: one("posted"),
    page: Math.min(Math.max(parseInt(one("page"), 10) || 1, 1), 200),
  };
  const selectedId = one("job");
  const result = await searchJobs(filters);

  if (!result) {
    return <p className="empty">No database configured. Set DATABASE_URL to load jobs.</p>;
  }

  const { jobs, total, sourceCount, categoryCounts } = result;
  const selected = selectedId ? await getJob(selectedId) : jobs[0] ? await getJob(jobs[0].id) : null;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const active = (Object.keys(LABELS) as (keyof JobFilters)[]).filter((k) => filters[k]);
  const topCategories = CATEGORIES.filter((c) => categoryCounts[c])
    .sort((a, b) => categoryCounts[b] - categoryCounts[a])
    .slice(0, 7);

  return (
    <>
      <section className="search-panel">
        <h1>Every tech job in Europe, one search.</h1>
        <p className="search-sub">
          {total.toLocaleString("en")} {active.length ? "matching jobs" : "open jobs"} from {sourceCount} company career
          sites and job boards. A job posted in several places is shown once, with every site it is on.
        </p>
        <form className="search-form" method="get" role="search">
          <div className="search-main">
            <input name="q" defaultValue={filters.q} placeholder="Job title, skill or company" aria-label="What" />
            <input name="city" defaultValue={filters.city} placeholder="City" aria-label="City" />
            <select name="country" defaultValue={filters.country} aria-label="Country">
              <option value="">All of Europe</option>
              {Object.entries(COUNTRIES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <button className="btn search-btn" type="submit">
              Search
            </button>
          </div>
          <div className="search-filters">
            <select name="category" defaultValue={filters.category} aria-label="Role">
              <option value="">Any role</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select name="seniority" defaultValue={filters.seniority} aria-label="Seniority">
              <option value="">Any seniority</option>
              {SENIORITY.filter((s) => s !== "Not specified").map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select name="workMode" defaultValue={filters.workMode} aria-label="Work mode">
              <option value="">Any work mode</option>
              {WORK_MODES.filter((w) => w !== "Not specified").map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
            <select name="posted" defaultValue={filters.posted} aria-label="Posted">
              {POSTED.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {filters.company && <input type="hidden" name="company" value={filters.company} />}
          </div>
        </form>
        {topCategories.length > 0 && (
          <div className="quick-roles">
            {topCategories.map((c) => (
              <Link key={c} href={href(filters, { category: filters.category === c ? "" : c })} className={filters.category === c ? "on" : ""}>
                {c} <span>{categoryCounts[c]}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="results-bar">
        <span>
          <strong>{total.toLocaleString("en")}</strong> jobs · newest first
        </span>
        {active.map((k) => (
          <Link key={k} className="filter-chip" href={href(filters, { [k]: "" } as Partial<JobFilters>)} title={`Remove ${LABELS[k]} filter`}>
            {LABELS[k]}: {chipLabel(filters, k)} ×
          </Link>
        ))}
        {active.length > 0 && (
          <Link className="clear-all" href="/">
            Clear all
          </Link>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="empty">
          No jobs match. Try fewer words, another city, or <Link href="/">clear the filters</Link>.
        </div>
      ) : (
        <div className={`split${selectedId ? " has-selection" : ""}`}>
          <div className="result-list">
            {jobs.map((j) => (
              <JobCard key={j.id} job={j} selected={selected?.id === j.id} href={href(filters, { job: j.id }, true)} />
            ))}
            {pages > 1 && (
              <nav className="pager" aria-label="Pages">
                {filters.page > 1 ? <Link href={href(filters, { page: filters.page - 1 }, true)}>‹ Previous</Link> : <span />}
                <span>
                  Page {filters.page} of {pages}
                </span>
                {filters.page < pages ? <Link href={href(filters, { page: filters.page + 1 }, true)}>Next ›</Link> : <span />}
              </nav>
            )}
          </div>
          <aside className="detail-pane" aria-label="Job details">
            {selectedId && (
              <Link className="back-link" href={href(filters, {}, true)}>
                ← Back to results
              </Link>
            )}
            {selected ? (
              <JobDetail job={selected} fullPageHref={`/jobs/${selected.id}`} />
            ) : (
              <p className="muted">This job is no longer listed.</p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
