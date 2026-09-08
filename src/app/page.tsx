import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-cyan-400">
          Multilingual Healthcare Assistant
        </p>

        <h1 className="text-4xl font-bold md:text-6xl">
          Medical Appointment Voicebot
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          Book medical appointments with five doctors using your preferred
          language or request assistance from a human agent.
        </p>

        <div className="mt-10 flex gap-4">
          <Link
            href="/voicebot"
            className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950"
          >
            Start Voicebot
          </Link>

          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-600 px-6 py-3 font-semibold"
          >
            Human Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}