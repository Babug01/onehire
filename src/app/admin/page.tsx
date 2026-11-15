import type { Metadata } from "next";
import { adminToken, isAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import type { Post } from "@/lib/types";
import { login, logout, setStatus } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Moderation", robots: { index: false, follow: false } };

function Item({ post, actions }: { post: Post; actions: [string, string, string?][] }) {
  return (
    <div className="admin-item">
      <div>
        <strong>{post.title}</strong> at {post.company} ({post.city}, {post.country})
        <div className="hint">
          {post.category} · {post.seniority} · {post.workMode} · by {post.authorName} ·{" "}
          {post.createdAt.toISOString().slice(0, 10)}
        </div>
        <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
          {post.sourceUrl}
        </a>
        {post.description && <div>{post.description}</div>}
      </div>
      <form action={setStatus}>
        <input type="hidden" name="id" value={post.id} />
        {actions.map(([status, label, cls]) => (
          <button key={status} className={`btn ${cls ?? ""}`} name="status" value={status}>
            {label}
          </button>
        ))}
      </form>
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  if (!adminToken()) {
    return <p className="prose">Moderation is off. Set ADMIN_TOKEN (at least 16 characters) to enable it.</p>;
  }

  if (!(await isAdmin())) {
    return (
      <form className="form" action={login}>
        <h1>Moderation</h1>
        <label>
          Admin token
          <input name="token" type="password" required autoComplete="current-password" />
        </label>
        <div>
          <button className="btn" type="submit">
            Sign in
          </button>
        </div>
        {error && <p className="status-err">Wrong token.</p>}
      </form>
    );
  }

  const db = getDb();
  if (!db) return <p className="prose">No database configured (DATABASE_URL).</p>;

  const [pending, live] = await Promise.all([
    db.post.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, take: 100 }),
    db.post.findMany({ where: { status: "approved" }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <>
      <section className="hero">
        <h1>Moderation</h1>
        <form action={logout}>
          <button className="btn secondary" type="submit">
            Sign out
          </button>
        </form>
      </section>
      <h2>Waiting for review ({pending.length})</h2>
      <div className="admin-list">
        {pending.length === 0 && <p className="hint">Nothing to review.</p>}
        {pending.map((p) => (
          <Item
            key={p.id}
            post={p}
            actions={[
              ["approved", "Approve"],
              ["rejected", "Reject", "danger"],
            ]}
          />
        ))}
      </div>
      <h2>Live (latest {live.length})</h2>
      <div className="admin-list">
        {live.map((p) => (
          <Item key={p.id} post={p} actions={[["removed", "Remove", "danger"]]} />
        ))}
      </div>
    </>
  );
}
