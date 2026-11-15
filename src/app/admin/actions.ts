"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminToken, checkToken, isAdmin, sessionValue } from "@/lib/admin";
import { getDb } from "@/lib/db";

const STATUSES = new Set(["approved", "rejected", "removed"]);

export async function login(form: FormData): Promise<void> {
  const token = adminToken();
  if (!token || !checkToken(String(form.get("token") ?? ""))) redirect("/admin?error=1");
  (await cookies()).set(ADMIN_COOKIE, sessionValue(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: 8 * 3600,
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin");
}

export async function setStatus(form: FormData): Promise<void> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
  const db = getDb();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!db || !id || !STATUSES.has(status)) throw new Error("Bad request");
  await db.post.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
  revalidatePath("/");
}
