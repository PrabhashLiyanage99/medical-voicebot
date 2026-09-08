# Appointment APIs

All times are clinic-local `Asia/Colombo` (UTC+05:30). Dates use `YYYY-MM-DD`, times use 24-hour `HH:mm`, and slots last 30 minutes. The database date is normalized to UTC midnight as a calendar-date marker. Past slots are unavailable. Responses are not cached.

## Availability

`GET /api/doctors/1/availability?date=2026-09-10`

Returns `{ doctor: { id, name, specialization }, date, timezone, slotMinutes, slots: ["09:00", "09:30", ...] }`. Slots must fit completely inside a schedule. Overlapping schedules are deduplicated. No schedule or a past date returns an empty list. Invalid input returns 400; an unknown doctor returns 404.

## Booking

`POST /api/appointments` with `Content-Type: application/json`:

```json
{
  "doctorId": 1,
  "date": "2026-09-10",
  "time": "09:00",
  "patient": {
    "name": "Sample Patient",
    "phone": "+94771234567",
    "language": "en-US"
  }
}
```

Use an actual future scheduled date. Language codes: `en-US`, `si-LK`, `ta-LK`, `hi-IN`, `ar-SA`, `fr-FR`, `de-DE`, `es-ES`, `it-IT`, `zh-CN`.

Success returns 201 with `{ appointment: { id, doctorId, date, time, status, timezone } }`. Invalid input, past times, and unscheduled times return 400; unknown doctors return 404; reserved slots return 409; database failures return a generic 503. The server sets the status and does not accept patient IDs or status overrides.

Patient creation and booking are atomic. The existing database unique constraint on `(doctorId, date, time)` protects concurrent bookings. Each successful booking creates a patient record; phone numbers are not treated as verified identities. All existing appointment statuses reserve the slot. Cancellation and rescheduling are not implemented.

## Sample schedules and checks

`npx prisma db seed` adds any missing five sample doctors and 09:00–12:00 schedules for tomorrow through 14 days ahead. Repeating it on the same day adds no duplicates; existing records are preserved. No schema migration is needed for these APIs.

Run `npm run build`, then `npm run start -- --port 3100` in one terminal. In another, run `npx tsx scripts/test-appointments.ts`. The integration check creates an isolated doctor, exercises the real HTTP APIs and database, and removes its test records in a finally block. Set `TEST_BASE_URL` to use another local port.

These public patient endpoints do not expose appointment lists or patient records. They do not use Gemini or provide clinical advice. Public deployment still needs abuse controls; agent authentication belongs with the dashboard stage.
