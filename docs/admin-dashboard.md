# Admin appointments

Open `/dashboard` and sign in with `ADMIN_PASSWORD` from the project's local `.env` file. Restart Next.js after changing the password. The setup script `node scripts/setup-admin.mjs` generates a random password if none exists and never prints it. Existing configured passwords are preserved; at least 12 characters are required.

The dashboard lists booking ID, date/time, patient name, phone, language, doctor/specialty, and status. Filter by appointment date and doctor, refresh with Clear / refresh, and browse 25 appointments per page. Dates are calendar dates and times are Asia/Colombo. It is read-only; it does not cancel appointments or process human handoffs.

All queries run on the server after authentication. Login uses an eight-hour signed HttpOnly, SameSite=Strict cookie (Secure in production). Changing the password invalidates all existing sessions. Sign out clears the current browser cookie. Five incorrect attempts per server process trigger a one-minute login cooldown. This is a single shared admin account for the local MVP; production multi-user administration should use individual accounts and shared rate limiting.

If PostgreSQL is unavailable, an error panel provides a reload link without exposing database errors. Missing/short admin configuration disables login. The page is dynamic and excluded from search indexing. No public patient-list API was added.

Verification: build and start on port 3100, then run `npx tsx scripts/test-admin.ts`. The test creates a synthetic appointment, exercises real login/filter/logout flows in headless Edge, and deletes only its own fixture records. Do not enable tracing of credential-filled forms.
