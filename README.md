# OneHire

One search for tech jobs in Europe. Every day the site collects open tech roles from company career sites and job boards, merges the same job posted on several sites into one entry, and shows the full description, the apply link, every site it is posted on, and who to ask for a referral.

Next.js 16 (App Router), Prisma, Postgres (Neon), Vercel Cron.

## Sources

- Company career sites, through the public job feeds of their applicant tracking systems (Greenhouse, Lever, Ashby, Recruitee, SmartRecruiters, Workable). The list is in `src/lib/companies.ts`; add a company by adding its board token.
- Job boards with open APIs: Arbeitnow, Jobicy, Remotive (`src/lib/sources.ts`).
- Not LinkedIn, X or Indeed: their terms forbid copying listings and they offer no API to read jobs.

`src/lib/ingest.ts` keeps Europe-based tech roles, classifies role/seniority/work mode, merges duplicates (company + title + country + city) and prefers the company's own ad. Jobs not seen for 3 days are hidden.

## Run locally

```bash
npm install
npm run dev
```

Needs `DATABASE_URL` (copy `.env.example` to `.env`), then `npm run db:push`.

## Deploy on Vercel

1. Import this repo in Vercel (framework Next.js).
2. Storage: connect a Neon Postgres database (sets `DATABASE_URL`, `DATABASE_URL_UNPOOLED`).
3. Environment variables: `CRON_SECRET` (random, 16+ characters), optionally `CONTACT_EMAIL`.
4. Deploy. `vercel-build` syncs the schema (`prisma db push`); the import runs daily at 05:00 UTC (`vercel.json`). Run it once by calling `/api/cron/ingest` with `Authorization: Bearer <CRON_SECRET>`.
