const START_MIN = 540; // 9:00 AM
const END_MIN = 930;   // 3:30 PM
const SLOT_MIN = 30;
const NUM_SLOTS = (END_MIN - START_MIN) / SLOT_MIN; // 13
const START_HOUR = 9;      // for saveSchedule payload meta
const END_HOUR = 15.5;     // for saveSchedule payload meta
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SCHOOL_START = '2026-08-24'; // schedule not needed on/after this date

const CATEGORIES = [
  { id: 'active',   label: 'Free play',      color: '#e8683f' },
  { id: 'reading',  label: 'Reading / Quiet', color: '#4f8a8f' },
  { id: 'snack',    label: 'Snack',          color: '#e0925a' },
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

const LUNCH_OPTIONS = [
  'Mac & cheese', 'Spaghetti', 'PB&J', 'Grilled cheese', 'Quesadilla',
  'Chicken nuggets', 'Ravioli', 'Turkey sandwich', 'Yogurt & fruit', 'Soup'
];

// ---------- default template ----------
// Per-day cells (index 0 = 9:00): 13 slots. Outing (slots 2-4) varies by weekday.
const DEFAULT_OUTINGS = ['park', 'pool', 'science', 'zoo', 'park']; // Mon..Fri
const DEFAULT_LUNCHES = ['Mac & cheese', 'Spaghetti', 'PB&J', 'Quesadilla', 'Grilled cheese'];
function buildDefaultTemplate() {
  const cells = DAYS.map((_, d) => {
    const outing = DEFAULT_OUTINGS[d];
    return [
      'reading',  // 0  9:00
      'workbook', // 1  9:30
      outing,     // 2 10:00
      outing,     // 3 10:30
      outing,     // 4 11:00
      'cleanup',  // 5 11:30
      'lunch',    // 6 12:00
      'nap',      // 7 12:30
      'nap',      // 8  1:00
      'nap',      // 9  1:30
      'snack',    // 10 2:00
      'arts',     // 11 2:30
      'outdoor'   // 12 3:00
    ];
  });
  return { cells, lunches: DEFAULT_LUNCHES.slice() };
}
const DEFAULT_TEMPLATE = buildDefaultTemplate();

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
const lunchWrap = document.getElementById('lunch-wrap');
const postSchoolNotice = document.getElementById('post-school-notice');

// ---------- state ----------
let view = 'week';
let weekStart = startOfWeek(new Date());
let monthAnchor = firstOfMonth(new Date());
let schedulesByWeek = {}; // { 'YYYY-MM-DD': {cells, lunches} }
let template = null;       // {cells, lunches} default routine
let currentCells = blankCells();
let currentLunches = blankLunches();
let cellEls = [];
let lunchInputs = [];
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
  const total = START_MIN + s * SLOT_MIN;
  const h = Math.floor(total / 60), m = total % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ---------- cells ----------
function blankCells() { return Array.from({ length: DAYS.length }, () => Array(NUM_SLOTS).fill('')); }
function cloneCells(c) { return c.map((row) => row.slice()); }
function blankLunches() { return Array(DAYS.length).fill(''); }
function cloneLunches(l) { return l.slice(); }
function coerceLunches(raw) {
  const out = blankLunches();
  if (Array.isArray(raw)) {
    for (let d = 0; d < DAYS.length; d++) {
      const v = raw[d];
      out[d] = (typeof v === 'string') ? v : (v == null ? '' : String(v));
    }
  }
  return out;
}
function weekData(ws) {
  const src = schedulesByWeek[ws] || template || DEFAULT_TEMPLATE;
  return { cells: cloneCells(src.cells), lunches: cloneLunches(src.lunches) };
}
function markDirty() { dirty = true; }
function isCustomized(ws) { return Object.prototype.hasOwnProperty.call(schedulesByWeek, ws); }

// ---------- legend ----------
function renderLegend() {
  legend.innerHTML = '';
  CATEGORIES.forEach((c) => {
    const chip = document.createElement('button');
    chip.className = 'legend-chip' + (selected === c.id ? ' active' : '');
    chip.innerHTML = `<span class="swatch" style="background:${c.color}"></span>${escapeHtml(c.label)}`;
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
  selIndicator.innerHTML = `Painting: <strong>${escapeHtml(label)}</strong>`;
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
    if ((START_MIN + s * SLOT_MIN) % 60 === 0) tr.classList.add('hour-start');
    const timeTd = document.createElement('td');
    timeTd.className = 'time-label';
    timeTd.textContent = (START_MIN + s * SLOT_MIN) % 60 === 0 ? slotLabel(s) : '';
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

  renderLunchRow();

  const ws = ymd(weekStart);
  weekBadge.textContent = isCustomized(ws) ? 'Customized week' : 'Using default routine';
  weekBadge.className = 'week-badge' + (isCustomized(ws) ? ' custom' : '');
}

function renderLunchRow() {
  lunchInputs = [];
  lunchWrap.innerHTML = '';
  const label = document.createElement('div');
  label.className = 'lunch-label';
  label.textContent = 'Lunch';
  lunchWrap.appendChild(label);
  const row = document.createElement('div');
  row.className = 'lunch-row';
  const spacer = document.createElement('div');
  spacer.className = 'lunch-spacer';
  row.appendChild(spacer);
  for (let d = 0; d < DAYS.length; d++) {
    const cell = document.createElement('div');
    cell.className = 'lunch-cell';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'lunch-input';
    input.setAttribute('list', 'lunch-options');
    input.setAttribute('aria-label', DAYS[d] + ' lunch');
    input.placeholder = DAYS[d];
    input.value = currentLunches[d] || '';
    input.addEventListener('input', () => { currentLunches[d] = input.value; markDirty(); });
    lunchInputs[d] = input;
    cell.appendChild(input);
    row.appendChild(cell);
  }
  lunchWrap.appendChild(row);
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
  const el = e.target.closest && e.target.closest('.slot');
  if (!el) return;
  try { e.target.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  painting = true; paint(el); e.preventDefault();
});
grid.addEventListener('pointermove', (e) => {
  if (!painting) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const slot = el && el.closest && el.closest('.slot');
  if (slot) paint(slot);
});
document.addEventListener('pointerup', () => { painting = false; });

// ---------- month view ----------
function renderMonth() {
  monthWrap.innerHTML = '';
  const y = monthAnchor.getFullYear(), m = monthAnchor.getMonth();
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
    const cellsForWeek = weekData(ymd(rowWs)).cells;
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
  lunchWrap.style.display = isWeek ? '' : 'none';
  monthWrap.style.display = isWeek ? 'none' : '';
  weekActions.style.display = isWeek ? '' : 'none';
  savebar.style.display = isWeek ? '' : 'none';
  document.body.style.paddingBottom = isWeek ? '' : '1rem';
  render();
}

function updatePostSchoolNotice() {
  if (!postSchoolNotice) return;
  const atEnd = view === 'week' && weekStart.getTime() >= maxWeekStart.getTime();
  postSchoolNotice.style.display = atEnd ? '' : 'none';
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
  updatePostSchoolNotice();
}

function loadWeekIntoEditor(ws) {
  weekStart = ws;
  const wd = weekData(ymd(ws));
  currentCells = wd.cells;
  currentLunches = wd.lunches;
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
  const src = schedulesByWeek[prevWs] || template || DEFAULT_TEMPLATE;
  currentCells = cloneCells(src.cells);
  currentLunches = cloneLunches(src.lunches);
  markDirty(); renderWeek();
});
document.getElementById('reset-default').addEventListener('click', () => {
  const src = template || DEFAULT_TEMPLATE;
  currentCells = cloneCells(src.cells);
  currentLunches = cloneLunches(src.lunches);
  markDirty(); renderWeek();
});
document.getElementById('clear-all').addEventListener('click', () => {
  if (!confirm('Clear this week?')) return;
  currentCells = blankCells();
  currentLunches = blankLunches();
  markDirty(); renderWeek();
});
document.getElementById('print-cal').addEventListener('click', () => window.print());

document.getElementById('save-default').addEventListener('click', async () => {
  if (!confirm('Save this week as the default routine for all weeks?')) return;
  saveStatus.textContent = 'Saving default…';
  saveStatus.className = 'status';
  try {
    const payload = JSON.stringify({
      startHour: START_HOUR, endHour: END_HOUR, slot: SLOT_MIN,
      cells: currentCells, lunches: currentLunches
    });
    await postAction({ action: 'saveConfig', config: { Schedule: payload } });
    template = { cells: cloneCells(currentCells), lunches: cloneLunches(currentLunches) };
    saveStatus.textContent = 'Default saved ✓';
    saveStatus.className = 'status success';
    renderWeek();
  } catch (e) {
    saveStatus.textContent = e.message;
    saveStatus.className = 'status error';
  }
});

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
          template = { cells: sanitizeCells(t.cells), lunches: coerceLunches(t.lunches) };
        }
      } catch (e) { /* ignore */ }
    }
    if (!template) template = { cells: cloneCells(DEFAULT_TEMPLATE.cells), lunches: cloneLunches(DEFAULT_TEMPLATE.lunches) };

    if (config.Schedules) {
      try {
        const parsed = JSON.parse(config.Schedules);
        if (parsed && parsed.startHour === START_HOUR && parsed.slot === SLOT_MIN && parsed.weeks) {
          Object.keys(parsed.weeks).forEach((ws) => {
            schedulesByWeek[ws] = normalizeWeek(parsed.weeks[ws]);
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

function normalizeWeek(raw) {
  // Old format: a bare 2D array of cells. New format: {cells, lunches}.
  if (Array.isArray(raw)) {
    return { cells: sanitizeCells(raw), lunches: blankLunches() };
  }
  const cells = raw && raw.cells ? raw.cells : null;
  const lunches = raw && raw.lunches ? raw.lunches : null;
  return { cells: sanitizeCells(cells), lunches: coerceLunches(lunches) };
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
  try {
    await postAction({
      action: 'saveSchedule',
      weekStart: ymd(weekStart),
      startHour: START_HOUR,
      endHour: END_HOUR,
      slot: SLOT_MIN,
      week: { cells: currentCells, lunches: currentLunches }
    });
    schedulesByWeek[ymd(weekStart)] = { cells: cloneCells(currentCells), lunches: cloneLunches(currentLunches) };
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
