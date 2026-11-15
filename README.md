# Tech Referrals EU

Tech job referral posts from LinkedIn and X for the Netherlands and Europe, in one place. People share a link to a public post, a moderator approves it, visitors filter by role, city, country, seniority and work mode, then message the author directly.

Next.js 15 (App Router), Prisma, Postgres (Neon). Without `DATABASE_URL` the site runs on sample data.

## Run locally

```bash
npm install
npm run dev
```

With a database: copy `.env.example` to `.env`, fill `DATABASE_URL`, then `npm run db:push`.

## Deploy on Vercel

1. Vercel dashboard: Add New > Project > import this GitHub repo (framework Next.js, defaults are fine).
2. Storage tab: create a Neon Postgres database and connect it to the project. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. Settings > Environment Variables: add `ADMIN_TOKEN` (random, 16+ characters) and optionally `CONTACT_EMAIL`.
4. Redeploy. The `vercel-build` script creates the table (`prisma db push`) before `next build`.

Moderate submissions at `/admin`.

## Notes

- No scraping: LinkedIn and X do not allow it. Referral posts come from community submissions.
- Company jobs: `src/lib/ingest.ts` imports Europe-based tech roles daily (Vercel Cron, `vercel.json`) from public Greenhouse, Lever and Ashby job boards and the Arbeitnow API. The cron route needs `CRON_SECRET`. Add a company by adding its board token to `ingest.ts`.
- Approved referral posts are hidden after 45 days; imported jobs when the import has not seen them for 3 days.
- Spam protection is a honeypot field plus moderation. Add rate limiting (for example Vercel Firewall rules) if spam grows.
