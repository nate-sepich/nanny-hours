const START_HOUR = 7;    // grid starts at 7:00 AM
const END_HOUR = 19;     // grid ends at 7:00 PM
const SLOT_MIN = 30;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const NUM_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN;

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

const grid = document.getElementById('grid');
const legend = document.getElementById('legend');
const selIndicator = document.getElementById('sel-indicator');
const loadStatus = document.getElementById('load-status');
const saveStatus = document.getElementById('save-status');
const saveBtn = document.getElementById('save-cal');

let cells = blankCells();
let cellEls = [];
let selected = CATEGORIES[0].id; // 'erase' selects the eraser
let dirty = false;
let painting = false;

function blankCells() {
  return Array.from({ length: DAYS.length }, () => Array(NUM_SLOTS).fill(''));
}

function slotLabel(s) {
  const total = START_HOUR * 60 + s * SLOT_MIN;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function markDirty() {
  dirty = true;
}

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

// ---------- grid ----------
function render() {
  cellEls = Array.from({ length: DAYS.length }, () => []);
  const table = document.createElement('table');
  table.className = 'cal';

  const thead = document.createElement('thead');
  let htr = '<tr><th class="time-col"></th>';
  DAYS.forEach((d) => { htr += `<th>${d}</th>`; });
  htr += '</tr>';
  thead.innerHTML = htr;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (let s = 0; s < NUM_SLOTS; s++) {
    const tr = document.createElement('tr');
    const onHour = (START_HOUR * 60 + s * SLOT_MIN) % 60 === 0;
    if (onHour) tr.classList.add('hour-start');

    const timeTd = document.createElement('td');
    timeTd.className = 'time-label';
    timeTd.textContent = onHour ? slotLabel(s) : '';
    tr.appendChild(timeTd);

    for (let d = 0; d < DAYS.length; d++) {
      const td = document.createElement('td');
      td.className = 'slot';
      td.dataset.d = d;
      td.dataset.s = s;
      td.innerHTML = '<span class="slot-label"></span>';
      cellEls[d][s] = td;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  grid.innerHTML = '';
  grid.appendChild(table);

  for (let d = 0; d < DAYS.length; d++) {
    for (let s = 0; s < NUM_SLOTS; s++) updateCellVisual(d, s);
  }
}

function updateCellVisual(d, s) {
  if (s < 0 || s >= NUM_SLOTS) return;
  const el = cellEls[d][s];
  if (!el) return;
  const cat = cells[d][s];
  el.style.background = cat ? CAT_BY_ID[cat].color : '';
  el.classList.toggle('filled', !!cat);
  const above = s > 0 ? cells[d][s - 1] : '';
  const topOfRun = cat && cat !== above;
  el.querySelector('.slot-label').textContent = topOfRun ? CAT_BY_ID[cat].label : '';
}

function paint(el) {
  const d = Number(el.dataset.d);
  const s = Number(el.dataset.s);
  const next = selected === 'erase' ? '' : selected;
  if (cells[d][s] === next) return;
  cells[d][s] = next;
  updateCellVisual(d, s);
  updateCellVisual(d, s + 1); // run label of the cell below may change
  markDirty();
}

grid.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.slot');
  if (!el) return;
  painting = true;
  paint(el);
  e.preventDefault();
});
grid.addEventListener('pointerover', (e) => {
  if (!painting) return;
  const el = e.target.closest('.slot');
  if (el) paint(el);
});
document.addEventListener('pointerup', () => { painting = false; });

// ---------- load / save ----------
async function loadSchedule() {
  loadStatus.textContent = 'Loading…';
  try {
    const { config } = await fetchData();
    cells = blankCells();
    if (config.Schedule) {
      try {
        const parsed = JSON.parse(config.Schedule);
        if (parsed && parsed.startHour === START_HOUR && parsed.slot === SLOT_MIN &&
            Array.isArray(parsed.cells)) {
          for (let d = 0; d < DAYS.length; d++) {
            for (let s = 0; s < NUM_SLOTS; s++) {
              const v = parsed.cells[d] && parsed.cells[d][s];
              if (v && CAT_BY_ID[v]) cells[d][s] = v;
            }
          }
        }
      } catch (err) { /* ignore malformed schedule */ }
    }
    render();
    dirty = false;
    loadStatus.textContent = '';
  } catch (e) {
    loadStatus.textContent = `Couldn't load: ${e.message}`;
  }
}

async function saveSchedule() {
  saveStatus.textContent = 'Saving…';
  saveStatus.className = 'status';
  saveBtn.disabled = true;
  const payload = JSON.stringify({
    startHour: START_HOUR, endHour: END_HOUR, slot: SLOT_MIN, cells
  });
  try {
    await postAction({ action: 'saveConfig', config: { Schedule: payload } });
    dirty = false;
    saveStatus.textContent = 'Saved ✓';
    saveStatus.className = 'status success';
  } catch (e) {
    saveStatus.textContent = e.message;
    saveStatus.className = 'status error';
  } finally {
    saveBtn.disabled = false;
  }
}

document.getElementById('clear-all').addEventListener('click', () => {
  if (!confirm('Clear the entire schedule?')) return;
  cells = blankCells();
  render();
  markDirty();
});
document.getElementById('print-cal').addEventListener('click', () => window.print());
saveBtn.addEventListener('click', saveSchedule);

window.addEventListener('beforeunload', (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

renderLegend();
updateSelIndicator();
render();
loadSchedule();
