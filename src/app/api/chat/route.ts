import { chatInput } from "@/lib/chat-contract";
import { conversation } from "@/lib/chat-service";
import { json } from "@/lib/appointment-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 24000) return json({ message: "Conversation is too long. Please start a new conversation." }, 413);
    body = JSON.parse(text);
  } catch { return json({ message: "Request body must be valid JSON." }, 400); }
  const input = chatInput.safeParse(body);
  if (!input.success) return json({ message: "Invalid conversation or unsupported language." }, 400);
  if (!process.env.GEMINI_API_KEY) return json({ message: "Conversation service is not configured. Please contact the clinic." }, 503);
  try { return json(await conversation(input.data, undefined, request.signal)); }
  catch {
    // Never return/log provider payloads, API keys, or patient messages.
    console.error("Conversation service request failed");
    return json({ message: "The conversation service is temporarily unavailable. Please retry your message. No appointment was booked." }, 503);
  }
}
