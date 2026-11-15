import { CATEGORIES, COUNTRIES, SENIORITY, WORK_MODES } from "./options";

const PLATFORMS: Record<string, string> = { "linkedin.com": "LinkedIn", "x.com": "X", "twitter.com": "X" };

export type NewPost = {
  title: string;
  company: string;
  city: string;
  country: string;
  category: string;
  seniority: string;
  workMode: string;
  sourceUrl: string;
  platform: string;
  authorName: string;
  description: string;
};

export function normalizeSourceUrl(raw: string): { url: string; platform: string } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  for (const [domain, platform] of Object.entries(PLATFORMS)) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      if (u.pathname.length < 2) return null;
      // Query strings on these sites are tracking parameters; dropping them makes duplicates detectable.
      return { url: `https://${host}${u.pathname.replace(/\/+$/, "")}`, platform };
    }
  }
  return null;
}

function field(form: FormData, name: string, max: number, required = true): string | Error {
  const v = String(form.get(name) ?? "").trim().replace(/\s+/g, " ");
  if (required && !v) return new Error(`Please fill in ${name}.`);
  if (v.length > max) return new Error(`${name} is too long (max ${max} characters).`);
  return v;
}

export function parseSubmission(form: FormData): { data: NewPost } | { error: string } {
  const values = {
    sourceUrl: field(form, "sourceUrl", 500),
    title: field(form, "title", 120),
    company: field(form, "company", 80),
    city: field(form, "city", 60),
    country: field(form, "country", 4),
    category: field(form, "category", 40),
    seniority: field(form, "seniority", 40),
    workMode: field(form, "workMode", 20),
    authorName: field(form, "authorName", 80),
    description: field(form, "description", 600, false),
  };
  for (const v of Object.values(values)) if (v instanceof Error) return { error: v.message };
  const s = values as Record<keyof typeof values, string>;

  const source = normalizeSourceUrl(s.sourceUrl);
  if (!source) return { error: "Link must be an https link to a public LinkedIn or X post." };
  if (!(s.country in COUNTRIES)) return { error: "Unknown country." };
  if (!CATEGORIES.includes(s.category)) return { error: "Unknown category." };
  if (!SENIORITY.includes(s.seniority)) return { error: "Unknown seniority." };
  if (!WORK_MODES.includes(s.workMode)) return { error: "Unknown work mode." };
  if (form.get("confirm") !== "on") return { error: "Please confirm the post is public and offers referrals." };

  return { data: { ...s, sourceUrl: source.url, platform: source.platform } };
}
