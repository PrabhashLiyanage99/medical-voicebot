import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "medical_admin";
export const SESSION_SECONDS = 8 * 60 * 60;
export function adminConfigured() { return (process.env.ADMIN_PASSWORD?.length ?? 0) >= 12; }
function equal(a: string, b: string) {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function validPassword(value: string) {
  return adminConfigured() && equal(value, process.env.ADMIN_PASSWORD!);
}
function signature(payload: string) {
  return createHmac("sha256", process.env.ADMIN_PASSWORD!).update(`admin-session:${payload}`).digest("hex");
}
export function createSession() {
  const payload = `${Date.now() + SESSION_SECONDS * 1000}.${randomBytes(24).toString("hex")}`;
  return `${payload}.${signature(payload)}`;
}
export async function isAdmin() {
  if (!adminConfigured()) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  const parts = token.split(".");
  if (parts.length !== 3 || !/^\d{13}$/.test(parts[0]) || !/^[a-f0-9]{48}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return false;
  const expiry = Number(parts[0]);
  return expiry > Date.now() && expiry <= Date.now() + SESSION_SECONDS * 1000 && equal(signature(`${parts[0]}.${parts[1]}`), parts[2]);
}
