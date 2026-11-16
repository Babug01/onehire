import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, type JobDetailData } from "@/lib/jobs";
import { COUNTRIES } from "@/lib/options";
import { SITE_URL } from "@/lib/site";
import { JobDetail, placeOf } from "../../ui";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const job = await getJob((await params).id);
  if (!job) return { title: "Job not found", robots: { index: false } };
  return {
    title: `${job.title} at ${job.company}`,
    description: `${job.title} at ${job.company}, ${placeOf(job)}. ${job.description.slice(0, 150)}`,
    alternates: { canonical: `${SITE_URL}/jobs/${job.id}` },
  };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function employmentType(t: string): string | undefined {
  const s = t.toLowerCase();
  if (/intern|werkstudent|working student/.test(s)) return "INTERN";
  if (/part/.test(s)) return "PART_TIME";
  if (/contract|freelance/.test(s)) return "CONTRACTOR";
  if (/temporary|fixed[- ]term/.test(s)) return "TEMPORARY";
  if (/full|permanent/.test(s)) return "FULL_TIME";
  return undefined;
}

/** schema.org JobPosting, so the job can appear in Google's job search. */
function jobPostingLd(job: JobDetailData) {
  const remote = job.workMode === "Remote" || job.country === "EU";
  const countries = job.country === "EU" ? ["NL", "DE", "FR", "ES", "IT", "PL", "IE", "BE", "PT", "AT"] : [job.country];
  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: escapeHtml(job.description || job.title).replace(/\n/g, "<br>"),
    datePosted: job.postedAt.toISOString(),
    identifier: { "@type": "PropertyValue", name: "OneHire", value: job.id },
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
      ...(job.companyDomain ? { sameAs: `https://${job.companyDomain}` } : {}),
    },
    ...(employmentType(job.employmentType) ? { employmentType: employmentType(job.employmentType) } : {}),
    ...(remote
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: countries.map((c) => ({ "@type": "Country", name: COUNTRIES[c] ?? c })),
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: { "@type": "PostalAddress", ...(job.city ? { addressLocality: job.city } : {}), addressCountry: job.country },
          },
        }),
    directApply: false,
  };
}

export default async function JobPage({ params }: { params: Params }) {
  const job = await getJob((await params).id);
  if (!job) notFound();
  return (
    <div className="job-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd(job)).replace(/</g, "\\u003c") }}
      />
      <Link className="back-link" href="/">
        ← Search all jobs
      </Link>
      <JobDetail job={job} />
    </div>
  );
}
