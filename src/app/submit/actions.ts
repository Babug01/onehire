"use server";

import { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { parseSubmission } from "@/lib/validate";

export type SubmitState = { ok: boolean; message: string } | null;

export async function submitPost(_prev: SubmitState, form: FormData): Promise<SubmitState> {
  const thanks = { ok: true, message: "Thanks! The post will appear after a quick review." };
  // Honeypot: bots fill every field, people never see this one.
  if (String(form.get("website") ?? "")) return thanks;

  const db = getDb();
  if (!db) return { ok: false, message: "Submissions are not open yet." };

  const parsed = parseSubmission(form);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  try {
    await db.post.create({ data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: "This post has already been shared." };
    }
    throw e;
  }
  return thanks;
}
