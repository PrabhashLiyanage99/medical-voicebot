import { prisma } from "@/lib/prisma";
import { apiError, availabilityInput, json } from "@/lib/appointment-api";
import { calendarDate, CLINIC_TIMEZONE, scheduleSlots, SLOT_MINUTES, slotInstant } from "@/lib/appointment-slots";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const input = availabilityInput.safeParse({ doctorId: id, date: new URL(request.url).searchParams.get("date") });
  if (!input.success) return json({ message: "Invalid doctor ID or date. Use YYYY-MM-DD." }, 400);
  const { doctorId, date } = input.data;
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, name: true, specialization: true, schedules: { where: { date: calendarDate(date) } } },
    });
    if (!doctor) return json({ message: "Doctor not found." }, 404);
    // Every persisted appointment reserves its slot; cancellation is not implemented yet.
    const bookings = await prisma.appointment.findMany({ where: { doctorId, date: calendarDate(date) }, select: { time: true } });
    const reserved = new Set(bookings.map((booking) => booking.time));
    const now = Date.now();
    return json({
      doctor: { id: doctor.id, name: doctor.name, specialization: doctor.specialization },
      date, timezone: CLINIC_TIMEZONE, slotMinutes: SLOT_MINUTES,
      slots: scheduleSlots(doctor.schedules).filter((time) => !reserved.has(time) && slotInstant(date, time).getTime() > now),
    });
  } catch (error) { return apiError(error); }
}
