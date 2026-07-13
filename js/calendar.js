const START_HOUR = 7;
const END_HOUR = 19;
const SLOT_MIN = 30;
const NUM_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SCHOOL_START = '2026-08-24'; // schedule not needed on/after this date

const CATEGORIES = [
  { id: 'active',   label: 'Active time',    color: '#e8683f' },
  { id: 'lunch',    label: 'Lunch',          color: '#e0a018' },
  { id: 'nap',      label: 'Nap / Rest',     color: '#6f5fa6' },
  { id: 'park',     label: 'Park',           color: '#3f9d4f' },
  { id: 'pool',     label: 'Pool',           color: '#1b9fd0' },
  { id: 'science',  label: 'Science Center', color: '#12a89a' },
  { id: 'zoo',      label: 'Zoo',            color: '#b5762e' },
  { id: 'outdoor',  label: 'Outdoor (home)', color: '#7aa63f' },
  { id: 'sensory',  label: 'Sensory play',   color: '#b455a6' },
  { id: 'arts',     label: 'Arts / Crafts',  color: '#d64d7d' },
  { id: 'workbook', label: 'Workbook time',  color: '#3767c4' },
  { id: 'cleanup',  label: 'Cleanup',        color: '#757a80' },
  { id: 'tv',       label: 'TV / Movie',     color: '#8a6a52' }
];
const CAT_BY_ID = {};
CATEGORIES.forEach((c) => { CAT_BY_ID[c.id] = c; });

// ---------- elements ----------
const grid = document.getElementById('grid');
const monthWrap = document.getElementById('month-wrap');
const legend = document.getElementById('legend');
const selIndicator = document.getElementById('sel-indicator');
const loadStatus = document.getElementById('load-status');
const saveStatus = document.getElementById('save-status');
const saveBtn = document.getElementById('save-cal');
const calLabel = document.getElementById('cal-label');
const prevBtn = document.getElementById('cal-prev');
const nextBtn = document.getElementById('cal-next');
const weekActions = document.getElementById('week-actions');
const weekBadge = document.getElementById('week-badge');
const savebar = document.getElementById('savebar');
const viewWeekBtn = document.getElementById('view-week');
const viewMonthBtn = document.getElementById('view-month');

// ---------- state ----------
let view = 'week';
let weekStart = startOfWeek(new Date());
let monthAnchor = firstOfMonth(new Date());
let schedulesByWeek = {}; // { 'YYYY-MM-DD': cells }
let template = null;       // default cells (from the recurring sample)
let currentCells = blankCells();
let cellEls = [];
let selected = CATEGORIES[0].id;
let dirty = false;
let painting = false;

const minWeekStart = startOfWeek(new Date());
// last schedulable week is the one before school starts
const maxWeekStart = startOfWeek(addDays(parseYMD(SCHOOL_START), -1));
const minMonth = firstOfMonth(new Date());
const maxMonth = firstOfMonth(parseYMD(SCHOOL_START));

