# ShareSpace AI — 5-hour Demo Readiness Checklist

## Hour 1 — Freeze and launch
- [ ] Extract this ZIP into a fresh folder.
- [ ] Run `npm run install:all` and then `npm run dev`.
- [ ] Check frontend and backend start without errors.
- [ ] Log in to all three demo roles.

## Hour 2 — Test core workflow
- [ ] Student searches resources by location/category.
- [ ] Student submits a booking request.
- [ ] Booking agent returns analysis and human-approval boundary.
- [ ] Provider sees pending request and records a reasoned decision.
- [ ] Student sees updated booking status/notification.

## Hour 3 — Test accountability
- [ ] Check-in with condition notes and optional photo.
- [ ] Return with condition notes and optional photo.
- [ ] Submit an incident report with optional evidence.
- [ ] Open Appeals & Reviews and test a supported appeal path.
- [ ] Check audit history and role permissions.

## Hour 4 — Prepare stable demo
- [ ] Use one preselected resource and known demo accounts.
- [ ] Ensure a valid booking is available for the planned handover steps.
- [ ] Keep a backup recording/screenshots in case Wi-Fi or hosting fails.
- [ ] Do not create unnecessary test data just before the pitch.

## Hour 5 — Rehearse and pitch
- [ ] Rehearse the 3-minute demo twice.
- [ ] Practice the 60-second pitch.
- [ ] Prepare answers about double bookings, fairness, privacy, agent fallback, and human approval.
- [ ] State limitations honestly; never claim untested AI vision, real certificate verification, or production security.

## Deployment checks
- [ ] Frontend API base URL points to the deployed backend.
- [ ] CORS and environment variables are correct.
- [ ] Persistent database storage is configured and tested across restart/redeploy.
- [ ] Do not use a temporary local SQLite file as a production database.
- [ ] Test the public URL from a second browser/device.
