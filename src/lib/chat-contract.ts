import { z } from "zod";
import { languages } from "./languages";

export const chatInput = z.object({
  language: z.string().refine((code) => languages.some((language) => language.code === code)),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    text: z.string().trim().min(1).max(2000),
  }).strict()).min(1).max(20),
}).strict().refine((value) => value.messages.at(-1)?.role === "user", "The last message must be from the patient");

// The model's output is untrusted, and never authorizes a database write.
export const extractionSchema = z.object({
  intent: z.enum(["appointment", "medical", "human", "other"]),
  doctorId: z.number().int().positive().max(2147483647).nullable(),
  date: z.string().max(10).nullable(),
  time: z.string().max(5).nullable(),
  name: z.string().trim().max(120).nullable(),
  phone: z.string().trim().max(30).nullable(),
}).strict();
export type ChatMessage = { role: "user" | "assistant"; text: string; language: string };
export type BookingDraft = {
  doctorId: number;
  date: string;
  time: string;
  patient: { name: string; phone: string; language: string };
};
export type ChatResult = {
  reply: string;
  draft: BookingDraft | null;
  doctorName: string | null;
  slots: string[];
  intent: z.infer<typeof extractionSchema>["intent"];
};
