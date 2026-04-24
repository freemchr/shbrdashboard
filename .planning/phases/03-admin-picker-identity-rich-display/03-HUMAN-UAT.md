---
status: partial
phase: 03-admin-picker-identity-rich-display
source: [03-VERIFICATION.md]
started: 2026-04-24T22:10:00Z
updated: 2026-04-24T22:10:00Z
---

## Current Test

[awaiting browser smoke on a preview deploy — same model as Phase 2 UAT; Plan 03-04 Task 3 was auto-approved per workflow.auto_advance, this UAT captures what the auto-approval skipped]

## Tests

### 1. Picker dropdown — typeahead filter across name + email + division (ADMIN-01..04, D-03)
expected: `/admin` → Visibility tab → focus the Dashboard Admins search input (placeholder: "Search Prime users by name, email, or division…"). Type partial name → matching Prime users appear. Type partial email domain → same. Type partial division name → same. Each dropdown row shows: Prime display name (primary, white) + middle dot `·` (U+00B7) + division (gray, when present) + email below (smaller, gray). Filter is case-insensitive substring across all three fields simultaneously.
result: [pending]

### 2. Picker chip cluster — compact + hover tooltip + alphabetical (D-04, D-05)
expected: Add a few admins by clicking dropdown rows → chips appear above the search input, name-only with `×` to remove. Hover a chip → browser-native tooltip after ~500ms shows `{division} · {email}` (or `{email}` if division null). Chips render in alphabetical order by name; re-sorts on add/remove. Resize narrow → chips truncate at `max-w-[200px]`.
result: [pending]

### 3. Historical chip + inline refresh hint (D-08, D-10)
expected: Add a non-Prime email (or seed `config.admins` with `departed@example.com` directly) and reload `/admin`. The historical chip renders in italic + muted gray (`text-gray-500 italic`); hover tooltip: "Not in current directory snapshot — refresh to recheck" (em dash U+2014). Below the chip cluster, an inline hint appears: `⚠ 1 entry not found in current directory snapshot. Last refresh: X ago.` with a `[↻ Refresh Prime directory]` button. Click refresh → spinner + label `Refreshing…`; on success, if user is now in Prime the chip flips live.
result: [pending]

### 4. Audit log actor cascade (DISPLAY-03)
expected: `/admin` → Audit tab. Each row's actor cell renders cascade: PRIMARY = Prime display name (`text-gray-300 text-sm`, e.g. "Chris Freeman"); SECONDARY = email below in smaller gray (`text-gray-600 text-xs`). For an audit row whose email no longer resolves AND has no `entry.name`, only the email renders (no email/email duplication per D-12).
result: [pending]

### 5. Audit filter — Prime miss option works end-to-end (D-13)
expected: `/admin` → Audit tab → open the filter dropdown. Confirm "Prime miss" option present between "Login" and "Logout". Select it → table filters to only `prime_user_miss` rows (showing the amber Miss badge from Phase 2). Clear filter ("All") → all rows return.
result: [pending]

### 6. Picker keyboard navigation + accessibility
expected: Visibility tab → focus a picker → type → ArrowDown highlights row (with `bg-gray-700` background) without losing input focus → Enter adds chip + clears query → Escape closes dropdown → Backspace on empty input removes the last chip. Focus visible at all times.
result: [pending]

### 7. Empty / error state copy
expected: On a fresh/empty Prime cache (e.g. wipe the directory blob and reload), focus the picker — dropdown body shows EXACTLY: heading `Prime directory unavailable.` / body `Try refreshing.` / button `Refresh Prime directory` (with `↻` icon when not refreshing; `Refreshing…` when in-flight). Picker doesn't crash; admin can recover via the refresh.
result: [pending]

### 8. Save behavior + schema unchanged (D-23 / success criterion #5)
expected: Add/remove admins/group members via picker → click Save Changes → reload `/admin` in a different browser session → changes persist. Inspect the VisibilityConfig blob (via Vercel Blob dashboard or `/api/admin/visibility`) → schema is unchanged: `{ admins: string[], groups: [{...members: string[]...}], pages: [...] }`. NO new fields, no migration, no schema drift.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

(none — all items pending first browser smoke on preview)

## Notes

- Plan 03-04 Task 3 was AUTO-APPROVED in `--auto` mode per `workflow.auto_advance: true`. Auto-approval is a paper claim; this UAT file captures what the auto-approval skipped.
- All 12 code-level invariants for ADMIN-01..05 + DISPLAY-01..03 verified GREEN by gsd-verifier — see `03-VERIFICATION.md`.
- Code review (`03-REVIEW.md`) found 0 critical, 4 warnings (WR-01..04), 6 info. None blocking. Worth running `/gsd-code-review-fix 3` before merging the PR if you want them addressed (especially WR-01 case-sensitive dedupe — could cause silent duplicates if legacy mixed-case admin emails exist).
- Next step (after smoke): create branch `gsd/phase-3-admin-picker-identity-rich-display`, push, open PR, merge → prod auto-deploy.
- Resolution path: run `/gsd-verify-work 3` to walk through these items conversationally, OR perform the smoke on the preview deploy and edit each `result:` field directly.
