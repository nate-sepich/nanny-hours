const grid = document.getElementById('grid');
const weekLabel = document.getElementById('week-label');
const loadStatus = document.getElementById('load-status');
const saveStatus = document.getElementById('save-status');
const weekTotalEl = document.getElementById('week-total');
const weekTotalDecEl = document.getElementById('week-total-dec');
const saveBtn = document.getElementById('save-week');

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BREAK_CHOICES = [0, 15, 30, 45, 60, 90];
const DAYS_SHOWN = 5; // Mon–Fri; set to 7 to include the weekend

let weekStart = startOfWeek(new Date()); // Monday
let config = {};
let allEntries = []; // every entry from the sheet (used for "copy last week")
let model = []; // 7 day objects: { date, dateObj, rows: [rowObj] }
let hourlyRate = 0; // current hourly rate, captured from config on each load

// ---------- date helpers ----------
function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // back up to Monday
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function ymd(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
function weekRangeLabel() {
  const a = weekStart, b = addDays(weekStart, DAYS_SHOWN - 1);
  return `${MON[a.getMonth()]} ${a.getDate()} – ${MON[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
}

// ---------- format helpers ----------
function computeHours(start, end, brk) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // overnight shift
  mins -= Number(brk || 0);
  return Math.max(0, mins / 60);
}
function fmtDur(h) {
  const m = Math.round(h * 60);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  if (hh && mm) return `${hh}h ${mm}m`;
  if (hh) return `${hh}h`;
  return `${mm}m`;
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function breakOptionsHtml(current) {
  const cur = Number(current) || 0;
  const vals = BREAK_CHOICES.slice();
  if (!vals.includes(cur)) vals.push(cur);
  vals.sort((a, b) => a - b);
  return vals.map((v) =>
    `<option value="${v}"${v === cur ? ' selected' : ''}>${v === 0 ? 'None' : v + 'm'}</option>`
  ).join('');
}

// ---------- model ----------
function blankRow() {
  return { id: null, startTime: '', endTime: '', breakMinutes: 0, notes: '', rate: '', _deleted: false, orig: null };
}
function rowKey(r) {
  return [r.startTime, r.endTime, r.breakMinutes, r.notes].join('|');
}
function rowFromEntry(e) {
  const r = {
    id: e.id,
    startTime: e.startTime || '',
    endTime: e.endTime || '',
    breakMinutes: Number(e.breakMinutes) || 0,
    notes: e.notes || '',
    rate: e.rate,
    _deleted: false,
    orig: null
  };
  r.orig = rowKey(r);
  return r;
}

function buildModel(entries) {
  model = [];
  for (let i = 0; i < DAYS_SHOWN; i++) {
    const dateObj = addDays(weekStart, i);
    const date = ymd(dateObj);
    const rows = entries.filter((e) => e.date === date).map(rowFromEntry);
    if (rows.length === 0) rows.push(blankRow());
    model.push({ date, dateObj, rows });
  }
}

function weekHasSavedEntries() {
  return model.some((day) => day.rows.some((r) => r.id));
}
function lastWeekHasEntries() {
  const prevStart = addDays(weekStart, -7);
  const dates = [];
  for (let i = 0; i < DAYS_SHOWN; i++) dates.push(ymd(addDays(prevStart, i)));
  return allEntries.some((e) => dates.indexOf(e.date) !== -1);
}

// ---------- render ----------
function render() {
  weekLabel.textContent = weekRangeLabel();
  grid.innerHTML = '';

  if (!weekHasSavedEntries() && lastWeekHasEntries()) {
    const banner = document.createElement('button');
    banner.className = 'copy-banner';
    banner.textContent = '↻ Copy last week’s shifts into this week';
    banner.addEventListener('click', copyLastWeek);
    grid.appendChild(banner);
  }

  model.forEach((day, di) => {
    const isToday = day.date === ymd(new Date());
    const card = document.createElement('div');
    card.className = 'day-card' + (isToday ? ' is-today' : '');

    const head = document.createElement('div');
    head.className = 'day-head';
    head.innerHTML =
      `<div class="day-name"><span class="dow">${DOW[day.dateObj.getDay()]}</span>` +
      `<span class="day-date">${MON[day.dateObj.getMonth()]} ${day.dateObj.getDate()}</span></div>` +
      `<div class="day-total" data-daytotal="${di}">—</div>`;
    card.appendChild(head);

    const body = document.createElement('div');
    body.className = 'day-body';
    day.rows.forEach((r, ri) => {
      if (r._deleted) return;
      body.appendChild(renderRow(di, ri, r));
    });

    const add = document.createElement('button');
    add.className = 'add-shift';
    add.textContent = '+ Add shift';
    add.addEventListener('click', () => {
      day.rows.push(blankRow());
      render();
    });
    body.appendChild(add);

    card.appendChild(body);
    grid.appendChild(card);
  });

  recalc();
}

function renderRow(di, ri, r) {
  const row = document.createElement('div');
  row.className = 'shift-row';
  row.dataset.di = di;
  row.dataset.ri = ri;
  row.innerHTML =
    `<div class="times">` +
      `<label class="fld"><span>Start</span><input type="time" value="${r.startTime}" data-f="startTime"></label>` +
      `<span class="dash">→</span>` +
      `<label class="fld"><span>End</span><input type="time" value="${r.endTime}" data-f="endTime"></label>` +
    `</div>` +
    `<label class="fld brk"><span>Break</span><select data-f="breakMinutes">${breakOptionsHtml(r.breakMinutes)}</select></label>` +
    `<label class="fld notes"><span>Notes</span><input type="text" value="${escapeHtml(r.notes)}" data-f="notes" placeholder="optional"></label>` +
    `<div class="row-hours" data-rowhours>—</div>` +
    `<div class="row-actions">` +
      `<button class="icon-btn dup" title="Duplicate shift" aria-label="Duplicate shift">⧉</button>` +
      `<button class="icon-btn remove" title="Remove shift" aria-label="Remove shift">✕</button>` +
    `</div>` +
    `<div class="row-warn" data-warn hidden>This shift adds up to 0 hours — check the start, end, and break.</div>`;

  row.querySelectorAll('input, select').forEach((inp) => {
    inp.addEventListener('input', () => {
      const f = inp.dataset.f;
      r[f] = f === 'breakMinutes' ? Number(inp.value || 0) : inp.value;
      recalc();
    });
  });

  row.querySelector('.dup').addEventListener('click', () => {
    const copy = blankRow();
    copy.startTime = r.startTime;
    copy.endTime = r.endTime;
    copy.breakMinutes = r.breakMinutes;
    copy.notes = r.notes;
    model[di].rows.splice(ri + 1, 0, copy);
    render();
  });

  row.querySelector('.remove').addEventListener('click', () => {
    if (r.id) {
      r._deleted = true; // existing entry — delete on save
    } else {
      model[di].rows.splice(ri, 1); // brand-new blank — just drop it
      if (model[di].rows.length === 0) model[di].rows.push(blankRow());
    }
    render();
  });

  return row;
}

function recalc() {
  let weekTotal = 0;
  model.forEach((day, di) => {
    let dayTotal = 0;
    day.rows.forEach((r, ri) => {
      if (r._deleted) return;
      const hasTimes = r.startTime && r.endTime;
      const h = computeHours(r.startTime, r.endTime, r.breakMinutes);
      dayTotal += h;
      const rowEl = grid.querySelector(`.shift-row[data-di="${di}"][data-ri="${ri}"]`);
      if (!rowEl) return;
      rowEl.querySelector('[data-rowhours]').textContent = hasTimes ? fmtDur(h) : '—';
      const bad = hasTimes && h <= 0;
      rowEl.classList.toggle('invalid', bad);
      const warn = rowEl.querySelector('[data-warn]');
      if (warn) warn.hidden = !bad;
    });
    weekTotal += dayTotal;
    const dt = grid.querySelector(`[data-daytotal="${di}"]`);
    if (dt) dt.textContent = dayTotal > 0 ? fmtDur(dayTotal) : '—';
  });
  weekTotalEl.textContent = fmtDur(weekTotal);
  weekTotalDecEl.textContent = weekTotal > 0 ? `· ${weekTotal.toFixed(2)} hrs` : '';
}

// ---------- copy last week ----------
function copyLastWeek() {
  const prevStart = addDays(weekStart, -7);
  for (let i = 0; i < DAYS_SHOWN; i++) {
    const prevDate = ymd(addDays(prevStart, i));
    const prev = allEntries.filter((e) => e.date === prevDate);
    if (prev.length === 0) continue;
    // Only fill days that don't already have real entries.
    const hasReal = model[i].rows.some((r) => r.id);
    if (hasReal) continue;
    model[i].rows = prev.map((e) => {
      const r = rowFromEntry(e);
      r.id = null;   // new entries for this week
      r.orig = null;
      return r;
    });
  }
  render();
  saveStatus.textContent = 'Copied last week — review and Save.';
  saveStatus.className = 'status';
}

// ---------- load / save ----------
async function loadWeek() {
  loadStatus.textContent = 'Loading…';
  saveStatus.textContent = '';
  try {
    const data = await fetchData();
    config = data.config || {};
    hourlyRate = Number(config.HourlyRate) || 0;
    allEntries = data.entries || [];
    buildModel(allEntries);
    render();
    loadStatus.textContent = '';
  } catch (e) {
    loadStatus.textContent = `Couldn't load: ${e.message}`;
  }
}

