---
status: complete
phase: 03-admin-picker-identity-rich-display
source: [03-VERIFICATION.md]
started: 2026-04-25T02:42:00Z
updated: 2026-04-25T03:11:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Three pickers — UI-SPEC keyboard model + ARIA contract
expected: Log in as admin → /admin?tab=visibility → exercise ArrowDown/ArrowUp/Enter/Escape/Backspace on each picker (Dashboard Admins, GroupCard expanded, New Group form). ↓/↑ navigates dropdown without page scroll; Enter on highlighted row adds chip; Esc closes dropdown without losing focus; Backspace on empty input removes last chip; chip [×] removes specific entry; typing filters across name+email+division simultaneously.
result: issue
reported: "Yes I can drop down the admins in the dashboard admins, but its hard ot see it should open them all up or make the scroller bigger."
severity: minor
notes: |
  Dropdown is functional (keyboard + ARIA behavior works), but the visible list is cramped — user wants either all options expanded or a taller scroller. UI-SPEC currently caps list at max-h-72 (18rem ≈ 288px). Sizing/UX polish, not a correctness bug.

### 2. Refresh Prime Users button — full happy path
expected: Click "Refresh Prime Users" with a live Prime tenant. Idle → "Refreshing…" with spinner → success metadata "Refreshed N users in X.Xs · cached just now"; pickers update without page reload; on failure → amber "Prime unreachable…" line.
result: pass
evidence: "Refreshed 91 users in 2.8s · cached just now"

### 3. Manual-email fallback (D-12) under simulated outage
expected: DevTools → Network → block `/api/admin/prime-users` → reload `/admin?tab=visibility`. Each picker shows "Prime directory unavailable. Add an email manually:" + email input + "Add Email" button; valid email adds chip; invalid format shows "Invalid email format."
result: pass

### 4. VisibilityConfig blob round-trip — schema invariance
expected: Make changes, click Save Changes, observe Network tab POST body, reload, observe restored state. POST body has `admins: string[]` and `groups[].members: string[]` (NOT objects); reloaded data matches saved data; existing production blob loads without error.
result: pass

### 5. Audit cascade + prime_user_miss tooltip + CSV download
expected: /admin?tab=audit on real audit blob; hover prime_user_miss row; click Export CSV; open in spreadsheet. Live entries show Prime fullName line 1, email line 2; historical leavers fall back to entry.name then bare email; prime_user_miss tooltip shows entry.detail (or "No detail"); CSV header reads `Timestamp (AEDT),Email,Display Name,Action`; third column shows resolved display name.
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "PrimeUserPicker dropdown list is easily scannable — admin can see all/most options without cramped scrolling"
  status: resolved
  reason: "User reported: dropdown is hard to see, should open them all up or make the scroller bigger"
  severity: minor
  test: 1
  artifacts: [components/ui/PrimeUserPicker.tsx]
  missing: []
  fix: "Bumped listbox max-height from max-h-72 (288px, ~6 rows) → max-h-96 (384px, ~8 rows) in components/ui/PrimeUserPicker.tsx:274. 102/102 tests still green."
