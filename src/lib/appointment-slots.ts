export const CLINIC_TIMEZONE = "Asia/Colombo";
export const SLOT_MINUTES = 30;

export function clinicToday(now = new Date()) {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

// Date columns represent calendar dates, stored at UTC midnight, not instants.
export function calendarDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = calendarDate(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function slotInstant(date: string, time: string) {
  return new Date(`${date}T${time}:00+05:30`);
}

export function scheduleSlots(schedules: { startTime: string; endTime: string }[]) {
  const slots = new Set<string>();
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  for (const schedule of schedules) {
    if (![schedule.startTime, schedule.endTime].every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))) continue;
    const end = minutes(schedule.endTime);
    for (let start = minutes(schedule.startTime); start + SLOT_MINUTES <= end; start += SLOT_MINUTES) {
      slots.add(`${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`);
    }
  }
  return [...slots].sort();
}
