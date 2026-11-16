import { COMPANIES } from "@/lib/companies";
import { getDb } from "@/lib/db";

const BY_DOMAIN = new Map(COMPANIES.map((c) => [c.domain, c.name]));
const CACHE = "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400";
const HEADERS = { "cache-control": CACHE, "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'" };

const pngWidth = (b: Buffer) => (b.length > 24 && b.readUInt32BE(0) === 0x89504e47 ? b.readUInt32BE(16) : 0);

function letterSvg(name: string): string {
  const letter = (name.match(/[A-Za-z0-9]/)?.[0] ?? "?").toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b1f3a"/><text x="32" y="43" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="30" font-weight="700" fill="#ffffff" text-anchor="middle">${letter}</text></svg>`;
}

// Only domains we know (followed companies, or websites found for job-board companies) are served.
export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
  const domain = (await params).domain.toLowerCase();
  if (!/^[a-z0-9.-]{3,100}$/.test(domain)) return new Response("Not found", { status: 404 });
  const name =
    BY_DOMAIN.get(domain) ?? (await getDb()?.companyDomain.findFirst({ where: { domain }, select: { name: true } }))?.name;
  if (!name) return new Response("Not found", { status: 404 });
  try {
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`, {
      signal: AbortSignal.timeout(8000),
    });
    const type = res.headers.get("content-type") ?? "";
    const body = Buffer.from(await res.arrayBuffer());
    if (res.ok && ((type.startsWith("image/png") && pngWidth(body) >= 32) || type.startsWith("image/jpeg"))) {
      return new Response(body, { headers: { ...HEADERS, "content-type": type } });
    }
  } catch {
    // Fall through to the letter tile.
  }
  return new Response(letterSvg(name), { headers: { ...HEADERS, "content-type": "image/svg+xml" } });
}
