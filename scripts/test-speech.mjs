import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
try {
  const page = await browser.newPage();
  const mockChat = async (route) => route.fulfill({ json: { reply: "Please choose a doctor. No appointment has been booked.", draft: null, doctorName: null, slots: [], intent: "appointment" } });
  await page.route("**/api/chat", mockChat);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
    Object.defineProperty(window, "webkitSpeechRecognition", { value: undefined, configurable: true });
    Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true });
    delete window.speechSynthesis;
    // Disable both features completely for the text-only scenario.
    delete window.SpeechSynthesisUtterance;
  });
  await page.goto(`${base}/voicebot`);
  await expect(page.getByRole("button", { name: "Start Speaking" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Play Response" })).toBeDisabled();
  await page.getByLabel("Your message", { exact: true }).fill("Book a doctor tomorrow");
  await page.getByRole("button", { name: "Submit Message" }).click();
  await expect(page.getByText("Book a doctor tomorrow", { exact: true })).toBeVisible();
  await expect(page.getByText("Please choose a doctor. No appointment has been booked.").first()).toBeVisible();
  await page.close();

  const speech = await browser.newPage();
  await speech.route("**/api/chat", mockChat);
  speech.on("pageerror", (error) => errors.push(error.message));
  await speech.addInitScript(() => {
    window.speechTest = { aborted: 0, cancelled: 0, current: null, spoken: null };
    class Recognition {
      start() { window.speechTest.current = this; this.onstart?.(); }
      abort() { window.speechTest.aborted++; this.onend?.(); }
    }
    Object.defineProperty(window, "SpeechRecognition", { value: Recognition, configurable: true });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: class { constructor(text) { this.text = text; } }, configurable: true });
    Object.defineProperty(window, "speechSynthesis", { value: {
      getVoices: () => [{ lang: "en-US", name: "English" }, { lang: "fr-FR", name: "French" }],
      addEventListener() {}, removeEventListener() {},
      cancel() { window.speechTest.cancelled++; },
      speak(utterance) { window.speechTest.spoken = utterance; },
    }, configurable: true });
  });
  await speech.goto(`${base}/voicebot`);
  await expect(speech.locator("#language option")).toHaveCount(10);
  await speech.getByRole("button", { name: "Start Speaking" }).click();
  await expect(speech.getByRole("button", { name: "Stop Listening" })).toBeVisible();
  await speech.evaluate(() => {
    const active = window.speechTest.current;
    active.onresult({ results: [{ isFinal: true, 0: { transcript: "Doctor tomorrow" } }] });
    active.onend();
  });
  await expect(speech.locator("#message")).toHaveValue("Doctor tomorrow");
  await speech.locator("#message").fill("Doctor next week");
  await speech.getByRole("button", { name: "Submit Message" }).click();
  await expect(speech.getByText("Doctor next week", { exact: true })).toBeVisible();
  await speech.getByRole("button", { name: "Start Speaking" }).click();
  await speech.evaluate(() => window.speechTest.current.onerror({ error: "not-allowed" }));
  await expect(speech.getByRole("status")).toContainText("denied");
  await expect(speech.locator("#message")).toBeEnabled();
  await speech.locator("#language").selectOption("fr-FR");
  await speech.getByRole("button", { name: "Play Response" }).click();
  expect(await speech.evaluate(() => window.speechTest.spoken.lang)).toBe("fr-FR");
  expect(await speech.evaluate(() => window.speechTest.spoken.voice.name)).toBe("French");
  await speech.getByRole("button", { name: "Stop Playback" }).click();
  await speech.getByRole("button", { name: "Start Speaking" }).click();
  await speech.locator("#language").selectOption("ar-SA");
  await expect(speech.getByRole("button", { name: "Start Speaking" })).toBeVisible();
  await expect(speech.locator('p[lang="ar-SA"]')).toHaveAttribute("dir", "rtl");
  await speech.getByRole("button", { name: "Start Speaking" }).click();
  const before = await speech.evaluate(() => window.speechTest.aborted);
  await speech.getByRole("link", { name: "Back to home" }).click();
  await expect(speech).toHaveURL(`${base}/`);
  expect(await speech.evaluate(() => window.speechTest.aborted)).toBeGreaterThan(before);
  expect(errors).toEqual([]);
  console.log("PASS: text-only fallback, transcript editing, permission errors, language selection, playback, stop controls, RTL and navigation cleanup.");
} finally { await browser.close(); }
