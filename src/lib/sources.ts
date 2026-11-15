import { categoryFor, EUROPE_CODES, placeFor } from "./classify";
import { COMPANIES, type Company } from "./companies";
import { htmlToText } from "./text";

export type RawJob = {
  title: string;
  company: string;
  companyDomain?: string;
  companyIndustry?: string;
  url: string;
  applyUrl?: string;
  sourceName: string;
  sourceKind: "company" | "board";
  locations: string[];
  countryCode?: string;
  bareRemoteIsEurope?: boolean;
  modeHints: (string | boolean | null | undefined)[];
  text: string;
  published: Date;
  employmentType?: string;
  salary?: string;
  level?: string;
  email?: string;
};

export type Source = { name: string; run: () => Promise<RawJob[]> };

const UA = "OneHire-jobs/1.0 (+https://onehire.vercel.app/about)";

async function getJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000), headers: { accept: "application/json", "user-agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<T>;
}

async function pMap<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const n = i++;
        out[n] = await fn(items[n]);
      }
    }),
  );
  return out;
}

const date = (v: unknown) => {
  const d = new Date(typeof v === "number" || typeof v === "string" ? v : Date.now());
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const money = (min?: number | null, max?: number | null, cur?: string | null, per?: string | null) => {
  if (!min && !max) return "";
  const n = (x: number) => x.toLocaleString("en");
  const range = min && max && min !== max ? `${n(min)}–${n(max)}` : n((min || max) as number);
  return [cur, range, per ? `per ${String(per).toLowerCase().replace(/ly$/, "")}` : ""].filter(Boolean).join(" ");
};

const careers = (c: Company) => ({
  company: c.name,
  companyDomain: c.domain,
  companyIndustry: c.industry,
  sourceName: `${c.name} careers`,
  sourceKind: "company" as const,
});

/** Cheap pre-check so we only fetch full ads for European tech roles. */
const looksRelevant = (title: string, locations: string[], countryCode?: string) => {
  if (!categoryFor(title)) return false;
  const place = placeFor(locations, { countryCode });
  return !!place && EUROPE_CODES.has(place.country);
};

function greenhouse(c: Company): Source {
  return {
    name: c.name,
    run: async () => {
      const j = await getJson(`https://boards-api.greenhouse.io/v1/boards/${c.token}/jobs?content=true`);
      return (j.jobs ?? []).map(
        (x: any): RawJob => ({
          ...careers(c),
          title: String(x.title ?? "").trim(),
          url: x.absolute_url,
          locations: [String(x.location?.name ?? ""), ...(x.offices ?? []).map((o: any) => String(o.location ?? o.name ?? ""))],
          modeHints: [x.location?.name],
          text: htmlToText(String(x.content ?? "")),
          published: date(x.first_published ?? x.updated_at),
        }),
      );
    },
  };
}

function lever(c: Company): Source {
  const host = c.ats === "levereu" ? "https://api.eu.lever.co" : "https://api.lever.co";
  return {
    name: c.name,
    run: async () => {
      const j = await getJson<any[]>(`${host}/v0/postings/${c.token}?mode=json`);
      return j.map(
        (x: any): RawJob => ({
          ...careers(c),
          title: String(x.text ?? "").trim(),
          url: x.hostedUrl,
          applyUrl: x.applyUrl,
          locations: [...(x.categories?.allLocations ?? []), String(x.categories?.location ?? "")],
          countryCode: x.country,
          modeHints: [x.workplaceType, x.categories?.location],
          text: [
            x.descriptionPlain ?? htmlToText(String(x.description ?? "")),
            ...(x.lists ?? []).map((l: any) => `${l.text}\n${htmlToText(String(l.content ?? ""))}`),
            x.additionalPlain ?? "",
          ].join("\n\n"),
          published: date(x.createdAt),
          employmentType: x.categories?.commitment,
          salary: x.salaryRange ? money(x.salaryRange.min, x.salaryRange.max, x.salaryRange.currency, x.salaryRange.interval) : "",
        }),
      );
    },
  };
}

function ashby(c: Company): Source {
  return {
    name: c.name,
    run: async () => {
      const j = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${c.token}?includeCompensation=true`);
      return (j.jobs ?? [])
        .filter((x: any) => x.isListed !== false)
        .map(
          (x: any): RawJob => ({
            ...careers(c),
            title: String(x.title ?? "").trim(),
            url: x.jobUrl,
            applyUrl: x.applyUrl,
            locations: [
              String(x.location ?? ""),
              ...(x.secondaryLocations ?? []).map((s: any) => String(s.location ?? "")),
              String(x.address?.postalAddress?.addressCountry ?? ""),
            ],
            modeHints: [x.workplaceType, x.location],
            text: x.descriptionPlain ?? htmlToText(String(x.descriptionHtml ?? "")),
            published: date(x.publishedAt),
            employmentType: x.employmentType,
            salary: x.compensation?.compensationTierSummary ?? "",
          }),
        );
    },
  };
}

function recruitee(c: Company): Source {
  return {
    name: c.name,
    run: async () => {
      const j = await getJson(`https://${c.token}.recruitee.com/api/offers/`);
      return (j.offers ?? []).map(
        (x: any): RawJob => ({
          ...careers(c),
          title: String(x.title ?? "").trim(),
          url: x.careers_url,
          applyUrl: x.careers_apply_url,
          locations: [String(x.location ?? ""), String(x.city ?? ""), String(x.country ?? "")],
          countryCode: x.country_code,
          modeHints: [x.remote === true, x.hybrid ? "hybrid" : "", x.on_site ? "on-site" : ""],
          text: htmlToText(`${x.description ?? ""}\n${x.requirements ?? ""}`),
          published: date(x.published_at ?? x.created_at),
          employmentType: String(x.employment_type_code ?? "").replace(/_/g, " "),
          salary: money(x.salary?.min, x.salary?.max, x.salary?.currency, x.salary?.period),
          level: x.experience_code,
          email: x.mailbox_email,
        }),
      );
    },
  };
}

function smartrecruiters(c: Company): Source {
  return {
    name: c.name,
    run: async () => {
      const list: any[] = [];
      for (let offset = 0; offset < 2000; offset += 100) {
        const page = await getJson(`https://api.smartrecruiters.com/v1/companies/${c.token}/postings?limit=100&offset=${offset}`);
        list.push(...(page.content ?? []));
        if (offset + 100 >= (page.totalFound ?? 0)) break;
      }
      const relevant = list
        .filter((x) => looksRelevant(String(x.name ?? ""), [String(x.location?.fullLocation ?? "")], String(x.location?.country ?? "").toUpperCase()))
        .slice(0, 250);
      const details = await pMap(relevant, 8, (x) =>
        getJson(`https://api.smartrecruiters.com/v1/companies/${c.token}/postings/${x.id}`).catch(() => null),
      );
      return details.filter(Boolean).map((d: any): RawJob => {
        const s = d.jobAd?.sections ?? {};
        return {
          ...careers(c),
          title: String(d.name ?? "").trim(),
          url: d.postingUrl,
          applyUrl: d.applyUrl,
          locations: [String(d.location?.fullLocation ?? ""), String(d.location?.city ?? "")],
          countryCode: String(d.location?.country ?? "").toUpperCase(),
          modeHints: [d.location?.remote === true, d.location?.hybrid ? "hybrid" : ""],
          text: ["companyDescription", "jobDescription", "qualifications", "additionalInformation"]
            .map((k) => (s[k]?.text ? `${s[k].title ?? ""}\n${htmlToText(s[k].text)}` : ""))
            .filter(Boolean)
            .join("\n\n"),
          published: date(d.releasedDate),
          employmentType: d.typeOfEmployment?.label,
          level: d.experienceLevel?.label,
        };
      });
    },
  };
}

function workable(c: Company): Source {
  return {
    name: c.name,
    run: async () => {
      const j = await getJson(`https://apply.workable.com/api/v1/widget/accounts/${c.token}?details=true`);
      return (j.jobs ?? []).map(
        (x: any): RawJob => ({
          ...careers(c),
          title: String(x.title ?? "").trim(),
          url: x.url,
          applyUrl: x.application_url,
          locations: [
            ...(x.locations ?? []).map((l: any) => `${l.city ?? ""}, ${l.country ?? ""}`),
            `${x.city ?? ""}, ${x.country ?? ""}`,
          ],
          countryCode: x.locations?.[0]?.countryCode,
          modeHints: [x.telecommuting === true, x.title],
          text: htmlToText(String(x.description ?? "")),
          published: date(x.published_on ?? x.created_at),
          employmentType: x.employment_type,
          level: x.experience,
        }),
      );
    },
  };
}

const arbeitnow: Source = {
  name: "Arbeitnow",
  run: async () => {
    const out: RawJob[] = [];
    for (let page = 1; page <= 5; page++) {
      const j = await getJson(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
      for (const x of j.data ?? []) {
        out.push({
          title: String(x.title ?? "").trim(),
          company: String(x.company_name ?? "").trim(),
          url: x.url,
          sourceName: "Arbeitnow",
          sourceKind: "board",
          locations: [String(x.location ?? "")],
          bareRemoteIsEurope: true,
          countryCode: /germany|deutschland/i.test(String(x.location)) ? "DE" : undefined,
          modeHints: [x.remote === true, x.location],
          text: htmlToText(String(x.description ?? "")),
          published: date(typeof x.created_at === "number" ? x.created_at * 1000 : undefined),
          employmentType: (x.job_types ?? []).join(", "),
        });
      }
      if (!j.links?.next) break;
    }
    return out;
  },
};

const jobicy: Source = {
  name: "Jobicy",
  run: async () => {
    const j = await getJson("https://jobicy.com/api/v2/remote-jobs?count=100&geo=europe");
    return (j.jobs ?? []).map(
      (x: any): RawJob => ({
        title: decodeTitle(x.jobTitle),
        company: String(x.companyName ?? "").trim(),
        url: x.url,
        sourceName: "Jobicy",
        sourceKind: "board",
        locations: remoteRegions(x.jobGeo),
        bareRemoteIsEurope: false,
        modeHints: [true],
        text: htmlToText(String(x.jobDescription ?? "")),
        published: date(x.pubDate),
        employmentType: (x.jobType ?? []).join(", "),
        salary: money(x.salaryMin, x.salaryMax, x.salaryCurrency, x.salaryPeriod),
        level: x.jobLevel,
      }),
    );
  },
};

const remotive: Source = {
  name: "Remotive",
  run: async () => {
    const out: RawJob[] = [];
    for (const cat of ["software-dev", "devops", "data", "qa", "product", "design"]) {
      const j = await getJson(`https://remotive.com/api/remote-jobs?category=${cat}`);
      for (const x of j.jobs ?? []) {
        out.push({
          title: decodeTitle(x.title),
          company: String(x.company_name ?? "").trim(),
          url: x.url,
          sourceName: "Remotive",
          sourceKind: "board",
          locations: remoteRegions(x.candidate_required_location),
          modeHints: [true],
          text: htmlToText(String(x.description ?? "")),
          published: date(x.publication_date),
          employmentType: String(x.job_type ?? "").replace(/_/g, " "),
          salary: String(x.salary ?? ""),
        });
      }
    }
    return out;
  },
};

function decodeTitle(s: unknown): string {
  return htmlToText(String(s ?? "")).replace(/\s+/g, " ").trim();
}

// Remote boards list allowed regions ("Germany, France", "EMEA", "Worldwide"); worldwide includes Europe.
function remoteRegions(v: unknown): string[] {
  return String(v ?? "")
    .split(/,|\/|;/)
    .map((s) => `${s.trim().replace(/^(worldwide|anywhere|global)$/i, "Europe")} remote`);
}

const BY_ATS = { greenhouse, lever, levereu: lever, ashby, recruitee, smartrecruiters, workable };

export const SOURCES: Source[] = [...COMPANIES.map((c) => BY_ATS[c.ats](c)), arbeitnow, jobicy, remotive];
