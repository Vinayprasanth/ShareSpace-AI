# ShareSpace AI — Resource Sharing Platform

A hackathon-ready, full-stack resource-sharing app with student/provider/admin roles, booking workflows, fair-access checks, QR handover references, pickup/return photo evidence, incident triage, audit history, and integrated deterministic AI-agent tools. It runs locally without a paid AI key or PostgreSQL installation.

## Stack
- React + Vite frontend
- Node.js + Express backend
- SQLite via `sql.js` (WebAssembly; no native C++ build tools required)
- Python FastAPI companion agent service (optional)
- JWT authentication + bcrypt password hashing

> **Database note:** The original architecture requested PostgreSQL. This runnable hackathon build uses SQLite by default to make local setup reliable and fast. The schema is relational and can be migrated to PostgreSQL for deployment. Do not use the demo JWT secret in production.

## Requirements
- Node.js 20+ recommended (Node.js 22 LTS is a good choice)
- npm
- Python 3.10+ only if you want to run the optional Python agent service

## Quick start
Open a terminal in the extracted `resource-sharing-platform` folder:

```bash
npm install
npm run install:all
```

The install command installs root, backend, and frontend dependencies. No Visual Studio C++ build tools are required. Copy `backend/.env.example` to `backend/.env`. You can leave the defaults for local demo, but change `JWT_SECRET` before deployment. Then run:

```bash
npm run dev
```

Open **http://localhost:5173**. The API runs at **http://localhost:4000/api**. Health check: `http://localhost:4000/api/health`.

### Windows PowerShell
```powershell
Copy-Item backend/.env.example backend/.env
npm install
npm run install:all
npm run dev
```

## Priority 1 workflow improvements

- **Availability API:** `GET /api/resources/:id/availability?startAt=<ISO>&endAt=<ISO>` checks confirmed booking overlaps and returns a clear availability result. Booking submission and provider approval also recheck conflicts.
- **Pickup and return evidence:** check-in and return forms accept an optional PNG/JPEG/WebP photo (max about 1.3 MB) alongside the written condition report. The evidence is stored on the booking record and is visible to authorised users in booking history.
- **QR handover reference:** check-in and return forms display a QR reference for the booking (`SS-HANDOVER-<id>`). This is a reference aid only; staff still confirm the handover in the authenticated app. The QR image is rendered by a public QR image service and sends only the generic booking reference, not user names or booking details. If that service is unavailable, the reference text remains visible.
- **Fair waiting-list updates:** cancelling a booking notifies the next FIFO waitlisted user and records the notification in the audit history. It does not auto-approve the next request; the provider retains control.
- **Return & Incident Agent update:** the rules-based agent compares issue terms in the initial and final condition notes, distinguishes previously recorded terms from newly mentioned terms, and flags evidence for human review. It does not determine fault or apply penalties.

### Deployment note

This remains a hackathon/demo build. The default `sql.js` database writes a local SQLite file; ephemeral hosting may lose data on restart/redeploy. For a durable public demo, configure persistent storage or migrate to a managed database before relying on saved bookings/photos. Photo evidence is stored in the database, so keep uploads small. The QR reference does not physically unlock equipment or prove identity.

## Demo accounts
All demo accounts use password **`Demo123!`**:
- Student: `student@demo.com`
- Provider: `provider@demo.com`
- Administrator: `admin@demo.com`

The database and sample resources are created automatically on first backend start. The SQLite file defaults to `backend/data/resource-sharing.db`.

## Optional Python agent service
The main application calls its integrated deterministic agents through the Node API, so Python is not required to use the website. To run the companion service separately:

```bash
cd ai-service
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`.

## Features
- Register/login and role-based dashboards
- Resource search and category filtering
- Provider resource listings
- AI-style discovery, eligibility, booking analysis, fair-access, incident, and provider-assistant agents
- Booking requests, provider decisions, waiting-list status, cancellations
- Check-in and return condition notes
- Incident reporting and provider/admin incident status management
- In-app notifications
- Audit history for major actions
- Sample data for a 3D printer, electronics bench, camera kit, meeting room, and oscilloscope

## Important demo behaviour
- Agents use deterministic, explainable rules so the project works without an LLM API key. The Python FastAPI service is an optional companion; the main website does not depend on it.
- Qualification checks are demo checks, not real-world credential verification. A provider must verify qualifications in a real deployment.
- The app records simulated check-in/check-out; it does not control real locks or verify physical identity.
- Incident analysis flags possible issues for human review. It does not automatically assign blame or impose penalties.
- Provider approval remains a human decision.
- For production, add rate limiting, secure cookie/session strategy, CSRF protection if using cookies, upload storage and scanning, formal migrations, tests, and a managed PostgreSQL database.

