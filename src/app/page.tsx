import Link from "next/link";
import { CATEGORIES, COUNTRIES, SENIORITY, WORK_MODES } from "@/lib/options";
import { listPosts, MAX_AGE_DAYS, PAGE_SIZE } from "@/lib/posts";
import type { Filters, Kind, Post } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTER_LABELS: Partial<Record<keyof Filters, string>> = {
  q: "Search",
  country: "Country",
  city: "City",
  category: "Role",
  seniority: "Seniority",
  workMode: "Work mode",
};

function href(f: Filters, change: Partial<Filters>): string {
  const next: Filters = { ...f, page: 1, ...change };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) {
    if (v && !(k === "page" && v === 1)) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

function ago(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function sourceLabel(p: Post): string {
  if (p.source === "community") return `Referral post · ${p.platform}`;
  if (p.source === "arbeitnow") return "Job · via Arbeitnow";
  return "Job · careers page";
}

function PostCard({ post }: { post: Post }) {
  const referral = post.source === "community";
  const place = [post.city, COUNTRIES[post.country] ?? post.country].filter(Boolean).join(", ");
  const people = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(post.company)}`;
  return (
    <article className={`card${referral ? " card-ref" : ""}`}>
      <div className="card-head">
        <div className="logo" aria-hidden="true">
          {post.company.charAt(0).toUpperCase()}
        </div>
        <div className="card-title">
          <h2>{post.title}</h2>
          <div className="meta">
            <span className="company">{post.company}</span>
            {place && <span> · {place}</span>}
          </div>
        </div>
        <div className="card-side">
          <span className={`source ${referral ? "source-ref" : "source-job"}`}>{sourceLabel(post)}</span>
          <span className="ago">{ago(post.createdAt)}</span>
        </div>
      </div>
      <div className="badges">
        <span className="badge badge-cat">{post.category}</span>
        {post.seniority !== "Not specified" && <span className="badge">{post.seniority}</span>}
        {post.workMode !== "Not specified" && <span className="badge">{post.workMode}</span>}
      </div>
      {post.description && <p className="desc">{post.description}</p>}
      <div className="card-actions">
        {referral ? (
          <a className="btn" href={post.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
            Message {post.authorName} on {post.platform}
          </a>
        ) : (
          <>
            <a className="btn" href={post.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
              View job
            </a>
            <a className="btn secondary" href={people} target="_blank" rel="noopener noreferrer nofollow">
              Find a referrer at {post.company}
            </a>
          </>
        )}
      </div>
    </article>
  );
}

function FacetList({
  title,
  items,
  active,
  makeHref,
  allHref,
  allLabel,
}: {
  title: string;
  items: [string, string, number][];
  active: string;
  makeHref: (value: string) => string;
  allHref: string;
  allLabel: string;
}) {
  const max = Math.max(1, ...items.map(([, , n]) => n));
  return (
    <div className="facet">
      <h3>{title}</h3>
      <Link className={`facet-item${active ? "" : " active"}`} href={allHref}>
        <span>{allLabel}</span>
      </Link>
      {items.map(([value, label, n]) => (
        <Link key={value} className={`facet-item${active === value ? " active" : ""}`} href={makeHref(value)}>
          <span>{label}</span>
          <span className="count">{n}</span>
          <span className="bar" aria-hidden="true">
            <span style={{ width: `${Math.round((n / max) * 100)}%` }} />
          </span>
        </Link>
      ))}
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return ((Array.isArray(v) ? v[0] : v) ?? "").trim().slice(0, 100);
  };
  const kind = one("kind");
  const filters: Filters = {
    q: one("q"),
    country: one("country"),
    city: one("city"),
    category: one("category"),
    seniority: one("seniority"),
    workMode: one("workMode"),
    kind: kind === "referral" || kind === "jobs" ? (kind as Kind) : "",
    page: Math.min(Math.max(parseInt(one("page"), 10) || 1, 1), 100),
  };
  const { posts, total, counts, sample } = await listPosts(filters);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const everything = counts.referral + counts.jobs;

  const categoryItems = CATEGORIES.filter((c) => counts.category[c])
    .map((c): [string, string, number] => [c, c, counts.category[c]])
    .sort((a, b) => b[2] - a[2]);
  const countryItems = Object.entries(COUNTRIES)
    .filter(([code]) => counts.country[code])
    .map(([code, name]): [string, string, number] => [code, name, counts.country[code]])
    .sort((a, b) => b[2] - a[2]);
  const active = (Object.keys(FILTER_LABELS) as (keyof Filters)[]).filter((k) => filters[k]);

  return (
    <>
      <section className="hero">
        <h1>
          Get referred into <em>Europe&apos;s tech jobs.</em>
        </h1>
        <p className="lead">
          Referral posts from engineers on LinkedIn and X, plus fresh openings from company careers pages. Sorted by
          role, city and country.
        </p>

        <form className="searchbar" method="get" role="search">
          <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input name="q" placeholder="Role, skill or company, e.g. devops" defaultValue={filters.q} aria-label="Search" />
          <select name="country" defaultValue={filters.country} aria-label="Country">
            <option value="">Anywhere in Europe</option>
            {Object.entries(COUNTRIES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          {(["city", "category", "seniority", "workMode", "kind"] as const).map(
            (k) => filters[k] && <input key={k} type="hidden" name={k} value={filters[k]} />,
          )}
          <button className="btn" type="submit">
            Search
          </button>
        </form>

        <div className="stats">
          <span className="live">LIVE</span>
          <strong>{everything.toLocaleString("en")}</strong> {active.length ? "matching roles" : "open roles"} · updated
          daily · <Link href="/submit">Share a referral post ›</Link>
        </div>

        {categoryItems.length > 0 && (
          <div className="chips">
            {categoryItems.slice(0, 6).map(([c, , n]) => (
              <Link key={c} className="chip" href={href(filters, { category: c })}>
                {c} <span>{n}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <ol className="steps">
        <li>
          <strong>Search or filter</strong>
          <span>By role, company, city or skill.</span>
        </li>
        <li>
          <strong>Open a post or job</strong>
          <span>Referral posts from engineers, or openings from careers pages.</span>
        </li>
        <li>
          <strong>Ask for a referral</strong>
          <span>Message the author, or find someone at the company on LinkedIn.</span>
        </li>
      </ol>

      {sample && (
        <div className="notice">Showing sample posts with made-up companies. Real posts appear once a database is connected.</div>
      )}

      <div className="layout">
        <aside className="sidebar" aria-label="Filters">
          <div className="sidebar-head">
            <h2>Filters</h2>
            <Link href="/">Reset</Link>
          </div>
          <FacetList
            title="Job category"
            items={categoryItems}
            active={filters.category}
            makeHref={(c) => href(filters, { category: c })}
            allHref={href(filters, { category: "" })}
            allLabel="All job categories"
          />
          <FacetList
            title="Country"
            items={countryItems}
            active={filters.country}
            makeHref={(c) => href(filters, { country: c })}
            allHref={href(filters, { country: "" })}
            allLabel="All of Europe"
          />
          <div className="facet">
            <h3>Seniority</h3>
            <div className="pills">
              {SENIORITY.filter((s) => s !== "Not specified").map((s) => (
                <Link
                  key={s}
                  className={`pill${filters.seniority === s ? " active" : ""}`}
                  href={href(filters, { seniority: filters.seniority === s ? "" : s })}
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>
          <div className="facet">
            <h3>Work mode</h3>
            <div className="pills">
              {WORK_MODES.filter((w) => w !== "Not specified").map((w) => (
                <Link
                  key={w}
                  className={`pill${filters.workMode === w ? " active" : ""}`}
                  href={href(filters, { workMode: filters.workMode === w ? "" : w })}
                >
                  {w}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <section className="results">
          <div className="toolbar">
            <div className="notice-inline">
              <strong>New jobs are added every day.</strong> Referral posts are shared by the community.
            </div>
            <nav className="tabs" aria-label="Type">
              {(
                [
                  ["", "All", everything],
                  ["referral", "Referral posts", counts.referral],
                  ["jobs", "Company jobs", counts.jobs],
                ] as [Kind, string, number][]
              ).map(([k, label, n]) => (
                <Link key={label} className={`tab${filters.kind === k ? " active" : ""}`} href={href(filters, { kind: k })}>
                  {label} <span>{n}</span>
                </Link>
              ))}
            </nav>
          </div>

          {active.length > 0 && (
            <div className="active-filters">
              {active.map((k) => (
                <Link key={k} className="active-chip" href={href(filters, { [k]: "" } as Partial<Filters>)} title={`Remove ${FILTER_LABELS[k]}`}>
                  {k === "country" ? COUNTRIES[filters.country] ?? filters.country : k === "q" ? `"${filters.q}"` : filters[k]} ×
                </Link>
              ))}
              <Link className="clear" href="/">
                Clear all
              </Link>
            </div>
          )}

          {posts.length ? (
            <div className="list">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          ) : everything === 0 && !active.length ? (
            <div className="empty">
              Nothing here yet. The first import of company jobs runs daily.{" "}
              <Link href="/submit">Seen a referral post? Be the first to share it.</Link>
            </div>
          ) : (
            <div className="empty">
              No roles match these filters. Try fewer words or another country.{" "}
              <Link href="/submit">Seen a referral post we missed? Share it.</Link>
            </div>
          )}

          {pages > 1 && (
            <nav className="pager" aria-label="Pages">
              {filters.page > 1 ? <Link href={href(filters, { page: filters.page - 1 })}>‹ Previous</Link> : <span />}
              <span>
                Page {filters.page} of {pages}
              </span>
              {filters.page < pages ? <Link href={href(filters, { page: filters.page + 1 })}>Next ›</Link> : <span />}
            </nav>
          )}
          <p className="fineprint">
            Referral posts are shown for {MAX_AGE_DAYS} days. Company jobs disappear when they close.
          </p>
        </section>
      </div>
    </>
  );
}
