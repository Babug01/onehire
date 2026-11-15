import type { Metadata } from "next";
import { MAX_AGE_DAYS } from "@/lib/posts";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <section className="prose hero">
      <h1>About</h1>
      <p>
        Many tech jobs in Europe are filled through referrals. People who work at a company often post on LinkedIn
        or X that their team is hiring and that they are happy to refer. Those posts are easy to miss. This site
        lists them in one place, filtered by role, city, country, seniority and work mode.
      </p>
      <p>
        Next to referral posts, we import open tech roles in Europe every day from the public job boards of companies
        such as Adyen, Mollie, Elastic and Spotify (Greenhouse, Lever and Ashby) and from Arbeitnow. For those jobs,
        find someone at the company on LinkedIn and ask for a referral before you apply.
      </p>
      <h2>How it works</h2>
      <ol>
        <li>Browse or filter referral posts and company jobs.</li>
        <li>Open the original post, or the job on the company careers page.</li>
        <li>Message the post author, or someone at the company, with a short intro and your CV.</li>
      </ol>
      <p>
        We never take applications or act as a recruiter. Referral posts are shared by the community, reviewed before
        they appear, and hidden after {MAX_AGE_DAYS} days. Company jobs disappear when they close.
      </p>
      <h2>Privacy</h2>
      <p>
        We store only what is needed to list a post: the link to the public post, the role details and the name of the
        author as shown on that post. We use no tracking cookies. Authors who want a post removed can ask{" "}
        {contact ? <a href={`mailto:${contact}`}>{contact}</a> : "the site owner"} and we remove it.
      </p>
    </section>
  );
}
