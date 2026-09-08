import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { languages } from "@/lib/languages";
import { isCalendarDate } from "@/lib/appointment-slots";

const date = z.string().refine(isCalendarDate, "Use a valid YYYY-MM-DD date");
export const availabilityInput = z.object({
  doctorId: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(2147483647)),
  date,
});
export const bookingInput = z.object({
  doctorId: z.number().int().positive().max(2147483647),
  date,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  patient: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(30).regex(/^\+?[\d ()-]+$/).refine((value) => {
      const length = value.replace(/\D/g, "").length;
      return length >= 7 && length <= 15;
    }, "Provide a phone number containing 7 to 15 digits"),
    language: z.string().refine((value) => languages.some((language) => language.code === value), "Unsupported language code"),
  }).strict(),
}).strict();

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) return json({ message: error.message }, error.status);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return json({ message: "This appointment slot is already booked. Please choose another slot." }, 409);
  }
  // Do not log request data, patient details, or connection strings.
  console.error("Appointment API failed", error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "INTERNAL_ERROR");
  return json({ message: "Unable to process your request. Please try again later." }, 503);
}
