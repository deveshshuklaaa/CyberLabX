# Student account follow-up requirements

Stage 4 uses existing authenticated account fields and the dashboard, catalogue
and full-history endpoints only. No backend or authentication contracts changed.

Future functionality requires coordinated backend contracts before frontend work:

- Account correction/editing and password management: supported fields, validation,
  identity verification and authorization rules are needed. No new APIs are assumed.
- Enrollment, department and other academic account metadata are not part of the
  authenticated user response; do not present institutional branding as verified
  personal enrollment data.
- Experiment-wise task completion percentages require authoritative task progress
  per attempt. Catalogue/history supply experiment completion states and scores,
  not partial task percentages.
- Direct lab resume links require session identifiers or an agreed lookup contract.
  Current progress actions open the existing experiment detail route.

Progress and history share the `{ attempts: [...] }` query response. Errors remain
visible rather than substituting the dashboard's five recent attempts for full history.
