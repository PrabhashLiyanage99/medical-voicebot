import "dotenv/config";
import { chromium, expect } from "@playwright/test";
import { PrismaClient } from "../src/generated/prisma/client";
const prisma = new PrismaClient();
async function main() {
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
  const doctor = await prisma.doctor.create({ data: { name: "Admin test doctor", specialization: "Test" } });
  const appointment = await prisma.appointment.create({ data: { doctor: { connect: { id: doctor.id } }, date: new Date("2035-01-02T00:00:00Z"), time: "09:00", patient: { create: { name: `Admin test patient ${doctor.id}`, phone: "+94770000000", language: "en-US" } } } });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/dashboard`);
    await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
    expect(await page.content()).not.toContain(`Admin test patient ${doctor.id}`);
    await page.getByLabel("Admin password").fill("incorrect-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Incorrect password");
    await page.getByLabel("Admin password").fill(process.env.ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Appointments", exact: true })).toBeVisible();
    const cookie = (await page.context().cookies()).find((item) => item.name === "medical_admin");
    expect(cookie?.httpOnly).toBe(true);
    await page.getByLabel("Doctor", { exact: true }).selectOption(String(doctor.id));
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("cell", { name: `Admin test patient ${doctor.id}`, exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "CONFIRMED", exact: true })).toBeVisible();
    await page.getByLabel("Appointment date").fill("2035-01-03");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByText(/No appointments found/)).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
    await page.context().addCookies([{ name: "medical_admin", value: "forged-session", url: base }]);
    await page.goto(`${base}/dashboard`);
    await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
    console.log("PASS: unauthenticated privacy, invalid/valid login, protected patient details, filters, empty results, logout and forged-cookie rejection.");
  } finally {
    await browser.close();
    await prisma.appointment.delete({ where: { id: appointment.id } });
    await prisma.patient.delete({ where: { id: appointment.patientId } });
    await prisma.doctor.delete({ where: { id: doctor.id } });
  }
}
main().catch((error) => { const message = String(error?.message ?? "Unknown error").replaceAll(process.env.ADMIN_PASSWORD ?? "unused-secret", "[redacted]"); console.error(message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
