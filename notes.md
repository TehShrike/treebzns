# ArboStar import audit findings

From the 2026-07 audit of the import pipeline, checked against the real export data. Check items off as they're dealt with.

- [x] **(original finding)** `project.closed` conflated ArboStar payment state with this schema's "no more work to do" — now driven by work-completion signals only, and one-way on re-imports (can close, never reopens)
- [x] **(2, 3)** Optional/declined line items imported as real billable lines — now `project_line_item.client_optional` / `client_declined` (migration 0018); a Declined line is forced optional since only optional lines may be declined
- [x] **1. Dead work-order "Finished" check**: `import_projects.ts` matched `wo_status_id === 7` (the readme's status-*tab* id), but real rows use `wo_status_id: 0` with `status: 'Finished'` — the branch never fired. Now matches `status === 'Finished'`; readme warns that tab ids ≠ row ids (estimates too: rows use `4:Declined`, tab table says `-4`)
- [x] **4. `is_owner`**: now inserted `false` and removed from the update set (in-app permission, never touched by re-imports). Also decided alongside: only active (`active_status = 'yes'`) ArboStar users import — suspended/inactive ignored on every run — and uncorrelated users adopt existing employees by login/email identity match before falling back to name match, so a pre-created in-app account (e.g. Andrew's) links to its ArboStar user
- [ ] **5. `sent_for_client_approval` undercounts**: statuses `[2, 3]` miss sent-then-resolved estimates (881 have email activity while Confirmed/Declined/Expired). `email_status !== null` is the truthful "was sent" signal
- [ ] **6. Dead deals import as open Estimates**: 328 Declined + 21 Expired + 22 "Thinking – No Follow Up Needed" estimate-stage leads become open `needs_client_approval` projects (~40% of the Estimate queue). Decide: map estimate-Declined (Expired? Thinking?) → Void, or leave open
- [x] **7. Child deletions outrun flag-only parents**: contacts are now never deleted (flag-count only, like top-level entities); line-item deletion is kept (stale lines inflate totals) but scoped to projects present in the current run, so a lead missing from a partial export keeps its lines
- [ ] **8. `payment_project` reconciliation isn't split-safe**: assumes one row per payment, can't tell import-managed rows from app-created ones — once payments can split across projects, re-import clobbers. Needs a marker column (e.g. `arbostar_invoice_id` on payment_project)
- [ ] **9. Projects correlate by `number`, not an ArboStar id**: a company with pre-import in-app projects could have them clobbered when lead numbers collide. Add `project.arbostar_lead_id` and correlate on it
- [ ] 10a. Minor: invoice refunded back to `amount_paid = 0` leaves its stale payment row untouched (only flagged)
- [ ] 10b. Minor: `''` written where schema allows NULL (`client.primary_phone` / `primary_email` / `referred_by`, `client_address.address_line_2`)
- [ ] 10c. Minor: `needs_client_approval` / `sent_for_client_approval` are in the project update set, so in-app changes revert on re-import — candidates for the one-way/insert-only bucket like `closed`
- [ ] App-side follow-up (not import): nothing reads `client_optional` / `client_declined` yet — selection UI, and totals queries excluding declined lines
