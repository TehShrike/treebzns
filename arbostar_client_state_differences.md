# ArboStar client accept/reject states vs. this schema

How ArboStar's project-level (lead/estimate/work order) "accepted/rejected by the client"
states map onto the current schema, and what each mapping loses. Line-item states
(`client_optional`/`client_declined`) are out of scope here.

Sources: `arbostar_export/*.d.ts`, `scripts/arbostar/readme.md` (status tables),
`src/migration/0000-initial.sql`, `src/shared/arbostar/import_projects.ts`.

| ArboStar state | Level | Meaning | Current schema equivalent | What's lost |
|---|---|---|---|---|
| `Sent for approval` (2) | Estimate | Estimate emailed/delivered to client | `project.sent_for_client_approval = 1` | Nothing significant |
| `Pending approval` (3) | Estimate | Client has it, decision outstanding | Same boolean, `sent_for_client_approval = 1` | "Sent" vs "awaiting decision" indistinguishable |
| `Contact the client` (7) | Estimate | Needs a follow-up call | None | Follow-up state entirely; free text in `lead_details` at best |
| `Confirmed` (6) | Estimate | **Client accepted** | Implicit only: project advances past the estimate document (`needs_client_approval_to_move_on`) to work order | No explicit accepted fact or timestamp; `project_client_approval` (signature/verbal evidence) exists but has no `project_id` and is unused |
| `Declined` (4) | Estimate | **Client rejected** | Implicit only: `closed = 1` while still on the estimate document | Conflated with Expired/Thinking — can't tell an active "no" from silence |
| `Expired` (9) | Estimate | Offer lapsed | Same: `closed = 1` on estimate document | Expiry as a distinct outcome, despite `project_document.can_expire`/`expire_days` plumbing |
| `Thinking – No Follow Up Needed` (8) | Estimate | Client undecided, deliberately not chased | Same: `closed = 1` on estimate document | The "still deciding" nuance |
| `email_status` (accepted/delivered/opened/clicked/bounce) | Estimate | Delivery tracking of the sent estimate | Consumed by the import to set `sent_for_client_approval`, then discarded | Open/click/bounce signal |
| `No Go` (3) | Lead | Dead before estimating | Void document + `closed = 1` | Whether the client walked vs. the company declined the job |
| `lead_reason_status_id` (10 codes on No Go) | Lead | Why it died — client-side (*already hired someone else*, *not responding*, *doesn't want work anymore*) vs company-side (*out of area*, *spam*, *duplicate*, …) | None | All 10 reason codes; status name survives only as prose in `lead_details` |
| `Confirmed` (2) vs `Confirmed online` (1) | Work order | *How* the client confirmed | None — both just mean the project reached the work-order document | Acceptance channel |
| — (no ArboStar equivalent) | — | Signature vs. verbal approval, and who collected it | `project_client_approval.customer_signature` / `verbal_approval` / `added_by_employee_id` | Schema is richer here — but the table is orphaned (no `project_id`, no app code touches it) |

The pattern: ArboStar records accept/reject as explicit statuses with reasons and channel;
the schema expresses them only as side effects (which document the project is on + `closed`),
so every dead-at-estimate outcome collapses into one indistinguishable state, and acceptance
is inferred rather than recorded.
