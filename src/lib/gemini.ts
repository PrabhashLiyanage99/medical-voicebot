import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export async function geminiJson<T>(systemInstruction: string, data: unknown, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_UNAVAILABLE");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: JSON.stringify(data),
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(schema),
      temperature: 0,
      maxOutputTokens: 1500,
      httpOptions: { timeout: 20000 },
      abortSignal: signal,
    },
  });
  if (!response.text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return schema.parse(JSON.parse(response.text));
}
