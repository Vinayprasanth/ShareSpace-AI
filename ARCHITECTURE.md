# ShareSpace AI architecture

```text
React/Vite role portals
       | authenticated REST
       v
Express API + JWT/RBAC
       |-- Resource Discovery Agent -> locality gate -> query ranking
       |-- Booking Workflow Orchestrator
       |      |-- Eligibility & Safety Agent
       |      |-- Booking Analysis Agent
       |      |-- Fair Access Agent
       |      `-- Human provider approval gate
       |-- Return & Incident Agent -> review queue
       |-- Provider Operations Assistant -> scoped live DB metrics
       `-- Audit + notifications
       v
SQLite via sql.js (local demo; portable, no native C++ build)

Optional: OpenAI API is used only to explain deterministic outputs in plain language.
It does not change eligibility, scheduling, fairness, or approval decisions.
```

The backend remains authoritative for authentication, role permissions, locality filtering, booking constraints, and state transitions. Every agent workflow produces a structured trace. Provider approvals and incident resolution remain human-controlled.


## Priority 1 enhancements (updated build)
- Availability query endpoint checks overlap with approved and checked-in reservations. Booking creation and provider approval still enforce backend conflict checks.
- Pickup/return condition forms support optional small image evidence stored on the booking record.
- QR handover reference (`SS-HANDOVER-<bookingId>`) is displayed in the handover forms; it is an identification aid, not physical access control.
- FIFO waitlist notifications are emitted after cancellation; provider approval remains required.
- Return & Incident Agent triages new issue terms against initial and final condition notes and routes potential issues to human review.
