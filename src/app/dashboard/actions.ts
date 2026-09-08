"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, createSession, SESSION_SECONDS, validPassword } from "@/lib/admin-auth";

// Single shared administrator account for the local MVP. Limit failed attempts per process.
const attempts = { count: 0, until: 0 };
export async function login(form: FormData) {
  if (Date.now() > attempts.until) { attempts.count = 0; attempts.until = Date.now() + 60_000; }
  if (attempts.count >= 5) redirect("/dashboard?error=limited");
  const password = form.get("password");
  if (typeof password !== "string" || password.length > 256 || !validPassword(password)) {
    attempts.count++;
    redirect("/dashboard?error=invalid");
  }
  attempts.count = 0;
  (await cookies()).set(ADMIN_COOKIE, createSession(), {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: SESSION_SECONDS,
  });
  redirect("/dashboard");
}
export async function logout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/dashboard");
}
