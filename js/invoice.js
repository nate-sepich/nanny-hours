const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const generateBtn = document.getElementById('generate-btn');
const loadStatusEl = document.getElementById('load-status');
const invoiceCard = document.getElementById('invoice-card');
const invoiceBody = document.getElementById('invoice-body');

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
startDateInput.valueAsDate = firstOfMonth;
endDateInput.valueAsDate = today;

function formatMoney(n) {
  return n.toFixed(2);
}

async function generateInvoice() {
  loadStatusEl.textContent = 'Loading…';
  loadStatusEl.className = 'status';
  invoiceCard.style.display = 'none';

  try {
    const { entries, config } = await fetchData();
    const start = startDateInput.value;
    const end = endDateInput.value;

    const filtered = entries
      .filter((e) => e.date >= start && e.date <= end)
      .sort((a, b) => (a.date > b.date ? 1 : -1));

    if (!filtered.length) {
      loadStatusEl.textContent = 'No entries in that date range.';
      return;
    }

    const rate = Number(config.HourlyRate || 0);
    const totalHours = filtered.reduce((sum, e) => sum + Number(e.hours), 0);
    const totalPay = totalHours * rate;

    document.getElementById('employer-name').textContent = config.EmployerName || 'Invoice';
    document.getElementById('nanny-name').textContent = config.NannyName || '';
    document.getElementById('period-range').textContent = `${start} to ${end}`;

    invoiceBody.innerHTML = '';
    filtered.forEach((entry) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${entry.date}</td>
        <td>${entry.startTime}–${entry.endTime}</td>
        <td class="num">${Number(entry.hours).toFixed(2)}</td>
        <td>${entry.notes || ''}</td>
      `;
      invoiceBody.appendChild(tr);
    });

    document.getElementById('total-hours').textContent = totalHours.toFixed(2);
    document.getElementById('rate').textContent = formatMoney(rate);
    document.getElementById('total-pay').textContent = formatMoney(totalPay);

    loadStatusEl.textContent = '';
    invoiceCard.style.display = 'block';
  } catch (err) {
    loadStatusEl.textContent = `Couldn't load data: ${err.message}`;
    loadStatusEl.className = 'status error';
  }
}

generateBtn.addEventListener('click', generateInvoice);
document.getElementById('print-btn').addEventListener('click', () => window.print());

generateInvoice();
