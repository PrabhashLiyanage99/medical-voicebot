import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { sampleDoctors } from "../src/lib/doctors";
import { calendarDate, clinicToday } from "../src/lib/appointment-slots";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    // Serialize seed runs because doctor names are not unique in the schema.
    await tx.$executeRaw`LOCK TABLE "Doctor" IN SHARE ROW EXCLUSIVE MODE`;
    let created = 0;
    for (const doctor of sampleDoctors) {
      const existing = await tx.doctor.findFirst({ where: doctor });
      if (!existing) {
        await tx.doctor.create({ data: doctor });
        created++;
      }
    }
    const doctors = await tx.doctor.findMany({
      where: { OR: sampleDoctors },
      select: { id: true, name: true, specialization: true },
      orderBy: { name: "asc" },
    });
    let schedulesCreated = 0;
    for (const doctor of doctors) {
      for (let day = 1; day <= 14; day++) {
        const date = calendarDate(clinicToday());
        date.setUTCDate(date.getUTCDate() + day);
        const schedule = { doctorId: doctor.id, date, startTime: "09:00", endTime: "12:00" };
        if (!(await tx.schedule.findFirst({ where: schedule }))) {
          await tx.schedule.create({ data: schedule });
          schedulesCreated++;
        }
      }
    }
    return { created, doctors, schedulesCreated, total: await tx.doctor.count() };
  }, { timeout: 15000 });
  console.table(result.doctors);
  console.log(`Seed complete: ${result.created} added; ${result.doctors.length} sample doctors found; ${result.total} doctors total.`);
  console.log(`Sample schedules added: ${result.schedulesCreated} (09:00–12:00 Asia/Colombo for the next 14 days).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
