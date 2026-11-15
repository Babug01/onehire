import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "tr_admin";

export function adminToken(): string | null {
  const t = process.env.ADMIN_TOKEN;
  return t && t.length >= 16 ? t : null;
}

export function sessionValue(token: string): string {
  return createHmac("sha256", token).update("admin-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkToken(input: string): boolean {
  const t = adminToken();
  return !!t && safeEqual(input, t);
}

export async function isAdmin(): Promise<boolean> {
  const t = adminToken();
  if (!t) return false;
  const v = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!v && safeEqual(v, sessionValue(t));
}
