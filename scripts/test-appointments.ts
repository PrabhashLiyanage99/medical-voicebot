import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "../src/generated/prisma/client";
import { calendarDate, clinicToday, scheduleSlots, slotInstant } from "../src/lib/appointment-slots";

const prisma = new PrismaClient();
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";

async function main() {
  assert.deepEqual(scheduleSlots([{ startTime: "09:00", endTime: "10:15" }, { startTime: "09:30", endTime: "10:00" }]), ["09:00", "09:30"]);
  assert.equal(slotInstant("2030-01-01", "09:00").toISOString(), "2030-01-01T03:30:00.000Z");
  const date = calendarDate(clinicToday());
  date.setUTCDate(date.getUTCDate() + 2);
  const day = date.toISOString().slice(0, 10);
  const doctor = await prisma.doctor.create({ data: { name: "API test fixture", specialization: "Test", schedules: { create: { date, startTime: "09:00", endTime: "10:00" } } } });
  const phone = `test-${doctor.id}`;
  const patientName = `API test patient ${phone}`;
  const input = { doctorId: doctor.id, date: day, time: "09:00", patient: { name: patientName, phone: "+94770000000", language: "si-LK" } };
  const post = (body: unknown) => fetch(`${base}/api/appointments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const availability = (queryDate = day, id = String(doctor.id)) => fetch(`${base}/api/doctors/${id}/availability?date=${queryDate}`);
  try {
    let response = await availability();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.deepEqual((await response.json()).slots, ["09:00", "09:30"]);
    assert.equal((await availability("2030-02-30")).status, 400);
    assert.equal((await availability(day, "invalid")).status, 400);
    assert.equal((await availability(day, "2147483647")).status, 404);
    assert.deepEqual((await (await availability("2000-01-01")).json()).slots, []);
    assert.equal((await post({ ...input, date: "2030-02-30" })).status, 400);
    assert.equal((await post({ ...input, time: "09:15" })).status, 400);
    assert.equal((await post({ ...input, time: "10:00" })).status, 400);
    assert.equal((await post({ ...input, date: "2000-01-01" })).status, 400);
    assert.equal((await post({ ...input, doctorId: 2147483647 })).status, 404);
    assert.equal((await post({ ...input, patient: { ...input.patient, language: "xx" } })).status, 400);
    assert.equal((await post({ ...input, patient: { ...input.patient, phone: "bad" } })).status, 400);
    assert.equal((await fetch(`${base}/api/appointments`, { method: "POST", body: "{" })).status, 400);
    const concurrent = await Promise.all([post(input), post(input)]);
    assert.deepEqual(concurrent.map((result) => result.status).sort(), [201, 409]);
    const booked = await concurrent.find((result) => result.status === 201)!.json();
    assert.equal(booked.appointment.date, day);
    assert.equal(booked.appointment.timezone, "Asia/Colombo");
    assert.equal(booked.appointment.status, "CONFIRMED");
    assert.equal(await prisma.appointment.count({ where: { doctorId: doctor.id } }), 1);
    assert.equal(await prisma.patient.count({ where: { name: patientName } }), 1);
    response = await availability();
    assert.deepEqual((await response.json()).slots, ["09:30"]);
    assert.equal((await post(input)).status, 409);
    console.log("PASS: availability, validation, timezone, simultaneous booking conflict, patient rollback, and booked-slot exclusion.");
  } finally {
    // Delete only records owned by this test's freshly created doctor/patient.
    await prisma.appointment.deleteMany({ where: { doctorId: doctor.id } });
    await prisma.patient.deleteMany({ where: { name: patientName } });
    await prisma.schedule.deleteMany({ where: { doctorId: doctor.id } });
    await prisma.doctor.delete({ where: { id: doctor.id } });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
