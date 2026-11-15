import Link from "next/link";
import { CATEGORIES, CITIES, COUNTRIES, SENIORITY, WORK_MODES } from "@/lib/options";
import { listPosts, MAX_AGE_DAYS } from "@/lib/posts";
import type { Filters, Post } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function ago(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function PostCard({ post }: { post: Post }) {
  return (
    <article className="card">
      <h2>{post.title}</h2>
      <div className="company">{post.company}</div>
      <div className="meta">
        {post.city}, {COUNTRIES[post.country] ?? post.country} · {ago(post.createdAt)}
      </div>
      <div className="badges">
        <span className="badge">{post.category}</span>
        <span className="badge">{post.seniority}</span>
        <span className="badge">{post.workMode}</span>
      </div>
      {post.description && <p>{post.description}</p>}
      <div className="author">Posted by {post.authorName}</div>
      <a className="btn" href={post.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
        Open post on {post.platform}
      </a>
    </article>
  );
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return ((Array.isArray(v) ? v[0] : v) ?? "").trim().slice(0, 100);
  };
  const filters: Filters = {
    q: one("q"),
    country: one("country"),
    city: one("city"),
    category: one("category"),
    seniority: one("seniority"),
    workMode: one("workMode"),
  };
  const { posts, sample } = await listPosts(filters);

  return (
    <>
      <section className="hero">
        <h1>Tech job referrals in the Netherlands and Europe</h1>
        <p>
          Engineers post &quot;my team is hiring, happy to refer&quot; on LinkedIn and X. We collect those posts in
          one place. Find one that fits, then message the author directly.
        </p>
      </section>

      {sample && (
        <div className="notice">
          Showing sample posts with made-up companies. Real posts appear once a database is connected.
        </div>
      )}

      <form className="filters" method="get" role="search">
        <input
          className="search"
          name="q"
          placeholder="Search role, company or keyword"
          defaultValue={filters.q}
          aria-label="Search"
        />
        <select name="country" defaultValue={filters.country} aria-label="Country">
          <option value="">All countries</option>
          {Object.entries(COUNTRIES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <input name="city" list="cities" placeholder="City" defaultValue={filters.city} aria-label="City" />
        <datalist id="cities">
          {CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <select name="category" defaultValue={filters.category} aria-label="Category">
          <option value="">All roles</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="seniority" defaultValue={filters.seniority} aria-label="Seniority">
          <option value="">Any seniority</option>
          {SENIORITY.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select name="workMode" defaultValue={filters.workMode} aria-label="Work mode">
          <option value="">Any work mode</option>
          {WORK_MODES.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
        <button className="btn" type="submit">
          Filter
        </button>
        <Link className="btn secondary" href="/">
          Reset
        </Link>
      </form>

      <div className="result-count">
        {posts.length} {posts.length === 1 ? "post" : "posts"} from the last {MAX_AGE_DAYS} days
      </div>

      {posts.length ? (
        <div className="grid">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      ) : (
        <div className="empty">
          No posts match these filters. <Link href="/submit">Seen one we missed? Share it.</Link>
        </div>
      )}
    </>
  );
}
