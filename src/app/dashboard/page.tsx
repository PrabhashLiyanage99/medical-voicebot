import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminConfigured, isAdmin } from "@/lib/admin-auth";
import { calendarDate, clinicToday, isCalendarDate } from "@/lib/appointment-slots";
import { languages } from "@/lib/languages";
import { login, logout } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin appointments | Medical Voicebot", robots: { index: false, follow: false } };
const field = "rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white";
const button = "rounded-lg bg-cyan-400 px-5 py-2 font-semibold text-slate-950 hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300";

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (!(await isAdmin())) return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8">
        <Link href="/" className="text-cyan-300 underline">Back to home</Link>
        <p className="mt-8 text-sm uppercase tracking-widest text-cyan-400">Clinic administration</p>
        <h1 className="mt-2 text-3xl font-bold">Admin sign in</h1>
        <p className="my-4 text-slate-300">Sign in to view patient appointments.</p>
        {!adminConfigured() ? <p role="status">Set ADMIN_PASSWORD to at least 12 characters in the server’s .env file and restart the app.</p> : <form action={login} className="space-y-4">
          <label htmlFor="password" className="block">Admin password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} className={`${field} w-full`} />
          {params.error && <p role="alert" className="text-amber-300">{params.error === "limited" ? "Too many attempts. Wait one minute and try again." : "Incorrect password. Try again."}</p>}
          <button className={`${button} w-full`} type="submit">Sign in</button>
        </form>}
      </section>
    </main>
  );

  const date = typeof params.date === "string" ? params.date : "";
  const doctorId = typeof params.doctor === "string" && /^[1-9]\d{0,9}$/.test(params.doctor) ? Number(params.doctor) : undefined;
  const page = typeof params.page === "string" && /^[1-9]\d{0,5}$/.test(params.page) ? Number(params.page) : 1;
  const invalid = (date !== "" && !isCalendarDate(date)) || (params.doctor && (!doctorId || doctorId > 2147483647));
  const where = { ...(date && isCalendarDate(date) ? { date: calendarDate(date) } : {}), ...(doctorId && doctorId <= 2147483647 ? { doctorId } : {}) };
  const data = await (async () => {
    if (invalid) return null;
    try {
      const [appointments, count, todayCount, doctors] = await prisma.$transaction([
        prisma.appointment.findMany({ where, orderBy: [{ date: "desc" }, { time: "asc" }, { id: "desc" }], take: 25, skip: (page - 1) * 25,
          select: { id: true, date: true, time: true, status: true, patient: { select: { name: true, phone: true, language: true } }, doctor: { select: { name: true, specialization: true } } } }),
        prisma.appointment.count({ where }),
        prisma.appointment.count({ where: { date: calendarDate(clinicToday()) } }),
        prisma.doctor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      ]);
      return { appointments, count, todayCount, doctors };
    } catch { console.error("Admin appointment query failed"); return null; }
  })();
  const pageUrl = (value: number) => `/dashboard?${new URLSearchParams({ ...(date ? { date } : {}), ...(doctorId ? { doctor: String(doctorId) } : {}), page: String(value) })}`;
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm uppercase tracking-widest text-cyan-400">Clinic administration</p><h1 className="mt-2 text-4xl font-bold">Appointments</h1><p className="mt-2 text-slate-300">All appointment times are in Asia/Colombo.</p></div>
          <div className="flex items-center gap-4"><Link href="/" className="text-cyan-300 underline">Home</Link><form action={logout}><button type="submit" className={button}>Sign out</button></form></div>
        </header>
        {!data ? <div role="alert" className="rounded-xl border border-amber-600 p-6"><p>{invalid ? "Invalid filter. Select a valid date and doctor." : "Unable to load appointments. Check the database connection and try again."}</p><Link href="/dashboard" className="mt-4 inline-block text-cyan-300 underline">Reload dashboard</Link></div> : <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            {[['Matching appointments', data.count], ["Today's appointments", data.todayCount], ['Doctors', data.doctors.length]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-5"><p className="text-slate-300">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}
          </div>
          <form action="/dashboard" className="mb-6 flex flex-wrap items-end gap-4 rounded-xl bg-slate-900 p-5">
            <div><label htmlFor="date" className="mb-2 block">Appointment date</label><input id="date" name="date" type="date" defaultValue={date} className={field} /></div>
            <div><label htmlFor="doctor" className="mb-2 block">Doctor</label><select id="doctor" name="doctor" defaultValue={doctorId ?? ""} className={field}><option value="">All doctors</option>{data.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></div>
            <button className={button} type="submit">Apply filters</button><Link href="/dashboard" className="py-2 text-cyan-300 underline">Clear / refresh</Link>
          </form>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full text-left text-sm">
              <caption className="bg-slate-900 p-4 text-left text-slate-300">{data.count} appointments · Page {page} of {Math.max(1, Math.ceil(data.count / 25))}</caption>
              <thead className="bg-slate-800"><tr>{['Booking', 'Date / time', 'Patient', 'Phone', 'Language', 'Doctor', 'Status'].map((label) => <th scope="col" key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead>
              <tbody>{data.appointments.map((appointment) => <tr key={appointment.id} className="border-t border-slate-700 bg-slate-900">
                <td className="p-4">#{appointment.id}</td><td className="whitespace-nowrap p-4">{appointment.date.toISOString().slice(0, 10)}<br />{appointment.time}</td>
                <td className="p-4">{appointment.patient.name}</td><td className="whitespace-nowrap p-4">{appointment.patient.phone}</td><td className="p-4">{languages.find((language) => language.code === appointment.patient.language)?.name ?? appointment.patient.language}</td>
                <td className="p-4">{appointment.doctor.name}<span className="block text-xs text-slate-400">{appointment.doctor.specialization}</span></td><td className="p-4"><span className="rounded-full bg-slate-800 px-3 py-1 text-cyan-200">{appointment.status}</span></td>
              </tr>)}</tbody>
            </table>
            {!data.appointments.length && <p className="p-8 text-center text-slate-300">No appointments found. Try another filter or complete a booking on the voicebot page.</p>}
          </div>
          <nav aria-label="Appointment pages" className="mt-5 flex gap-5">{page > 1 && <Link href={pageUrl(page - 1)} className="text-cyan-300 underline">Previous</Link>}{page * 25 < data.count && <Link href={pageUrl(page + 1)} className="text-cyan-300 underline">Next</Link>}</nav>
        </>}
      </div>
    </main>
  );
}
