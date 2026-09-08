import { prisma } from "@/lib/prisma";
import { ApiError, apiError, bookingInput, json } from "@/lib/appointment-api";
import { calendarDate, CLINIC_TIMEZONE, scheduleSlots, slotInstant } from "@/lib/appointment-slots";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ message: "Request body must be valid JSON." }, 400); }
  const input = bookingInput.safeParse(body);
  if (!input.success) return json({ message: "Invalid booking details.", errors: input.error.issues.map(({ path, message }) => ({ field: path.join("."), message })) }, 400);
  const { doctorId, date, time, patient } = input.data;
  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const doctor = await tx.doctor.findUnique({ where: { id: doctorId }, select: { id: true } });
      if (!doctor) throw new ApiError(404, "Doctor not found.");
      if (slotInstant(date, time).getTime() <= Date.now()) throw new ApiError(400, "Appointments must be in the future.");
      const schedules = await tx.schedule.findMany({ where: { doctorId, date: calendarDate(date) } });
      if (!scheduleSlots(schedules).includes(time)) throw new ApiError(400, "This time is outside the doctor's available appointment slots.");
      // Nested creation rolls back the patient if the unique slot constraint fails.
      return tx.appointment.create({
        data: { doctor: { connect: { id: doctorId } }, date: calendarDate(date), time, patient: { create: patient } },
        select: { id: true, doctorId: true, time: true, status: true },
      });
    });
    return json({ appointment: { ...appointment, date, timezone: CLINIC_TIMEZONE } }, 201);
  } catch (error) { return apiError(error); }
}
