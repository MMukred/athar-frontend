# Athar — Volunteer, Committees, Meetings & Attendance Management

Athar is a bilingual (English / Arabic) volunteer management platform built for **أكاديمية أثر** (Athar Organization).

It helps volunteer committees manage:
- volunteer profiles and unique volunteer IDs (e.g. `ATH-00001`),
- committee leadership and gender-scoped committee views,
- meetings & events with attendance tracking via QR check-in,
- volunteer hours, evaluations, certificates and reports,
- public volunteer applications.

## Features

- **Volunteer IDs** — every volunteer gets a stable, unique human-readable code (`ATH-000xx`).
- **Self-service portal** — volunteers can edit their own name, email, phone / WhatsApp and skills; the linked auth account is kept in sync.
- **Attendance QR** — per-meeting QR (generated via `goqr.me`) links to `#attendance-scan/<meetingId>`; after re-login the volunteer is marked present, and admins can override with absent / late / excused.
- **Bulk attendance** — admins can mark remaining (non-scanned) volunteers present / absent.
- **Authentication / Authorization / Accounting (AAA)** — JWT auth, role + permission checks, committee-scoped leader views, audit logs for logins, profile edits, QR generation, attendance.

## Screenshots

Add screenshots here after capturing the UI:

```text
docs/screenshots/dashboard.png
docs/screenshots/portal.png
docs/screenshots/attendance-qr.png
docs/screenshots/committees.png
```

## Setup

Frontend:

```bash
git clone https://github.com/MMukred/athar-frontend.git
cd athar-frontend
# open index.html or run a static server, e.g. npx serve .
```

Backend:

```bash
git clone https://github.com/MMukred/Athar-Volunteer-management.git
cd Athar-Volunteer-management
cp .env.example .env
# set DATABASE_URL, JWT secrets, etc.
npm install
npx prisma migrate dev
npm run dev
```

Frontend API base URL can be overridden with `window._ATHAR_API_URL__`.

## Architecture

```text
Browser (this repo)
  └─ static SPA (index.html, js/, css/, assets/)
       │  REST calls (fetch)
       ▼
Backend (Athar-Volunteer-management)
  └─ Express + Prisma
       │  SQL
       ▼
Neon PostgreSQL
```

Key backend areas:
- `src/routes/auth.ts` — login / logout / session / password change
- `src/routes/portal.ts` — volunteer self-service profile + attendance check-in
- `src/routes/meetings.ts` — meetings, attendance roster, QR token
- `src/routes/volunteers.ts` — volunteer CRUD / import / export
- `src/routes/public.ts` — public applications (honeypot + consent)
- `src/middleware/auth.ts` — auth + permissions

### Security notes

- JWT access / refresh tokens.
- Role-based permissions server-side; committee leaders scoped to their committee.
- Audit logs for sensitive actions.
- National ID / residency numbers are treated as sensitive and are only surfaced to admin-grade permission contexts in the admin API.

### Privacy

- Public applications collect national ID / DOB / phone only with explicit consent (`consent` field).
- Honeypot field `website` hides spam bots.
