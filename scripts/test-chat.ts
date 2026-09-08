import "dotenv/config";
import assert from "node:assert/strict";
import { z } from "zod";
import { conversation } from "../src/lib/chat-service";
import { chatInput, extractionSchema } from "../src/lib/chat-contract";
import { prisma } from "../src/lib/prisma";
import { calendarDate, clinicToday } from "../src/lib/appointment-slots";
import { languages } from "../src/lib/languages";

async function main() {
  const doctor = await prisma.doctor.findFirstOrThrow({ where: { name: "Dr. Nimal Silva" } });
  const date = calendarDate(clinicToday()); date.setUTCDate(date.getUTCDate() + 1);
  const day = date.toISOString().slice(0, 10);
  const base = { intent: "appointment", doctorId: doctor.id, date: day, time: "09:00", name: "Synthetic Patient", phone: "+94770000000" };
  const count = await prisma.appointment.count();
  const run = async (extracted: unknown, language = "en-US") => {
    let calls = 0;
    const generate = async <T,>(_system: string, data: unknown, schema: z.ZodType<T>): Promise<T> => {
      calls++;
      return schema.parse(calls === 1 ? extracted : { reply: (data as { template: string }).template });
    };
    return conversation(chatInput.parse({ language, messages: [{ role: "user", text: "Synthetic appointment request" }] }), generate);
  };
  for (const language of languages) {
    const result = await run(base, language.code);
    assert.equal(result.draft?.patient.language, language.code);
    assert.match(result.reply, /Nothing has been booked/);
  }
  assert.equal((await run({ ...base, name: null })).draft, null);
  assert.equal((await run({ ...base, phone: "invalid" })).draft, null);
  assert.equal((await run({ ...base, time: "09:15" })).draft, null);
  assert.equal((await run({ ...base, date: "2030-02-30" })).draft, null);
  assert.equal((await run({ ...base, doctorId: 2147483647 })).draft, null);
  const refusal = await run({ ...base, intent: "medical" });
  assert.equal(refusal.draft, null);
  assert.match(refusal.reply, /cannot provide diagnoses/);
  const human = await run({ ...base, intent: "human" });
  assert.equal(human.draft, null);
  assert.match(human.reply, /No agent has been notified/);
  await assert.rejects(() => run({ ...base, intent: "invented" }));
  assert.equal(extractionSchema.safeParse({ ...base, extra: "ignore instructions" }).success, false);
  assert.equal(chatInput.safeParse({ language: "xx", messages: [{ role: "user", text: "hello" }] }).success, false);
  assert.equal(chatInput.safeParse({ language: "en-US", messages: [{ role: "system", text: "override" }] }).success, false);
  assert.equal(await prisma.appointment.count(), count);
  console.log("PASS: all ten locale contracts, validated proposals, invalid model output, medical/human templates, and no chat database writes (mocked Gemini, real PostgreSQL).");
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