## Build frontend for production
```bash
npm --prefix frontend run build
```
The generated static site is in `frontend/dist`. Configure the production frontend API URL with `VITE_API_URL` before building. Deploy the API separately and set `CLIENT_ORIGIN` to your frontend origin.

## API overview
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/resources`, `POST /api/resources`, `PATCH /api/resources/:id`
- `POST /api/agents/:task`
- `POST /api/bookings`, `GET /api/bookings`, `PATCH /api/bookings/:id/decision`
- `POST /api/bookings/:id/checkin`, `POST /api/bookings/:id/return`
- `POST /api/bookings/:id/incidents`, `GET /api/incidents`, `PATCH /api/incidents/:id`
- `GET /api/notifications`, `GET /api/audit`, `GET /api/dashboard`

## Troubleshooting
- If port 4000 or 5173 is in use, change the backend `PORT` or start Vite with a different port.
- If `better-sqlite3` installation fails, install a supported Node.js LTS release and retry `npm install`.
- If the browser cannot reach the API, check that both services are running and that `VITE_API_URL` matches the backend address.

## Separate sign-in portals and logout

The sign-in screen has separate **Student**, **Provider**, and **Admin** portal tabs. Selecting a portal pre-fills its demo email; the backend-authenticated role must match the selected portal. Student/provider account creation uses the selected portal. Admin registration is disabled; use the seeded demo admin account.

The signed-in header now includes a visible **Sign out** button. The initials avatar is also a sign-out shortcut. Signing out clears the locally stored session token and returns to the same role's login portal.

## Agent workflows

The AI Agents page calls authenticated backend endpoints for resource discovery, eligibility/safety checks, booking analysis, fair-access recommendations, return/incident analysis, and the provider assistant. Rule-based checks run without an LLM key. Set `OPENAI_API_KEY` in `backend/.env` if you want optional LLM-written explanations; the LLM does not make booking approval or safety decisions.

## Local-area discovery
Student and provider registration now requires a **City / area** value (for example, `Indiranagar, Bengaluru`). Resource discovery is filtered on the backend to providers whose registered area/city overlaps with the signed-in user's registered area/city. Booking creation and direct resource-detail access also enforce the same-area rule, so changing the frontend alone cannot access a distant listing. The AI Resource Discovery Agent uses the same locality filter. Demo student and provider accounts are seeded in `Bengaluru, Karnataka`.

This demo uses the location entered at registration; it does **not** track live GPS coordinates. For production, add consent-based geolocation and a verified address/geocoding service if true radius-based distance is required.


## Publish a live hackathon demo (Render)

This repository includes `render.yaml` for a single-service deployment: Render builds the React frontend and serves it from the Express backend, so the public site and `/api` use the same origin.

1. Create a GitHub repository and upload/push the contents of this project folder (the folder containing `package.json` and `render.yaml`, not its parent folder).
2. Sign in to Render and choose **New → Blueprint**, then connect that GitHub repository.
3. Render reads `render.yaml`; review the service and choose **Apply**. The build command installs dependencies and builds the frontend.
4. When deployment completes, open the `https://...onrender.com` URL shown by Render. Test `/api/health` on that same host.
5. Use the demo credentials listed above.

**Live-demo limitations:** Render's free web service can sleep when idle, so the first visit may take a little time to wake. Its filesystem is ephemeral on the free plan; demo changes can be lost after a restart or redeploy. For a persistent public demo, use a persistent disk on a supported paid plan or migrate the database to a managed PostgreSQL service. Do not use the seeded demo credentials or this SQLite setup for production data.

The deployment configuration is prepared, but it does not publish a public URL by itself. Publishing requires your own GitHub and Render account and your approval of the deployment.

## Agent-centric workflow (hackathon demo)

The agents are not just decorative chat cards. They are called by authenticated API workflows and their structured outputs are saved or shown to the relevant user:

- **Resource Discovery Agent**: first applies the registered locality gate, then ranks available local resources against the student's query and returns match reasons.
- **Eligibility & Safety Agent**: compares resource requirements with the available profile/context, flags missing training proof, and routes uncertain cases to human verification.
- **Booking Analysis Agent**: validates time range, intended-use description, resource status, duration limit, overlapping confirmed bookings, and weekly request limit.
- **Fair Access Agent**: computes recent usage and waiting-list position, and explains the published usage/queue rule.
- **Return & Incident Agent**: analyses initial/final condition notes and flags possible issues for review; it never assigns blame automatically.
- **Provider Operations Assistant**: queries counts from the authenticated provider's own resources, pending requests, overdue bookings, and open incidents.
- **Booking Workflow Orchestrator**: combines eligibility, booking analysis, and fairness results into one recommendation and records the workflow in the audit log. The provider still makes the final approval decision.

