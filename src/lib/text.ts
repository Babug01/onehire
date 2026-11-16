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

const VISA_YES =
  /visa sponsorship|sponsor(?:ing|ship)? (?:your |a |the )?(?:work )?(?:visa|permit)|visa (?:support|assistance)|kennismigrant|highly[- ]skilled migrant|blue card|we (?:can |will )?sponsor/;
const VISA_NO =
  /(?:not|unable to|cannot|can't|don't|do not|no|without) (?:offer |provide |currently )?(?:any )?(?:visa )?sponsor|(?:visa|sponsorship)[^.\n]{0,60}(?:not (?:available|offered|provided|possible)|unable|cannot)/;
const RELOCATION = /relocation (?:support|package|assistance|bonus|budget|allowance)|help(?:ing)? you (?:to )?relocate|relocation is (?:provided|offered|available)/;
const RELOCATION_NO = /no relocation|relocation[^.\n]{0,60}(?:not (?:available|offered|provided|possible)|unable|cannot)/;
const LANGUAGES = ["dutch", "german", "french", "spanish", "italian", "polish", "swedish", "danish", "norwegian", "finnish", "portuguese", "czech"];
const AD_LANGUAGE: [string, RegExp][] = [
  ["dutch", /\b(het|een|wij|jij|je|bij|voor|zijn|naar|onze|ervaring)\b/g],
  ["german", /\b(und|die|der|wir|sie|mit|für|bei|ist|unsere|erfahrung)\b/g],
  ["french", /\b(et|les|des|vous|nous|pour|avec|est|une|notre|expérience)\b/g],
];
const ENGLISH = /\b(the|and|you|we|with|for|are|our|your|experience)\b/g;

/** Visa sponsorship, relocation help and required local languages, as stated in (or implied by) the ad. */
export function tagsFor(text: string): { visa: boolean; relocation: boolean; languages: string } {
  const t = text.toLowerCase();
  const required = new Set<string>();
  for (const l of LANGUAGES) {
    const needs = new RegExp(
      `(?:fluent|native|business[- ]level|professional|excellent|very good|strong|proficien\\w*|c1|c2)[^.\\n]{0,40}\\b${l}\\b|\\b${l}\\b[^.\\n]{0,30}(?:is )?(?:required|mandatory|a must|essential)`,
    );
    const optional = new RegExp(
      `\\b${l}\\b[^.\\n]{0,40}(?:a plus|nice[- ]to[- ]have|an advantage|a bonus|preferred|beneficial|not (?:a )?(?:requirement|required|necessary|needed))`,
    );
    if (needs.test(t) && !optional.test(t)) required.add(l);
  }
  // An ad written in the local language effectively requires it.
  const english = (t.match(ENGLISH) ?? []).length;
  for (const [l, re] of AD_LANGUAGE) if ((t.match(re) ?? []).length > Math.max(15, english)) required.add(l);
  return {
    visa: VISA_YES.test(t) && !VISA_NO.test(t),
    relocation: RELOCATION.test(t) && !RELOCATION_NO.test(t),
    languages: [...required].join(","),
  };
}
