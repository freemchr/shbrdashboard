---
status: partial
phase: 03-admin-picker-identity-rich-display
source: [03-VERIFICATION.md]
started: 2026-04-25T02:42:00Z
updated: 2026-04-25T02:42:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Three pickers — UI-SPEC keyboard model + ARIA contract
expected: Log in as admin → /admin?tab=visibility → exercise ArrowDown/ArrowUp/Enter/Escape/Backspace on each picker (Dashboard Admins, GroupCard expanded, New Group form). ↓/↑ navigates dropdown without page scroll; Enter on highlighted row adds chip; Esc closes dropdown without losing focus; Backspace on empty input removes last chip; chip [×] removes specific entry; typing filters across name+email+division simultaneously.
result: [pending]

### 2. Refresh Prime Users button — full happy path
expected: Click "Refresh Prime Users" with a live Prime tenant. Idle → "Refreshing…" with spinner → success metadata "Refreshed N users in X.Xs · cached just now"; pickers update without page reload; on failure → amber "Prime unreachable…" line.
result: [pending]

### 3. Manual-email fallback (D-12) under simulated outage
expected: DevTools → Network → block `/api/admin/prime-users` → reload `/admin?tab=visibility`. Each picker shows "Prime directory unavailable. Add an email manually:" + email input + "Add Email" button; valid email adds chip; invalid format shows "Invalid email format."
result: [pending]

### 4. VisibilityConfig blob round-trip — schema invariance
expected: Make changes, click Save Changes, observe Network tab POST body, reload, observe restored state. POST body has `admins: string[]` and `groups[].members: string[]` (NOT objects); reloaded data matches saved data; existing production blob loads without error.
result: [pending]

### 5. Audit cascade + prime_user_miss tooltip + CSV download
expected: /admin?tab=audit on real audit blob; hover prime_user_miss row; click Export CSV; open in spreadsheet. Live entries show Prime fullName line 1, email line 2; historical leavers fall back to entry.name then bare email; prime_user_miss tooltip shows entry.detail (or "No detail"); CSV header reads `Timestamp (AEDT),Email,Display Name,Action`; third column shows resolved display name.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
