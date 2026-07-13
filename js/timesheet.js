const grid = document.getElementById('grid');
const weekLabel = document.getElementById('week-label');
const loadStatus = document.getElementById('load-status');
const saveStatus = document.getElementById('save-status');
const weekTotalEl = document.getElementById('week-total');
const saveBtn = document.getElementById('save-week');

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let weekStart = startOfWeek(new Date()); // Sunday
let config = {};
let model = []; // 7 day objects: { date, dateObj, rows: [rowObj] }

// ---------- date helpers ----------
function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay()); // back up to Sunday
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
  const a = weekStart, b = addDays(weekStart, 6);
  const left = `${MON[a.getMonth()]} ${a.getDate()}`;
  const right = `${MON[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
  return `${left} – ${right}`;
}

// ---------- model ----------
function computeHours(start, end, brk) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // overnight shift
  mins -= Number(brk || 0);
  return Math.max(0, mins / 60);
}
function blankRow() {
  return { id: null, startTime: '', endTime: '', breakMinutes: 0, notes: '', _deleted: false, orig: null };
}
function rowKey(r) {
  return [r.startTime, r.endTime, r.breakMinutes, r.notes].join('|');
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildModel(entries) {
  model = [];
  for (let i = 0; i < 7; i++) {
    const dateObj = addDays(weekStart, i);
    const date = ymd(dateObj);
    const rows = entries
      .filter((e) => e.date === date)
      .map((e) => {
        const r = {
          id: e.id,
          startTime: e.startTime || '',
          endTime: e.endTime || '',
          breakMinutes: Number(e.breakMinutes) || 0,
          notes: e.notes || '',
          _deleted: false,
          orig: null
        };
        r.orig = rowKey(r);
        return r;
      });
    if (rows.length === 0) rows.push(blankRow());
    model.push({ date, dateObj, rows });
  }
}

// ---------- render ----------
function render() {
  weekLabel.textContent = weekRangeLabel();
  grid.innerHTML = '';

  model.forEach((day, di) => {
    const isToday = day.date === ymd(new Date());
    const card = document.createElement('div');
    card.className = 'day-card' + (isToday ? ' is-today' : '');

    const head = document.createElement('div');
    head.className = 'day-head';
    head.innerHTML =
      `<div class="day-name"><span class="dow">${DOW[day.dateObj.getDay()]}</span>` +
      `<span class="day-date">${MON[day.dateObj.getMonth()]} ${day.dateObj.getDate()}</span></div>` +
      `<div class="day-total"><span data-daytotal="${di}">0.00</span> hrs</div>`;
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
    `<label class="fld"><span>Start</span><input type="time" value="${r.startTime}" data-f="startTime"></label>` +
    `<label class="fld"><span>End</span><input type="time" value="${r.endTime}" data-f="endTime"></label>` +
    `<label class="fld brk"><span>Break (min)</span><input type="number" min="0" step="5" value="${r.breakMinutes}" data-f="breakMinutes"></label>` +
    `<label class="fld notes"><span>Notes</span><input type="text" value="${escapeHtml(r.notes)}" data-f="notes" placeholder="optional"></label>` +
    `<div class="row-hours"><span data-rowhours>0.00</span> hrs</div>` +
    `<button class="remove" title="Remove shift" aria-label="Remove shift">✕</button>`;

  row.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('input', () => {
      const f = inp.dataset.f;
      r[f] = f === 'breakMinutes' ? Number(inp.value || 0) : inp.value;
      recalc();
    });
  });

  row.querySelector('.remove').addEventListener('click', () => {
    if (r.id) {
      r._deleted = true; // existing entry — mark for deletion on save
    } else {
      model[di].rows.splice(ri, 1); // brand-new blank row — just drop it
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
      const h = computeHours(r.startTime, r.endTime, r.breakMinutes);
      dayTotal += h;
      const cell = grid.querySelector(`.shift-row[data-di="${di}"][data-ri="${ri}"] [data-rowhours]`);
      if (cell) cell.textContent = h.toFixed(2);
    });
    weekTotal += dayTotal;
    const dt = grid.querySelector(`[data-daytotal="${di}"]`);
    if (dt) dt.textContent = dayTotal.toFixed(2);
  });
  weekTotalEl.textContent = weekTotal.toFixed(2);
}

// ---------- load / save ----------
async function loadWeek() {
  loadStatus.textContent = 'Loading…';
  saveStatus.textContent = '';
  try {
    const data = await fetchData();
    config = data.config || {};
    buildModel(data.entries || []);
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
    notes: r.notes || ''
  };
}

function computeOps() {
  const ops = [];
  let error = null;
  model.forEach((day) => {
    day.rows.forEach((r) => {
      const hasTimes = r.startTime && r.endTime;
      if (hasTimes && computeHours(r.startTime, r.endTime, r.breakMinutes) <= 0) {
        error = `${day.date}: end time must be after start time.`;
      }
      if (!r.id) {
        if (!r._deleted && hasTimes) ops.push({ op: 'add', entry: toEntry(day.date, r) });
      } else if (r._deleted) {
        ops.push({ op: 'delete', id: r.id });
      } else if (rowKey(r) !== r.orig) {
        if (hasTimes) ops.push({ op: 'update', id: r.id, entry: toEntry(day.date, r) });
        else ops.push({ op: 'delete', id: r.id }); // cleared out an existing entry
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
