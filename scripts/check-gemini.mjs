import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  console.log("GEMINI_API_KEY is not configured.");
  process.exitCode = 1;
} else {
  try {
    await new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }).models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash", contents: "Reply with OK.",
      config: { httpOptions: { timeout: 15000 } },
    });
    console.log("Gemini provider is reachable.");
  } catch (error) {
    // Provider error messages can contain credentials or request data: print status only.
    let reason = "UNKNOWN";
    try {
      const payload = JSON.parse(error.message);
      const candidate = payload.error?.details?.find((detail) => detail.reason)?.reason ?? payload.error?.status;
      if (typeof candidate === "string" && /^[A-Z_]{1,80}$/.test(candidate)) reason = candidate;
    } catch { /* Do not print unstructured provider messages. */ }
    console.log(JSON.stringify({ error: error.name, status: error.status ?? null, reason }));
    process.exitCode = 1;
  }
}