function toEntry(date, r) {
  return {
    date,
    startTime: r.startTime,
    endTime: r.endTime,
    breakMinutes: Number(r.breakMinutes || 0),
    hours: Number(computeHours(r.startTime, r.endTime, r.breakMinutes).toFixed(2)),
    notes: r.notes || '',
    rate: (r.id ? (r.rate !== '' && r.rate != null ? Number(r.rate) : hourlyRate) : hourlyRate)
  };
}

function computeOps() {
  const ops = [];
  let error = null;
  model.forEach((day) => {
    day.rows.forEach((r) => {
      const hasTimes = r.startTime && r.endTime;
      if (hasTimes && computeHours(r.startTime, r.endTime, r.breakMinutes) <= 0) {
        error = `${DOW[day.dateObj.getDay()]} ${MON[day.dateObj.getMonth()]} ${day.dateObj.getDate()}: a shift adds up to 0 hours. Fix or remove it.`;
      }
      if (!r.id) {
        if (!r._deleted && hasTimes) ops.push({ op: 'add', entry: toEntry(day.date, r) });
      } else if (r._deleted) {
        ops.push({ op: 'delete', id: r.id });
      } else if (rowKey(r) !== r.orig) {
        if (hasTimes) ops.push({ op: 'update', id: r.id, entry: toEntry(day.date, r) });
        else ops.push({ op: 'delete', id: r.id });
      }
    });
  });
  return { ops, error };
}

