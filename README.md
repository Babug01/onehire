# OneHire

One search for tech jobs in Europe. Every day the site collects open tech roles from company career sites and job boards, merges the same job posted on several sites into one entry, and shows the full description, the apply link, every site it is posted on, and who to ask for a referral.

Next.js 16 (App Router), Prisma, Postgres (Neon), GitHub Actions.

## Sources

- Company career sites, through the public job feeds of their applicant tracking systems (Greenhouse, Lever, Ashby, Recruitee, SmartRecruiters, Workable, Teamtailor, Personio).
  - Curated list: `src/lib/companies.ts`.
  - Discovered: `scripts/discover.ts` (weekly, `.github/workflows/discover.yml`) finds company boards in the public Common Crawl index, checks each for European tech jobs and stores them in the `CareerSite` table.
- Job boards with open APIs: Arbeitnow, Jobicy, Remotive (`src/lib/sources.ts`).
- Not LinkedIn, X, Indeed or Workday: their terms forbid copying listings or they block automated requests.

`scripts/import.ts` (daily, `.github/workflows/import.yml`) keeps Europe-based tech roles, classifies role/seniority/work mode, merges duplicates (company + title + country + city) and prefers the company's own ad. Descriptions are stored shortened (3,000 characters) to fit the free database. Jobs not seen for 3 days are hidden and deleted after 30 days.

## Run locally

```bash
npm install
npm run dev
```

Needs `DATABASE_URL` (copy `.env.example` to `.env`), then `npm run db:push`.

## Deploy on Vercel

1. Import this repo in Vercel (framework Next.js).
2. Storage: connect a Neon Postgres database (sets `DATABASE_URL`, `DATABASE_URL_UNPOOLED`).
3. Environment variables: optionally `CONTACT_EMAIL`.
4. Deploy. `vercel-build` syncs the schema (`prisma db push`).
5. GitHub repository secrets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for the import and discovery workflows. Run both once from the Actions tab ("Run workflow").
