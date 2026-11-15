export type Place = { country: string; city: string };

const COUNTRY_PATTERNS: [RegExp, string][] = [
  [/\b(netherlands|nederland|holland)\b/, "NL"],
  [/\b(belgium|belgi[eë]|belgique)\b/, "BE"],
  [/\b(germany|deutschland)\b/, "DE"],
  [/\bfrance\b/, "FR"],
  [/\bireland\b/, "IE"],
  [/\b(united kingdom|england|scotland|wales|great britain|uk)\b/, "GB"],
  [/\b(spain|espa[nñ]a)\b/, "ES"],
  [/\bportugal\b/, "PT"],
  [/\b(italy|italia)\b/, "IT"],
  [/\b(poland|polska)\b/, "PL"],
  [/\b(austria|[oö]sterreich)\b/, "AT"],
  [/\b(switzerland|schweiz|suisse)\b/, "CH"],
  [/\b(sweden|sverige)\b/, "SE"],
  [/\b(denmark|danmark)\b/, "DK"],
  [/\b(norway|norge)\b/, "NO"],
  [/\b(finland|suomi)\b/, "FI"],
  [/\b(czechia|czech republic)\b/, "CZ"],
  [/\bromania\b/, "RO"],
  [/\bgreece\b/, "GR"],
  [/\bhungary\b/, "HU"],
  [/\bestonia\b/, "EE"],
  [/\blithuania\b/, "LT"],
  [/\bluxembourg\b/, "LU"],
];

// Lower-case spellings -> [display name, country].
const CITY_LIST: [string[], string, string][] = [
  [["amsterdam"], "Amsterdam", "NL"],
  [["rotterdam"], "Rotterdam", "NL"],
  [["utrecht"], "Utrecht", "NL"],
  [["the hague", "den haag"], "The Hague", "NL"],
  [["eindhoven"], "Eindhoven", "NL"],
  [["delft"], "Delft", "NL"],
  [["groningen"], "Groningen", "NL"],
  [["leiden"], "Leiden", "NL"],
  [["haarlem"], "Haarlem", "NL"],
  [["amersfoort"], "Amersfoort", "NL"],
  [["brussels", "bruxelles", "brussel"], "Brussels", "BE"],
  [["antwerp", "antwerpen"], "Antwerp", "BE"],
  [["ghent", "gent"], "Ghent", "BE"],
  [["berlin"], "Berlin", "DE"],
  [["munich", "münchen", "muenchen"], "Munich", "DE"],
  [["hamburg"], "Hamburg", "DE"],
  [["frankfurt"], "Frankfurt", "DE"],
  [["cologne", "köln", "koeln"], "Cologne", "DE"],
  [["stuttgart"], "Stuttgart", "DE"],
  [["düsseldorf", "dusseldorf", "duesseldorf"], "Düsseldorf", "DE"],
  [["leipzig"], "Leipzig", "DE"],
  [["paris"], "Paris", "FR"],
  [["lyon"], "Lyon", "FR"],
  [["nantes"], "Nantes", "FR"],
  [["toulouse"], "Toulouse", "FR"],
  [["dublin"], "Dublin", "IE"],
  [["cork"], "Cork", "IE"],
  [["london"], "London", "GB"],
  [["manchester"], "Manchester", "GB"],
  [["edinburgh"], "Edinburgh", "GB"],
  [["bristol"], "Bristol", "GB"],
  [["barcelona"], "Barcelona", "ES"],
  [["madrid"], "Madrid", "ES"],
  [["valencia"], "Valencia", "ES"],
  [["malaga", "málaga"], "Málaga", "ES"],
  [["lisbon", "lisboa"], "Lisbon", "PT"],
  [["porto"], "Porto", "PT"],
  [["milan", "milano"], "Milan", "IT"],
  [["rome", "roma"], "Rome", "IT"],
  [["warsaw", "warszawa"], "Warsaw", "PL"],
  [["krakow", "kraków"], "Kraków", "PL"],
  [["wroclaw", "wrocław"], "Wrocław", "PL"],
  [["gdansk", "gdańsk"], "Gdańsk", "PL"],
  [["vienna", "wien"], "Vienna", "AT"],
  [["zurich", "zürich"], "Zurich", "CH"],
  [["geneva", "genève"], "Geneva", "CH"],
  [["lausanne"], "Lausanne", "CH"],
  [["stockholm"], "Stockholm", "SE"],
  [["gothenburg", "göteborg"], "Gothenburg", "SE"],
  [["malmö", "malmo"], "Malmö", "SE"],
  [["copenhagen", "københavn"], "Copenhagen", "DK"],
  [["aarhus"], "Aarhus", "DK"],
  [["oslo"], "Oslo", "NO"],
  [["helsinki"], "Helsinki", "FI"],
  [["espoo"], "Espoo", "FI"],
  [["prague", "praha"], "Prague", "CZ"],
  [["bucharest"], "Bucharest", "RO"],
  [["athens"], "Athens", "GR"],
  [["budapest"], "Budapest", "HU"],
  [["tallinn"], "Tallinn", "EE"],
  [["vilnius"], "Vilnius", "LT"],
  [["luxembourg"], "Luxembourg", "LU"],
];