function hasUnsavedChanges() {
  return computeOps().ops.length > 0;
}

async function saveWeek() {
  const { ops, error } = computeOps();
  if (error) {
    saveStatus.textContent = error;
    saveStatus.className = 'status error';
    return;
  }
  if (ops.length === 0) {
    saveStatus.textContent = 'No changes to save.';
    saveStatus.className = 'status';
    return;
  }
  saveStatus.textContent = 'Saving…';
  saveStatus.className = 'status';
  saveBtn.disabled = true;
  try {
    await postAction({ action: 'batch', pin: '', ops });
    await loadWeek();
    saveStatus.textContent = 'Saved ✓';
    saveStatus.className = 'status success';
  } catch (e) {
    saveStatus.textContent = e.message;
    saveStatus.className = 'status error';
  } finally {
    saveBtn.disabled = false;
  }
}

function navigate(delta) {
  if (hasUnsavedChanges() && !confirm('You have unsaved changes. Discard them?')) return;
  weekStart = delta === 0 ? startOfWeek(new Date()) : addDays(weekStart, delta);
  loadWeek();
}

document.getElementById('prev-week').addEventListener('click', () => navigate(-7));
document.getElementById('next-week').addEventListener('click', () => navigate(7));
document.getElementById('this-week').addEventListener('click', () => navigate(0));
saveBtn.addEventListener('click', saveWeek);

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

loadWeek();
