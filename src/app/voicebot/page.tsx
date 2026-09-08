"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { languages } from "@/lib/languages";
import { greetings, matchingVoice, recognitionConstructor, recognitionError, type Recognition } from "@/lib/speech";
import type { ChatMessage, ChatResult } from "@/lib/chat-contract";

const subscribe = () => () => {};
const serverSnapshot = () => false;
const clientSnapshot = () => true;

export default function VoicebotPage() {
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const [language, setLanguage] = useState("en-US");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposal, setProposal] = useState<ChatResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const recognition = useRef<Recognition | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const canRecognize = ready && window.isSecureContext && Boolean(recognitionConstructor());
  const canSpeak = ready && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const greeting = greetings[language] ?? greetings["en-US"];
  const responseText = messages.findLast((message) => message.role === "assistant" && message.language === language)?.text ?? greeting;

  function cancelRecognition() {
    const active = recognition.current;
    recognition.current = null;
    if (active) {
      active.onstart = active.onresult = active.onerror = active.onend = null;
      active.abort();
    }
    setListening(false);
  }
  function cancelPlayback() {
    if (utterance.current) {
      utterance.current.onend = utterance.current.onerror = null;
      utterance.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }
  useEffect(() => {
    const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
    const update = () => setVoices(synth?.getVoices() ?? []);
    const timer = window.setTimeout(update, 0);
    synth?.addEventListener("voiceschanged", update);
    return () => {
      requestRef.current?.abort();
      window.clearTimeout(timer);
      synth?.removeEventListener("voiceschanged", update);
      const active = recognition.current;
      if (active) {
        active.onstart = active.onresult = active.onerror = active.onend = null;
        active.abort();
        recognition.current = null;
      }
      if (utterance.current) {
        utterance.current.onend = utterance.current.onerror = null;
        utterance.current = null;
      }
      synth?.cancel();
    };
  }, []);

  function startListening() {
    if (recognition.current) return;
    const Constructor = recognitionConstructor();
    if (!canRecognize || !Constructor) return;
    setProposal(null);
    cancelPlayback();
    const active = new Constructor();
    recognition.current = active;
    const original = draft.trim();
    let received = false;
    active.lang = language;
    active.continuous = false;
    active.interimResults = false;
    active.onstart = () => setStatus("Listening. Speak now, then review your message below.");
    active.onresult = (event) => {
      const text = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(" ").trim();
      if (text) {
        received = true;
        setDraft([original, text].filter(Boolean).join(" ").slice(0, 2000));
        setStatus("Speech captured. Review your message before submitting.");
      }
    };
    active.onerror = (event) => { setStatus(recognitionError(event.error)); cancelRecognition(); };
    active.onend = () => {
      recognition.current = null;
      setListening(false);
      if (!received) setStatus("No speech captured. Try again or type below.");
    };
    setListening(true);
    setStatus("Starting microphone…");
    try { active.start(); }
    catch { cancelRecognition(); setStatus("Could not start the microphone. Try again or type below."); }
  }
  function playResponse() {
    if (!canSpeak) return;
    cancelRecognition(); cancelPlayback();
    const speech = new SpeechSynthesisUtterance(responseText);
    speech.lang = language;
    speech.rate = 0.9;
    const voice = matchingVoice(window.speechSynthesis.getVoices(), language);
    if (voice) speech.voice = voice;
    speech.onend = () => { utterance.current = null; setSpeaking(false); };
    speech.onerror = () => { utterance.current = null; setSpeaking(false); setStatus("Audio playback failed. You can read the response on screen."); };
    utterance.current = speech;
    setSpeaking(true);
    setStatus("");
    try { window.speechSynthesis.speak(speech); }
    catch { cancelPlayback(); setStatus("Audio playback is unavailable. Please read the response on screen."); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || requestRef.current) return;
    cancelRecognition(); cancelPlayback();
    const next: ChatMessage[] = [...messages.slice(-18), { role: "user", text: draft.trim(), language }];
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 45000);
    setBusy(true); setProposal(null); setStatus("Getting a reply…");
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ language, messages: next.map(({ role, text }) => ({ role, text })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Conversation unavailable. Please try again.");
      setMessages([...next, { role: "assistant", text: result.reply, language }]);
      setProposal(result); setDraft(""); setStatus("");
    } catch (error) {
      if (requestRef.current === controller) setStatus(controller.signal.aborted ? "The reply timed out. Your message is still here; please retry." : error instanceof Error ? error.message : "Unable to send. Please try again.");
    } finally {
      window.clearTimeout(timer);
      if (requestRef.current === controller) { requestRef.current = null; setBusy(false); }
    }
  }
  async function confirmAppointment() {
    if (!proposal?.draft || requestRef.current) return;
    const booking = proposal.draft;
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 20000);
    setBusy(true); setStatus("Booking appointment…"); cancelPlayback(); cancelRecognition();
    try {
      const response = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(booking), signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Booking failed. Please check availability again.");
      setConfirmation(`Appointment #${result.appointment.id} confirmed: ${proposal.doctorName}, ${result.appointment.date} at ${result.appointment.time} (${result.appointment.timezone}).`);
      setMessages([]); setStatus("");
    } catch (error) {
      setStatus(error instanceof Error && error.name !== "AbortError" ? error.message : "Could not confirm the booking result. Contact the clinic before trying again; your request may have reached the server.");
    } finally {
      window.clearTimeout(timer); setProposal(null); requestRef.current = null; setBusy(false);
    }
  }
  const button = "rounded-xl px-5 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-cyan-400 underline">Back to home</Link>
        <header className="my-10 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-cyan-400">Healthcare Assistant</p>
          <h1 className="text-4xl font-bold md:text-5xl">Medical Appointment Voicebot</h1>
          <p className="mt-4 text-slate-300">Speak or type in your preferred language.</p>
        </header>
        <section className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl md:p-10" aria-label="Voice and text assistant">
          <label htmlFor="language" className="mb-2 block font-semibold">Select your preferred language</label>
          <select id="language" disabled={busy} value={language} onChange={(event) => {
            cancelRecognition(); cancelPlayback(); setLanguage(event.target.value); setProposal(null); setStatus("");
          }} className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3">
            {languages.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
          <div className="my-6 rounded-2xl bg-slate-800 p-6">
            <h2 className="mb-2 font-semibold text-cyan-400">Assistant</h2>
            <p lang={language} dir={language === "ar-SA" ? "rtl" : "auto"} className="text-lg">{responseText}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!canRecognize || busy} onClick={() => {
              if (listening) { cancelRecognition(); setStatus("Microphone stopped. You can type below."); }
              else startListening();
            }} aria-pressed={listening} className={`${button} bg-cyan-500 text-slate-950`}>{listening ? "Stop Listening" : "Start Speaking"}</button>
            <button type="button" disabled={!canSpeak} onClick={() => speaking ? cancelPlayback() : playResponse()} aria-pressed={speaking} className={`${button} border border-slate-600`}>{speaking ? "Stop Playback" : "Play Response"}</button>
          </div>
          {ready && !canRecognize && <p className="mt-4 text-amber-200">Speech recognition is unavailable in this browser or connection. Use the text input below.</p>}
          {ready && !canSpeak && <p className="mt-3 text-amber-200">Speech playback is unavailable. Responses remain visible as text.</p>}
          {canSpeak && !matchingVoice(voices, language) && <p className="mt-3 text-sm text-slate-300">No matching voice is currently listed for this language. Playback depends on your browser’s language support.</p>}
          <p className="mt-4 text-sm text-slate-400">Microphone access starts only when you press Start Speaking. Your browser may use an online speech service.</p>
          <form onSubmit={submit} className="mt-6">
            <label htmlFor="message" className="mb-2 block font-semibold">Your message</label>
            <textarea id="message" value={draft} onChange={(event) => { setDraft(event.target.value); setProposal(null); }} disabled={listening || busy} maxLength={2000} rows={4} lang={language} dir="auto" placeholder="Type here, or use Start Speaking…" className="w-full rounded-xl border border-slate-600 bg-slate-800 p-4 focus:border-cyan-400 disabled:opacity-60" />
            <p className="mb-3 text-sm text-slate-400">Review or edit recognized speech before submitting. Maximum 2,000 characters.</p>
            <p className="mb-3 text-sm text-slate-400">Submitting sends your conversation to Gemini to understand appointment details. Appointments require a separate confirmation below.</p>
            <button type="submit" disabled={busy || listening || !draft.trim()} className={`${button} bg-cyan-500 text-slate-950`}>{busy ? "Please wait…" : "Submit Message"}</button>
          </form>
          <p role="status" aria-live="polite" className="mt-4 min-h-12 text-cyan-200">{status}</p>
          {confirmation && <p role="status" className="mt-4 rounded-xl border border-green-500 p-4 text-green-200">{confirmation}</p>}
          {proposal?.draft && <section aria-label="Review appointment" className="mt-4 rounded-xl border border-cyan-500 p-4">
            <h2 className="font-semibold">Review appointment</h2>
            <p>{proposal.doctorName} — {proposal.draft.date}, {proposal.draft.time} (Asia/Colombo)</p>
            <p>{proposal.draft.patient.name} · {proposal.draft.patient.phone}</p>
            <p className="my-2 text-sm">Nothing is booked yet. To correct details, send another message.</p>
            <button type="button" disabled={busy || listening} onClick={confirmAppointment} className={`${button} bg-cyan-500 text-slate-950`}>Confirm Appointment</button>
          </section>}
          {!!messages.length && <section aria-label="Conversation history" className="mt-6 space-y-3">
            {messages.map((message, index) => <div key={index} className="rounded-xl bg-slate-800 p-4"><h2 className="font-semibold">{message.role === "user" ? "You" : "Assistant"}</h2><p lang={message.language} dir="auto" className="whitespace-pre-wrap break-words">{message.text}</p></div>)}
          </section>}
          <button type="button" disabled={busy} onClick={() => { cancelPlayback(); cancelRecognition(); setMessages([]); setProposal(null); setDraft(""); setStatus(""); setConfirmation(null); }} className={`${button} mt-4 border border-slate-600`}>New Conversation</button>
          <button type="button" onClick={() => setStatus("Human-agent requests are not connected yet. Please contact the clinic directly for assistance.")} className={`${button} mt-6 bg-violet-600`}>Talk to Human</button>
        </section>
      </div>
    </main>
  );
}
