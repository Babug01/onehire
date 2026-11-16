import Link from "next/link";
import { companySlug, type JobCardData, type JobDetailData } from "@/lib/jobs";
import { COUNTRIES } from "@/lib/options";

const DAY = 86_400_000;

export function ago(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const placeOf = (j: { city: string; country: string }) =>
  [j.city, COUNTRIES[j.country] ?? j.country].filter(Boolean).join(", ");

const linkedInPeople = (keywords: string) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;

const shown = (v: string) => v && v !== "Not specified";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Tags({ job }: { job: { visa: boolean; relocation: boolean; languages: string } }) {
  const langs = job.languages ? job.languages.split(",") : [];
  return (
    <div className="tags">
      {job.visa && <span className="tag tag-good">Visa sponsorship</span>}
      {job.relocation && <span className="tag tag-good">Relocation help</span>}
      {langs.length > 0 ? (
        <span className="tag tag-lang">{langs.map(cap).join(" / ")} required</span>
      ) : (
        <span className="tag">English OK</span>
      )}
    </div>
  );
}

export function Logo({ name, domain, size = 42 }: { name: string; domain?: string; size?: number }) {
  if (domain) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served and cached by our own /api/logo route
      <img className="logo logo-img" src={`/api/logo/${domain}`} alt="" width={size} height={size} loading="lazy" />
    );
  }
  return (
    <div className="logo" aria-hidden="true">
      {(name.match(/[A-Za-z0-9]/)?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

export function JobCard({ job, href, selected }: { job: JobCardData; href: string; selected: boolean }) {
  const sites = job.listings.map((l) => l.sourceName);
  return (
    <Link href={href} className={`job-card${selected ? " selected" : ""}`} aria-current={selected ? "true" : undefined}>
      <Logo name={job.company} domain={job.companyDomain} />
      <div className="job-card-body">
        <h2>{job.title}</h2>
        <div className="job-card-company">
          {job.company}
          {job.companyIndustry && <span className="muted"> · {job.companyIndustry}</span>}
        </div>
        <div className="job-card-meta">
          <span>{placeOf(job)}</span>
          {shown(job.workMode) && <span>{job.workMode}</span>}
          {shown(job.seniority) && <span>{job.seniority}</span>}
          {job.salary && <span>{job.salary}</span>}
        </div>
        {job.contactName && <div className="job-card-contact">Contact in ad: {job.contactName}</div>}
        <Tags job={job} />
        <div className="job-card-foot">
          <span className="posted">Posted {ago(job.postedAt)}</span>
          <span className="sites" title={sites.join(", ")}>
            {sites.length > 1 ? `On ${sites.length} sites: ` : "On "}
            {sites.slice(0, 2).join(", ")}
            {sites.length > 2 && ` +${sites.length - 2}`}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function JobDetail({ job, fullPageHref }: { job: JobDetailData; fullPageHref?: string }) {
  const primary = job.listings[0];
  const applyLabel = primary?.sourceKind === "company" ? `Apply on ${job.company}'s site` : `Apply via ${primary?.sourceName ?? "job site"}`;
  const subject = encodeURIComponent(`Application: ${job.title}`);
  return (
    <article className="job-detail">
      <header className="detail-head">
        <Logo name={job.company} domain={job.companyDomain} />
        <div>
          <h1>{job.title}</h1>
          <div className="detail-company">
            {job.company} · {placeOf(job)}
          </div>
          <Tags job={job} />
        </div>
      </header>

      <div className="detail-actions">
        <a className="btn" href={job.applyUrl} target="_blank" rel="noopener noreferrer nofollow">
          {applyLabel}
        </a>
        {job.contactEmail && (
          <a className="btn secondary" href={`mailto:${job.contactEmail}?subject=${subject}`}>
            Email {job.contactEmail}
          </a>
        )}
        <a className="btn secondary" href={linkedInPeople(job.company)} target="_blank" rel="noopener noreferrer nofollow">
          Find a referrer at {job.company}
        </a>
      </div>

      <dl className="facts">
        <div>
          <dt>Posted</dt>
          <dd>
            {fmtDate(job.postedAt)} ({ago(job.postedAt)})
          </dd>
        </div>
        <div>
          <dt>Hiring contact</dt>
          <dd>
            {job.contactName ? (
              <>
                {job.contactName}{" "}
                <a href={linkedInPeople(`${job.contactName} ${job.company}`)} target="_blank" rel="noopener noreferrer nofollow">
                  (LinkedIn)
                </a>
              </>
            ) : (
              <span className="muted">Not named in the ad</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Applicants</dt>
          <dd className="muted">Not published by the job sites</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>
            {job.category}
            {shown(job.seniority) && ` · ${job.seniority}`}
          </dd>
        </div>
        {shown(job.workMode) && (
          <div>
            <dt>Work mode</dt>
            <dd>{job.workMode}</dd>
          </div>
        )}
        {job.employmentType && (
          <div>
            <dt>Type</dt>
            <dd>{job.employmentType}</dd>
          </div>
        )}
        {job.salary && (
          <div>
            <dt>Salary</dt>
            <dd>{job.salary}</dd>
          </div>
        )}
      </dl>

      <section className="detail-section">
        <h2>
          Posted on {job.listings.length} {job.listings.length === 1 ? "site" : "sites"}
        </h2>
        <ul className="site-list">
          {job.listings.map((l) => (
            <li key={l.url}>
              <span className={`site-kind ${l.sourceKind}`}>{l.sourceKind === "company" ? "Company site" : "Job board"}</span>
              <span className="site-name">{l.sourceName}</span>
              <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">
                Open ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="detail-section">
        <h2>About {job.company}</h2>
        <p className="company-facts">
          {job.companyIndustry && <span>{job.companyIndustry}</span>}
          {job.companyDomain && (
            <a href={`https://${job.companyDomain}`} target="_blank" rel="noopener noreferrer">
              {job.companyDomain}
            </a>
          )}
          <Link href={`/company/${companySlug(job.company)}`}>
            {job.companyJobs} open {job.companyJobs === 1 ? "job" : "jobs"} in Europe
          </Link>
        </p>
      </section>

      <section className="detail-section">
        <h2>Job description</h2>
        {job.description ? (
          <div className="description">{job.description}</div>
        ) : (
          <p className="muted">The full description is on the job site. Use the apply link above.</p>
        )}
      </section>

      {fullPageHref && (
        <p className="detail-foot">
          <Link href={fullPageHref}>Open as a full page / share link</Link>
        </p>
      )}
    </article>
  );
}