const CITY_PATTERNS: [RegExp, string, string][] = CITY_LIST.flatMap(([names, display, country]) =>
  names.map((n): [RegExp, string, string] => [new RegExp(`(^|[^\\p{L}])${n}([^\\p{L}]|$)`, "u"), display, country]),
);

const REMOTE = /\b(remote|anywhere|home office|work from home|wfh)\b/;
const EUROPE = /\b(emea|europe|european union|eu|cet)\b/;

/** Maps free-text locations to a European country and city; null when outside Europe or unknown. */
export function placeFor(locations: string[], opts: { countryCode?: string; bareRemoteIsEurope?: boolean } = {}): Place | null {
  for (const raw of locations) {
    const loc = raw.toLowerCase();
    for (const [re, city, country] of CITY_PATTERNS) if (re.test(loc)) return { country, city };
  }
  for (const raw of locations) {
    const loc = raw.toLowerCase();
    for (const [re, country] of COUNTRY_PATTERNS) {
      if (re.test(loc)) return { country, city: REMOTE.test(loc) ? "Remote" : "" };
    }
    if (REMOTE.test(loc) && (EUROPE.test(loc) || opts.bareRemoteIsEurope)) return { country: "EU", city: "Remote" };
  }
  if (opts.countryCode) return { country: opts.countryCode, city: "" };
  return null;
}

const NON_TECH =
  /\b(sales|account (executive|manager|director)|recruit\w*|talent|marketing|finance|financial|legal|counsel|payroll|accountant|accounting|customer success|business development|partnerships?|office manager|people partner|human resources|copywriter|executive assistant|tax|treasury|procurement|bdr|sdr)\b/;

const CATEGORY_RULES: [RegExp, string][] = [
  [/\b(engineering manager|head of engineering|vp,? (of )?engineering|vice president,? (of )?engineering|director,? (of )?engineering|cto|chief technology)\b/, "Engineering management"],
  [/\b(security|appsec|secops|penetration|infosec)\b/, "Security"],
  [/\b(devops|sre|site reliability|platform engineer\w*|infrastructure|cloud engineer|cloud architect|kubernetes|systems engineer|network engineer|dba|database (engineer|administrator))\b/, "DevOps / Cloud"],
  [/\b(data engineer\w*|data scien\w*|data analyst|analytics engineer|machine learning|ml engineer|mlops|ai engineer|research (scientist|engineer)|llm|deep learning|computer vision|nlp|applied scientist|business intelligence)\b/, "Data / ML"],
  [/\b(ios|android|mobile|flutter|react native)\b/, "Mobile"],
  [/\b(qa|testing|test engineer|test automation|quality (assurance|engineer)|sdet)\b/, "QA / Test"],
  [/\bfull[- ]?stack\b/, "Full-stack"],
  [/\b(front[- ]?end|react|angular|vue|ui engineer|web developer)\b/, "Frontend"],
  [/\b(back[- ]?end|java|golang|python|php|ruby|scala|kotlin|node\.?js|rust|elixir)\b|\.net\b|c#/, "Backend"],
  [/\b(product manager|product owner|head of product|product lead|technical program manager)\b/, "Product"],
  [/\b(product designer|ux|ui designer|interaction designer|design lead)\b/, "Design"],
  [/\b(software|developer|engineer|engineering|programmer|architect)\b/, "Software Engineering"],
];

/** Tech category for a job title, or null for non-tech roles. */
export function categoryFor(title: string): string | null {
  const t = title.toLowerCase();
  if (NON_TECH.test(t)) return null;
  for (const [re, category] of CATEGORY_RULES) if (re.test(t)) return category;
  return null;
}

const SENIORITY_RULES: [RegExp, string][] = [
  [/\b(intern|internship|graduate|trainee|working student|werkstudent|apprentice|stagiaire)\b/, "Intern / Graduate"],
  [/\b(staff|principal|distinguished)\b/, "Staff / Principal"],
  [/\b(head of|director|vp|vice president|engineering manager|team lead|tech lead|lead)\b/, "Lead / Manager"],
  [/\b(senior|sr|expert)\b/, "Senior"],
  [/\b(junior|jr|entry[- ]level)\b/, "Junior"],
  [/\b(medior|mid[- ]?level|intermediate)\b/, "Medior"],
];

export function seniorityFor(title: string, level = ""): string {
  for (const text of [title, level]) {
    const t = text.toLowerCase();
    for (const [re, s] of SENIORITY_RULES) if (re.test(t)) return s;
  }
  return "Not specified";
}

export const EUROPE_CODES = new Set([
  "NL", "BE", "DE", "FR", "IE", "GB", "ES", "PT", "IT", "PL", "AT", "CH", "SE", "DK", "NO", "FI",
  "CZ", "RO", "GR", "HU", "EE", "LT", "LU", "EU",
]);

export function workModeFor(...hints: (string | boolean | null | undefined)[]): string {
  const text = hints.filter((h) => typeof h === "string").join(" ").toLowerCase();
  if (/hybrid/.test(text)) return "Hybrid";
  if (hints.includes(true) || REMOTE.test(text)) return "Remote";
  if (/on-?site|in[- ]office/.test(text)) return "On-site";
  return "Not specified";
}
