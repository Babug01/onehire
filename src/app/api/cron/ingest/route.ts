import { getDb } from "@/lib/db";
import { ingestJobs } from "@/lib/ingest";
import { safeEqual } from "@/lib/secure";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Called daily by Vercel Cron, which sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = getDb();
  if (!db) return Response.json({ error: "DATABASE_URL not set" }, { status: 500 });
  return Response.json(await ingestJobs(db));
}
