const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e.startsWith("#")) {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Job ads arrive as HTML; we keep plain text only, so nothing from a feed is ever rendered as markup. */
export function htmlToText(html: string): string {
  let s = html;
  if (/&lt;[a-z/]/i.test(s)) s = decodeEntities(s); // Greenhouse double-encodes its HTML
  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|section)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(s)
    .split("\n")
    .map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const IGNORED_EMAIL = /^(no-?reply|privacy|gdpr|dpo|accommodations?|accessibility|data\.?protection|security|legal|abuse|press)@/i;
const APPLY_CONTEXT = /\b(cv|resume|apply|application|send|questions?|reach out|contact (me|us)|recruiter|hiring|sollicit\w*|bewerb\w*)\b/i;
const BOILERPLATE_CONTEXT = /(accommodat|disabilit|privacy|data protection|gdpr|legal|accessib|fraud|scam|phishing|equal opportunit)/i;

/** An email the ad gives for applying or questions; footer addresses (privacy, accommodations) are skipped. */
export function contactEmailIn(text: string): string {
  for (const m of text.matchAll(EMAIL)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 160), m.index);
    if (!IGNORED_EMAIL.test(m[0]) && APPLY_CONTEXT.test(before) && !BOILERPLATE_CONTEXT.test(before)) return m[0].toLowerCase();
  }
  return "";
}

const CONTACT_KEYWORDS =
  /(hiring manager|recruiter|talent (?:acquisition )?(?:partner|specialist|lead)|contact person|your contact|ansprechpartner(?:in)?|contactpersoon|reach out to)\s*(?:is|will be|:|-|–)?\s*/gi;
const NAME_AT_START = /^([A-ZÀ-Þ][a-zß-ÿ'’-]+(?: (?:van |de |der |den )?[A-ZÀ-Þ][a-zß-ÿ'’-]+){1,2})/;
const NOT_A_NAME = /^(The|Our|We|You|This|Please|Team|Hiring|Talent|Recruit\w*|Manager|Lead|Head|Senior|Engineering|People|Human)\b|\b(Call|Screen\w*|Interview|Chat|Round|Stage|Step|Meeting|Session|Conversation|Assessment|Team)$/;

/** A person named in the ad as hiring manager / recruiter / contact, if the ad names one. */
export function hiringContactIn(text: string): string {
  for (const m of text.matchAll(CONTACT_KEYWORDS)) {
    const start = (m.index ?? 0) + m[0].length;
    const name = text.slice(start, start + 60).match(NAME_AT_START)?.[1];
    if (name && !NOT_A_NAME.test(name)) return name;
  }
  return "";
}

const LEGAL_FORMS =
  /\b(gmbh|ag|se|bv|b\.v\.|nv|n\.v\.|ltd|limited|inc|llc|plc|sas|sa|srl|ab|as|oy|aps|group|holding|technologies|technology|labs?)\b/g;

const fold = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

export const companyKey = (s: string) => fold(s).replace(/\.com\b/, "").replace(LEGAL_FORMS, " ").replace(/[^a-z0-9]+/g, "");

export const titleKey = (s: string) =>
  fold(s)
    .replace(/\((?:[mfwdx]\s*\/\s*){1,3}[mfwdx]\)|\b[mfwd]\/[mfwd](?:\/[mfwdx])?\b/g, " ")
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();
