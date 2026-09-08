# Gemini conversation handling

Set `GEMINI_API_KEY` in the project-root `.env` on the server and restart Next.js. Do not use a `NEXT_PUBLIC_` prefix or put credentials into the page. `GEMINI_MODEL` is optional and defaults to `gemini-2.5-flash`; choose a model supporting structured output. Database credentials remain server-only too.

During Stage 5 verification, Google rejected the configured key with HTTP 400 and `API_KEY_INVALID`. Replace the key locally to enable live replies. Do not paste it into chat or commit it. `node scripts/check-gemini.mjs` checks connectivity with a synthetic prompt and prints only sanitized error metadata.

## Flow

`POST /api/chat` accepts:

```json
{
  "language": "en-US",
  "messages": [
    { "role": "user", "text": "Book Dr. Nimal Silva tomorrow at 09:00" }
  ]
}
```

Use one of the ten codes in `src/lib/languages.ts`. Include prior user and assistant messages for follow-up corrections. Only user/assistant roles are accepted; the last message must be from the user. Limits: 20 messages, 2,000 characters each, 24,000 characters for the JSON body. The UI retains a bounded recent history; use New Conversation for a fresh start.

1. Gemini extracts intent and nullable doctor/date/time/name/phone fields using structured JSON. The server supplies the current clinic date and actual doctor directory. No diagnosis, prescription, or doctor selection from symptoms is requested.
2. Zod validates model output. Server logic validates the doctor and date, queries actual schedules/bookings, and generates a fixed-purpose reply template. Medical questions get an appointment-only refusal; human requests report that no agent has been notified.
3. Gemini translates that server-authored template into the selected language. It never receives a database tool or authority to book. The chat endpoint makes no database writes.
4. The response includes `{ reply, draft, doctorName, slots, intent }`. A draft appears only for a complete valid and currently available appointment. The patient reviews it and clicks Confirm Appointment; the existing `/api/appointments` endpoint revalidates and uses its unique slot constraint. Confirmation appears only after that endpoint succeeds.

Provider errors, invalid/empty model output, and timeouts produce a generic 503 without provider payloads or secrets. The UI preserves unsent text for retry. A failed/ambiguous booking request discards the proposal and never retries automatically. Gemini replies are model-generated translations and should be reviewed by native speakers; speech coverage still depends on the device.

Conversation text, including any patient details entered, is sent to Gemini after submission. History is held in browser page memory, not localStorage or the Conversation database table. The server does not log message content or provider error bodies. Persistence and authenticated human-agent handoff remain for a later stage. Public deployment will need authentication/abuse controls appropriate to the clinic, especially for the provider-backed endpoint.

## Checks

- `npm run lint` and `npm run build`
- `node --conditions=react-server --import tsx scripts/test-chat.ts`: mocked Gemini, real PostgreSQL; verifies locale contracts, server validation, refusal/handoff templates, and no booking writes.
- Start the production server on port 3100, then run `node scripts/test-chat-browser.mjs` and `node scripts/test-speech.mjs`: headless Microsoft Edge with mocked responses for confirmation, failure/retry, and speech regression.
- With a valid key and tomorrow's seed schedules: `node scripts/test-chat-live.mjs`. Uses synthetic English/French messages and a medical refusal probe. No appointments are created, but provider usage may be billed.

The offline tests do not establish live extraction accuracy or translation quality. Live tests were blocked by the invalid configured key.

Provider integration follows [Google's structured-output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).
