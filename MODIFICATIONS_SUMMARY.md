# ShareSpace AI — Modifications in this build

## Implemented
- Resource Discovery now prioritizes an exact resource-name match over generic keyword overlap. Empty queries are described as general-browse mode.
- Qualification evidence upload/review workflow is included. Admins can review submissions; providers can review only evidence from students who have requested their resources. Eligibility uses reviewer-approved records. This is manual demo review, not automatic issuer verification.
- A downloadable, clearly marked demo training certificate is available from the student qualifications page and at `/sample-demo-training-certificate.pdf`.
- Check-in and return forms offer demo before/after photos. Real image upload remains available.
- Return flow compares the two images using a lightweight browser-side pixel-difference heuristic, then sends the comparison summary to the backend. If a visible difference is flagged, an incident/report is created for provider review and appears in the Incidents page.
- Provider incident report includes both the image-comparison note and the return photo evidence.

## Important limitations
- Photo comparison is a basic pixel-difference heuristic, not a trained AI/computer-vision damage detector. Lighting, scale, and camera angle can affect it. A provider must inspect the evidence; the system does not assign blame.
- Certificate review is human review within this demo. It does not authenticate the issuing institution or prove a credential is genuine.
- Existing app capabilities are preserved where possible.

## Demo flow
1. Sign in as student (`student@demo.com` / `Demo123!`).
2. Request a 3D printer booking.
3. Sign in as provider (`provider@demo.com` / `Demo123!`) and approve the booking.
4. Sign in as student, check in, and select **Use demo before-use photo**.
5. Submit check-in; then return the resource and select **Use demo after-use photo**.
6. Sign in as provider and open **Incidents** to review the generated comparison report.
7. For certificate demo, open **My qualifications & training**, download/upload the sample certificate, then review it as admin (`admin@demo.com` / `Demo123!`).

All demo credentials are for local/demo use only. Change secrets and configure persistent storage before production deployment.

## Additional fixes in the final build
- Added an opt-in Smart Voice Guide panel to signed-in student/provider/admin pages. It speaks page-specific guidance and button-specific next steps using browser speech synthesis; it includes Start, Pause/Resume, and Mute/Stop controls. It does not click buttons or perform approvals on the user's behalf.
- Booking approval now re-checks the student's current administrator-reviewed qualifications at decision time instead of trusting only the eligibility snapshot created when the booking was submitted. If evidence is still unverified, the backend blocks approval with an actionable explanation. If a reviewer verified a matching qualification after booking submission, the fresh check can recognise it.
- Provider qualification listing uses an explicit ownership relationship to show qualifications belonging to students who have requested resources owned by that provider, including pending/rejected records, while preserving role-based access.

## Verification status
- Backend JavaScript syntax checks pass with `node --check`.
- Frontend production build could not be confirmed in this environment because dependency installation timed out. Run `npm run install:all` and `npm run build` locally before deployment.
- Voice output depends on browser speech-synthesis support and requires the user to enable it.
