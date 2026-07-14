# Remaining work (handoff)

Backend (Code.gs) is fully hardened + DEPLOYED via clasp (@7): formula-injection
escape, LockService + try/catch, `saveSchedule` merge action, `Rate` column in
Entries, `setupBackup()`/`backupSheet_()` weekly backup. Frontend security fixes
(invoice XSS escape, doctype, noindex, unified cache v11) are done + pushed.

## Still TODO

### 1. Schedule rework (calendar.js / calendar.html / style.css) — the big one
- Grid window **9:00 AM–3:30 PM** (use minute-based bounds: START_MIN=540,
  END_MIN=930, SLOT=30 → 13 slots). Update slotLabel to START_MIN.
- Add categories **Reading** (`{id:'reading',label:'Reading / Quiet',color:'#4f8a8f'}`)
  and **Snack** (distinct warm color); rename `active` label to **"Free play"** (keep id `active`).
- **New default template** (13 slots, per-day outing baked into all 5 columns):
  9:00 Reading · 9:30 Workbook · 10:00–11:30 Outing (Mon Park/Tue Pool/Wed Science/Thu Zoo/Fri Park)
  · 11:30 Cleanup · 12:00 Lunch · 12:30–2:00 Nap · 2:00 Snack · 2:30 Arts · 3:00 Outdoor(home).
- **Per-day Lunch field**: row of 5 inputs (Mon–Fri) with a `<datalist>` of common
  meals (mac & cheese, spaghetti, PB&J, grilled cheese, quesadilla, chicken nuggets…).
  Per-week data model becomes `{cells, lunches:[5]}`.
- **Touch drag-paint fix**: on `pointerdown` release implicit capture; on `pointermove`
  use `document.elementFromPoint(e.clientX,e.clientY).closest('.slot')`; keep `touch-action:none`.
- **"Save as default" button** (writes `config.Schedule` = current week's `{cells,lunches}`).
- **Post-Aug-24 notice** when nav is at/after school start.
- **Switch save to backend `saveSchedule`** action `{weekStart, startHour, endHour, slot, week:{cells,lunches}}`
  (server merges under lock) instead of re-serializing the whole `schedulesByWeek` map.
- **Re-seed the new default**: after the 9–3:30 change, the old 7am `config.Schedule`
  is rejected by the startHour gate — POST a new `saveConfig {Schedule: <new 13-slot template>}`.

### 2. Per-shift rate (backend done; frontend left)
- timesheet.js: stamp `entry.rate = config.HourlyRate` on NEW shifts; PRESERVE existing
  `row.rate` on edits (don't overwrite). Include `rate` in `toEntry`.
- invoice.js: total = Σ hours × (entry.rate || config.HourlyRate); show single rate
  line only if uniform, else omit/annotate.

### 3. User actions (not code)
- **Set the PIN** in the Sheet Config tab (endpoint is currently OPEN).
- Run **`setupBackup()`** once in the Apps Script editor to enable weekly backups
  (approves Drive access).

## Deploy loop
- Backend: `./scripts/deploy-backend.sh` (redeploys same /exec URL).
- Frontend: bump `?v=` (currently v11) + `git push` → GitHub Pages.
