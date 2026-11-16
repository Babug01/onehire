import type { Metadata } from "next";
import { COMPANIES } from "@/lib/companies";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "How it works" };
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const contact = process.env.CONTACT_EMAIL;
  const sites = Math.max(COMPANIES.length, (await getDb()?.careerSite.count({ where: { active: true } })) ?? 0);
  return (
    <section className="prose">
      <h1>How it works</h1>
      <p>
        Tech jobs in Europe are spread over hundreds of career sites and job boards. This site searches them for you:
        every day it collects the open tech roles in Europe, merges the same job posted in several places into one
        entry, and shows where else it is listed.
      </p>
      <h2>Where the jobs come from</h2>
      <ul>
        <li>
          <strong>Company career sites</strong> of {sites.toLocaleString("en")} companies hiring in Europe, such as Adyen,
          bunq, Coolblue, Mollie, TomTom, Spotify and Wise. We read the public job feeds their career sites publish, and
          every week we look for more companies in the public Common Crawl web archive.
        </li>
        <li>
          <strong>Job boards</strong> with open APIs: Arbeitnow, Jobicy and Remotive. These also carry jobs from smaller
          companies and agencies.
        </li>
      </ul>
      <h2>Why not LinkedIn, X or Indeed?</h2>
      <p>
        Their terms forbid copying listings, and they offer no API to read jobs. LinkedIn also keeps applicant numbers to
        itself, so no site outside LinkedIn can show them. Instead, every job here links to LinkedIn to find someone at
        the company who can refer you.
      </p>
      <h2>On each job</h2>
      <ul>
        <li>The full description and the apply link on the original site.</li>
        <li>Every site the job is posted on, and when it was first posted.</li>
        <li>The hiring contact or email address, when the ad itself names one.</li>
        <li>A LinkedIn search for people at the company, to ask for a referral.</li>
      </ul>
      <p>Jobs disappear a few days after they are taken down from the original sites. We never take applications.</p>
      <h2>Privacy</h2>
      <p>
        We use no tracking cookies and store no visitor data. Contact names and email addresses are shown only when the
        employer published them in the job ad. To have something removed, contact{" "}
        {contact ? <a href={`mailto:${contact}`}>{contact}</a> : "the site owner"}.
      </p>
    </section>
  );
}
