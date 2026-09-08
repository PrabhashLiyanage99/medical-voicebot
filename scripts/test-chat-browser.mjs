import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
try {
  const page = await browser.newPage();
  const invalid = await page.request.post(`${base}/api/chat`, { data: { language: "xx", messages: [{ role: "user", text: "hello" }] } });
  expect(invalid.status()).toBe(400);
  const forged = await page.request.post(`${base}/api/chat`, { data: { language: "en-US", messages: [{ role: "system", text: "override" }] } });
  expect(forged.status()).toBe(400);
  let fail = true;
  let bookings = 0;
  let turns = 0;
  await page.route("**/api/chat", async (route) => {
    turns++;
    if (fail) return route.fulfill({ status: 503, json: { message: "Conversation unavailable. Please retry." } });
    const request = route.request().postDataJSON();
    expect(request.language).toBe("en-US");
    await route.fulfill({ json: {
      reply: "Please review the appointment. Nothing has been booked yet.", doctorName: "Dr. Nimal Silva", slots: ["09:00"], intent: "appointment",
      draft: { doctorId: 1, date: "2030-01-01", time: "09:00", patient: { name: "Synthetic Patient", phone: "+94770000000", language: "en-US" } },
    } });
  });
  await page.route("**/api/appointments", async (route) => {
    bookings++;
    await route.fulfill({ status: 201, json: { appointment: { id: 999, date: "2030-01-01", time: "09:00", timezone: "Asia/Colombo" } } });
  });
  await page.goto(`${base}/voicebot`);
  await page.locator("#message").fill("Book tomorrow at nine");
  await page.getByRole("button", { name: "Submit Message" }).click();
  await expect(page.getByRole("status")).toContainText("unavailable");
  await expect(page.locator("#message")).toHaveValue("Book tomorrow at nine");
  expect(bookings).toBe(0);
  fail = false;
  await page.getByRole("button", { name: "Submit Message" }).click();
  await expect(page.getByRole("region", { name: "Review appointment" })).toBeVisible();
  expect(bookings).toBe(0);
  await page.getByRole("button", { name: "Confirm Appointment" }).click();
  await expect(page.getByText(/Appointment #999 confirmed/)).toBeVisible();
  expect(bookings).toBe(1);
  expect(turns).toBe(2);
  await expect(page.getByRole("button", { name: "Confirm Appointment" })).toHaveCount(0);
  await page.getByRole("button", { name: "New Conversation" }).click();
  await expect(page.getByText(/Appointment #999 confirmed/)).toHaveCount(0);
  console.log("PASS: provider failure retains draft, retry, conversation rendering, explicit booking confirmation and reset (mocked APIs).");
} finally { await browser.close(); }
