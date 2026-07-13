const dateInput = document.getElementById('date');
const startInput = document.getElementById('start-time');
const endInput = document.getElementById('end-time');
const breakInput = document.getElementById('break-minutes');
const notesInput = document.getElementById('notes');
const pinInput = document.getElementById('pin');
const computedHoursEl = document.getElementById('computed-hours');
const formStatusEl = document.getElementById('form-status');
const entriesStatusEl = document.getElementById('entries-status');
const entriesTable = document.getElementById('entries-table');
const entriesBody = document.getElementById('entries-body');

dateInput.valueAsDate = new Date();

function computeHours() {
  if (!startInput.value || !endInput.value) return 0;
  const [sh, sm] = startInput.value.split(':').map(Number);
  const [eh, em] = endInput.value.split(':').map(Number);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60; // overnight shift
  minutes -= Number(breakInput.value || 0);
  return Math.max(0, minutes / 60);
}

function updateComputedHours() {
  computedHoursEl.textContent = computeHours().toFixed(2);
}

[startInput, endInput, breakInput].forEach((el) => el.addEventListener('input', updateComputedHours));

document.getElementById('entry-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const hours = computeHours();
  if (hours <= 0) {
    formStatusEl.textContent = 'End time must be after start time.';
    formStatusEl.className = 'status error';
    return;
  }

  formStatusEl.textContent = 'Submitting…';
  formStatusEl.className = 'status';

  try {
    await postAction({
      action: 'add',
      pin: pinInput.value,
      entry: {
        date: dateInput.value,
        startTime: startInput.value,
        endTime: endInput.value,
        breakMinutes: Number(breakInput.value || 0),
        hours: Number(hours.toFixed(2)),
        notes: notesInput.value
      }
    });
    formStatusEl.textContent = 'Hours submitted!';
    formStatusEl.className = 'status success';
    notesInput.value = '';
    pinInput.value = '';
    loadEntries();
  } catch (err) {
    formStatusEl.textContent = err.message;
    formStatusEl.className = 'status error';
  }
});

async function loadEntries() {
  try {
    const { entries } = await fetchData();
    const recent = entries
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 20);

    entriesBody.innerHTML = '';
    recent.forEach((entry) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${entry.date}</td>
        <td>${entry.startTime}–${entry.endTime}</td>
        <td class="num">${Number(entry.hours).toFixed(2)}</td>
        <td>${entry.notes || ''}</td>
        <td><button class="secondary" data-id="${entry.id}">Delete</button></td>
      `;
      entriesBody.appendChild(tr);
    });

    entriesBody.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this entry?')) return;
        const pin = prompt('PIN (leave blank if none set):') || '';
        try {
          await postAction({ action: 'delete', id: btn.dataset.id, pin });
          loadEntries();
        } catch (err) {
          alert(err.message);
        }
      });
    });

    entriesStatusEl.style.display = 'none';
    entriesTable.style.display = recent.length ? 'table' : 'none';
    if (!recent.length) {
      entriesStatusEl.style.display = 'block';
      entriesStatusEl.textContent = 'No entries yet.';
    }
  } catch (err) {
    entriesStatusEl.textContent = `Couldn't load entries: ${err.message}`;
  }
}

updateComputedHours();
loadEntries();