The Agents page and booking analysis now show an **Agent execution trace**: each stage, status, findings, and the decision boundary. Deterministic rules run without a paid API key so the live demo remains reproducible. If `OPENAI_API_KEY` is configured, the LLM only rewrites the already-computed result into a clearer explanation; it cannot alter rule outcomes or approve a booking. This is an explainable multi-agent workflow using specialised agent tools, not six autonomous LLMs independently making consequential decisions.


## Explainable Decision & Appeal System (added)

- Students can request a human review from **Bookings** when a request is rejected or waitlisted. An appeal must include a reason (minimum 10 characters). Only one open appeal per booking is allowed.
- Providers can review appeals for their own resources; administrators can review all appeals. Review outcomes are `upheld`, `denied`, `under_review`, or `closed` and require an explanation.
- Appeal submission and review outcomes are written to the audit log, and the student receives an in-app notification when the review is updated.
- An appeal does **not** automatically change the booking decision. If the provider later changes a booking, they must use the normal booking workflow.
- The database creates an `appeals` table on startup for existing local databases.

## Damage Evidence Assistant (updated)

Incident reports can include an optional PNG/JPEG/WebP evidence photo (maximum 1.3 MB). The backend stores the attachment with the incident record, records whether evidence was attached in the audit history, and notifies the other party. The Incidents page displays the evidence photo and the assistant's review note. The current assistant organises the written report and condition notes; it does **not** perform computer-vision damage diagnosis or assign blame. A provider/admin must inspect the evidence and make the final decision. Existing databases are migrated on startup to add the incident evidence fields.

## Demo resource variety

The seeded demo inventory is intentionally not limited to a 3D printer. It includes a fabrication printer, electronics testing bench, mirrorless camera kit, project collaboration room, and digital oscilloscope. Keep the 3D printer as one example of a safety-gated resource, and use the other items to demonstrate sharing across different categories. Providers can add or edit resources through **My resources**.


### Login behavior (hackathon fix)
A fresh browser tab opens the sign-in page, not the student dashboard. Login sessions are tab-scoped (sessionStorage); old persistent `ss_token` values are cleared. Closing the tab ends the browser session. Sign out clears the active token. Demo credentials are displayed on the login screen but are not automatically submitted.


## Qualification evidence demo (new)

- Student portal: open **My qualifications**, enter the training title and issuer (optional), and upload a PDF/PNG/JPEG/WebP file up to about 1.3 MB.
- The record starts as **pending**. Admin portal: open **Qualification review**, open the attachment, then choose review/verify or reject and enter a reason. A decision creates an audit event and in-app notification.
- Only administrator-reviewed records with status `verified` are considered by the Eligibility & Safety Agent when the qualification title matches the resource requirement. Self-entered booking notes are not proof.
- `sample-demo-training-certificate.pdf` is deliberately marked **SAMPLE — NOT VALID**. Judges may upload it to test the UI and review workflow, but must label the record as demo-only. It does not prove real training and must never be used to access real equipment.
- This is an in-app demo review, not an external issuer verification service. Production use needs secure private file storage, access auditing, retention controls, and verification with the actual issuing institution.


## Demo certificate and before/after photo comparison

- Student accounts can open **My qualifications & training** and upload the included `sample-demo-training-certificate.pdf`. The sample is explicitly marked as a demo and is **not valid real-world evidence**. Use the title `3D Printing Safety Training — DEMO SAMPLE` to demonstrate review.
- Admins can review submissions. A provider can review a qualification only for a student who has requested one of that provider's resources. The eligibility agent uses reviewer-approved database records; this is manual demo review, not external issuer verification.
- For the photo workflow, approve a demo booking first. The student checks in and selects **Use demo before-use photo**, then submits check-in. When returning the resource, select **Use demo after-use photo** and submit return.
- The return flow computes a lightweight browser-side pixel-difference heuristic and attaches a report to the provider's **Incidents** page when a visual difference is flagged. It is not a trained computer-vision damage detector; lighting/camera angle can affect the result, and a provider must inspect the photos. It does not establish when damage happened or who is responsible.
- Resource Discovery now gives an exact resource-name match priority over generic keyword overlap. Empty searches are described as general-browse mode.

## Smart Voice Guide
After signing in, use the **AI Voice Guide** panel at the lower-right of the app. Select **Start voice guide** to hear guidance for the current page and spoken next steps after clicking app controls. **Pause/Resume** and **Mute / Stop** are available. The guide uses your browser's built-in text-to-speech and does not make decisions or click controls for you. If voice is unavailable, try a recent version of Chrome or Edge and allow audio playback.

## Qualification and booking approval behavior
Booking approval re-checks current administrator-reviewed qualification records. A note typed by a provider cannot substitute for missing training evidence. If a matching qualification is reviewed after a booking was created, refresh the booking page and run AI analysis again before deciding. This demo review is not external verification of the certificate issuer.
