# Student account follow-up requirements

The original Stage 4 used existing authenticated account fields and the dashboard, catalogue
and full-history endpoints only. No backend or authentication contracts changed.

Future functionality requires coordinated backend contracts before frontend work:

- Account correction/editing and password management: supported fields, validation,
  identity verification and authorization rules are needed. No new APIs are assumed.
- Department and other academic account metadata are not part of the
  authenticated user response; do not present institutional branding as verified
  personal enrollment data. Teacher enrollment is supplied separately as described below.
- Experiment-wise task completion percentages require authoritative task progress
  per attempt. Catalogue/history supply experiment completion states and scores,
  not partial task percentages.
- Direct lab resume links require session identifiers or an agreed lookup contract.
  Current progress actions open the existing experiment detail route.

Progress and history share the `{ attempts: [...] }` query response. Errors remain
visible rather than substituting the dashboard's five recent attempts for full history.


Local integration update: `GET /api/student/enrollment` now supplies the student's
own relationship and safe teacher information separately from `/auth/me`.
The public authenticated user shape remains unchanged. Stage 4A adds a read-only
teacher-enrollment section to Student Profile, with refresh/retry controls and
active, inactive, unassigned and unavailable-teacher states. It uses the separate
own-enrollment endpoint; it does not add assignment fields to `/auth/me`, allow
self-enrollment, or provide account editing. See `docs/student-enrollment.md`
and `docs/STAGE4A_ENROLLMENT_UI.md` for the contract and current acceptance.