// ---------- date helpers ----------
function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseYMD(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULLMON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function weekRangeLabel(ws) {
  const a = ws, b = addDays(ws, 4);
  return `${MON[a.getMonth()]} ${a.getDate()} – ${MON[b.getMonth()]} ${b.getDate()}`;
}
function slotLabel(s) {
  const total = START_HOUR * 60 + s * SLOT_MIN;
  const h = Math.floor(total / 60), m = total % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ---------- cells ----------
function blankCells() { return Array.from({ length: DAYS.length }, () => Array(NUM_SLOTS).fill('')); }
function cloneCells(c) { return c.map((row) => row.slice()); }
function weekCells(ws) {
  if (schedulesByWeek[ws]) return cloneCells(schedulesByWeek[ws]);
  if (template) return cloneCells(template);
  return blankCells();
}
function markDirty() { dirty = true; }
function isCustomized(ws) { return Object.prototype.hasOwnProperty.call(schedulesByWeek, ws); }

// ---------- legend ----------
function renderLegend() {
  legend.innerHTML = '';
  CATEGORIES.forEach((c) => {
    const chip = document.createElement('button');
    chip.className = 'legend-chip' + (selected === c.id ? ' active' : '');
    chip.innerHTML = `<span class="swatch" style="background:${c.color}"></span>${c.label}`;
    chip.addEventListener('click', () => { selected = c.id; renderLegend(); updateSelIndicator(); });
    legend.appendChild(chip);
  });
  const eraser = document.createElement('button');
  eraser.className = 'legend-chip eraser' + (selected === 'erase' ? ' active' : '');
  eraser.innerHTML = '<span class="swatch erase-swatch"></span>Erase';
  eraser.addEventListener('click', () => { selected = 'erase'; renderLegend(); updateSelIndicator(); });
  legend.appendChild(eraser);
}
function updateSelIndicator() {
  const label = selected === 'erase' ? 'Erase' : CAT_BY_ID[selected].label;
  selIndicator.innerHTML = `Painting: <strong>${label}</strong>`;
}

// ---------- week grid ----------
function renderWeek() {
  cellEls = Array.from({ length: DAYS.length }, () => []);
  const table = document.createElement('table');
  table.className = 'cal';

  const thead = document.createElement('thead');
  let htr = '<tr><th class="time-col"></th>';
  DAYS.forEach((d, i) => { htr += `<th>${d} <span class="th-date">${addDays(weekStart, i).getDate()}</span></th>`; });
  htr += '</tr>';
  thead.innerHTML = htr;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let s = 0; s < NUM_SLOTS; s++) {
    const tr = document.createElement('tr');
    if ((START_HOUR * 60 + s * SLOT_MIN) % 60 === 0) tr.classList.add('hour-start');
    const timeTd = document.createElement('td');
    timeTd.className = 'time-label';
    timeTd.textContent = (START_HOUR * 60 + s * SLOT_MIN) % 60 === 0 ? slotLabel(s) : '';
    tr.appendChild(timeTd);
    for (let d = 0; d < DAYS.length; d++) {
      const td = document.createElement('td');
      td.className = 'slot';
      td.dataset.d = d; td.dataset.s = s;
      td.innerHTML = '<span class="slot-label"></span>';
      cellEls[d][s] = td;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  grid.innerHTML = '';
  grid.appendChild(table);
  for (let d = 0; d < DAYS.length; d++) for (let s = 0; s < NUM_SLOTS; s++) updateCellVisual(d, s);

  const ws = ymd(weekStart);
  weekBadge.textContent = isCustomized(ws) ? 'Customized week' : 'Using default routine';
  weekBadge.className = 'week-badge' + (isCustomized(ws) ? ' custom' : '');
}

function updateCellVisual(d, s) {
  if (s < 0 || s >= NUM_SLOTS) return;
  const el = cellEls[d] && cellEls[d][s];
  if (!el) return;
  const cat = currentCells[d][s];
  el.style.background = cat ? CAT_BY_ID[cat].color : '';
  el.classList.toggle('filled', !!cat);
  const above = s > 0 ? currentCells[d][s - 1] : '';
  el.querySelector('.slot-label').textContent = (cat && cat !== above) ? CAT_BY_ID[cat].label : '';
}

function paint(el) {
  const d = Number(el.dataset.d), s = Number(el.dataset.s);
  const next = selected === 'erase' ? '' : selected;
  if (currentCells[d][s] === next) return;
  currentCells[d][s] = next;
  updateCellVisual(d, s);
  updateCellVisual(d, s + 1);
  markDirty();
}

grid.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.slot');
  if (!el) return;
  painting = true; paint(el); e.preventDefault();
});
grid.addEventListener('pointerover', (e) => {
  if (!painting) return;
  const el = e.target.closest('.slot');
  if (el) paint(el);
});
document.addEventListener('pointerup', () => { painting = false; });

// ---------- month view ----------
function renderMonth() {
  monthWrap.innerHTML = '';
  const y = monthAnchor.getFullYear(), m = monthAnchor.getMonth();
  // every week (Monday) whose Mon–Fri touches this month
  const lastDay = new Date(y, m + 1, 0);
  const rows = [];
  let ws = startOfWeek(new Date(y, m, 1));
  while (ws.getTime() <= lastDay.getTime()) {
    rows.push(new Date(ws));
    ws = addDays(ws, 7);
  }

  const headRow = document.createElement('div');
  headRow.className = 'month-head';
  DAYS.forEach((d) => { const c = document.createElement('div'); c.className = 'month-head-cell'; c.textContent = d; headRow.appendChild(c); });
  monthWrap.appendChild(headRow);

  rows.forEach((rowWs) => {
    const row = document.createElement('div');
    row.className = 'month-row';
    const cellsForWeek = weekCells(ymd(rowWs));
    for (let d = 0; d < DAYS.length; d++) {
      const date = addDays(rowWs, d);
      const cell = document.createElement('div');
      cell.className = 'month-day';
      const inMonth = date.getMonth() === m && date.getFullYear() === y;
      const beyond = date.getTime() >= parseYMD(SCHOOL_START).getTime();
      if (!inMonth) cell.classList.add('other-month');
      cell.innerHTML = `<div class="md-date">${date.getDate()}</div>`;
      const strip = document.createElement('div');
      strip.className = 'md-strip';
      for (let s = 0; s < NUM_SLOTS; s++) {
        const seg = document.createElement('div');
        seg.className = 'md-seg';
        const cat = cellsForWeek[d][s];
        if (cat) seg.style.background = CAT_BY_ID[cat].color;
        strip.appendChild(seg);
      }
      cell.appendChild(strip);
      if (isCustomized(ymd(rowWs))) cell.classList.add('md-custom');
      if (beyond) {
        cell.classList.add('md-beyond');
        cell.title = 'School has started';
      } else {
        cell.addEventListener('click', () => { switchToWeek(rowWs); });
      }
      row.appendChild(cell);
    }
    monthWrap.appendChild(row);
  });
}

// ---------- view + nav ----------
function confirmLeaveDirty() {
  return !dirty || confirm('You have unsaved changes to this week. Discard them?');
}

function applyView() {
  const isWeek = view === 'week';
  viewWeekBtn.classList.toggle('active', isWeek);
  viewMonthBtn.classList.toggle('active', !isWeek);
  grid.style.display = isWeek ? '' : 'none';
  monthWrap.style.display = isWeek ? 'none' : '';
  weekActions.style.display = isWeek ? '' : 'none';
  savebar.style.display = isWeek ? '' : 'none';
  document.body.style.paddingBottom = isWeek ? '' : '1rem';
  render();
}

function render() {
  if (view === 'week') {
    calLabel.textContent = weekRangeLabel(weekStart) + ', ' + weekStart.getFullYear();
    renderWeek();
    prevBtn.disabled = weekStart.getTime() <= minWeekStart.getTime();
    nextBtn.disabled = weekStart.getTime() >= maxWeekStart.getTime();
  } else {
    calLabel.textContent = FULLMON[monthAnchor.getMonth()] + ' ' + monthAnchor.getFullYear();
    renderMonth();
    prevBtn.disabled = monthAnchor.getTime() <= minMonth.getTime();
    nextBtn.disabled = monthAnchor.getTime() >= maxMonth.getTime();
  }
}

function loadWeekIntoEditor(ws) {
  weekStart = ws;
  currentCells = weekCells(ymd(ws));
  dirty = false;
}
function switchToWeek(ws) {
  if (!confirmLeaveDirty()) return;
  loadWeekIntoEditor(ws);
  view = 'week';
  applyView();
}

prevBtn.addEventListener('click', () => {
  if (view === 'week') {
    if (weekStart.getTime() <= minWeekStart.getTime()) return;
    if (!confirmLeaveDirty()) return;
    loadWeekIntoEditor(addDays(weekStart, -7));
  } else {
    monthAnchor = addMonths(monthAnchor, -1);
  }
  render();
});
nextBtn.addEventListener('click', () => {
  if (view === 'week') {
    if (weekStart.getTime() >= maxWeekStart.getTime()) return;
    if (!confirmLeaveDirty()) return;
    loadWeekIntoEditor(addDays(weekStart, 7));
  } else {
    monthAnchor = addMonths(monthAnchor, 1);
  }
  render();
});
document.getElementById('cal-today').addEventListener('click', () => {
  if (view === 'week') {
    if (!confirmLeaveDirty()) return;
    loadWeekIntoEditor(startOfWeek(new Date()));
  } else {
    monthAnchor = firstOfMonth(new Date());
  }
  render();
});
viewWeekBtn.addEventListener('click', () => { if (view === 'week') return; view = 'week'; applyView(); });
viewMonthBtn.addEventListener('click', () => {
  if (view === 'month') return;
  if (!confirmLeaveDirty()) return;
  monthAnchor = firstOfMonth(weekStart);
  if (monthAnchor.getTime() > maxMonth.getTime()) monthAnchor = new Date(maxMonth);
  if (monthAnchor.getTime() < minMonth.getTime()) monthAnchor = new Date(minMonth);
  view = 'month';
  applyView();
});

// ---------- week actions ----------
document.getElementById('copy-prev').addEventListener('click', () => {
  const prevWs = ymd(addDays(weekStart, -7));
  currentCells = schedulesByWeek[prevWs] ? cloneCells(schedulesByWeek[prevWs]) : (template ? cloneCells(template) : blankCells());
  markDirty(); renderWeek();
});
document.getElementById('reset-default').addEventListener('click', () => {
  currentCells = template ? cloneCells(template) : blankCells();
  markDirty(); renderWeek();
});
document.getElementById('clear-all').addEventListener('click', () => {
  if (!confirm('Clear this week?')) return;
  currentCells = blankCells(); markDirty(); renderWeek();
});
document.getElementById('print-cal').addEventListener('click', () => window.print());

// ---------- load / save ----------
async function loadAll() {
  loadStatus.textContent = 'Loading…';
  try {
    const { config } = await fetchData();
    schedulesByWeek = {};
    template = null;

    if (config.Schedule) {
      try {
        const t = JSON.parse(config.Schedule);
        if (t && t.startHour === START_HOUR && t.slot === SLOT_MIN && Array.isArray(t.cells)) {
          template = sanitizeCells(t.cells);
        }
      } catch (e) { /* ignore */ }
    }
    if (config.Schedules) {
      try {
        const parsed = JSON.parse(config.Schedules);
        if (parsed && parsed.startHour === START_HOUR && parsed.slot === SLOT_MIN && parsed.weeks) {
          Object.keys(parsed.weeks).forEach((ws) => {
            schedulesByWeek[ws] = sanitizeCells(parsed.weeks[ws]);
          });
        }
      } catch (e) { /* ignore */ }
    }

    loadWeekIntoEditor(weekStart);
    applyView();
    loadStatus.textContent = '';
  } catch (e) {
    loadStatus.textContent = `Couldn't load: ${e.message}`;
  }
}

function sanitizeCells(raw) {
  const out = blankCells();
  if (!Array.isArray(raw)) return out;
  for (let d = 0; d < DAYS.length; d++) {
    for (let s = 0; s < NUM_SLOTS; s++) {
      const v = raw[d] && raw[d][s];
      if (v && CAT_BY_ID[v]) out[d][s] = v;
    }
  }
  return out;
}

async function saveWeek() {
  saveStatus.textContent = 'Saving…';
  saveStatus.className = 'status';
  saveBtn.disabled = true;
  schedulesByWeek[ymd(weekStart)] = cloneCells(currentCells);
  const payload = JSON.stringify({ startHour: START_HOUR, endHour: END_HOUR, slot: SLOT_MIN, weeks: schedulesByWeek });
  try {
    await postAction({ action: 'saveConfig', config: { Schedules: payload } });
    dirty = false;
    saveStatus.textContent = 'Saved ✓';
    saveStatus.className = 'status success';
    renderWeek();
  } catch (e) {
    saveStatus.textContent = e.message;
    saveStatus.className = 'status error';
  } finally {
    saveBtn.disabled = false;
  }
}
saveBtn.addEventListener('click', saveWeek);

window.addEventListener('beforeunload', (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

renderLegend();
updateSelIndicator();
loadAll();
