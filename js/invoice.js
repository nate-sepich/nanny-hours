const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const generateBtn = document.getElementById('generate-btn');
const loadStatusEl = document.getElementById('load-status');
const invoiceCard = document.getElementById('invoice-card');
const invoiceBody = document.getElementById('invoice-body');

const DEFAULT_AGREEMENT =
  'Both parties confirm that the hours recorded above are accurate and complete ' +
  'for the pay period of {period}. Payment of ${total} ({hours} hours at ${rate}/hour) ' +
  'is due for childcare services provided during this period. Signing below indicates ' +
  'agreement that these hours and this amount are correct.';

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
startDateInput.valueAsDate = firstOfMonth;
endDateInput.valueAsDate = today;

function money(n) {
  return n.toFixed(2);
}
function setText(id, value) {
  const el = document.getElementById(id);
  el.textContent = value || '';
  el.style.display = value ? '' : 'none';
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
    const periodLabel = `${start} to ${end}`;

    // Parties
    setText('nanny-name', config.NannyName);
    setText('nanny-address', config.NannyAddress);
    setText('nanny-phone', config.NannyPhone ? '📞 ' + config.NannyPhone : '');
    setText('nanny-email', config.NannyEmail);
    setText('employer-name', config.EmployerName);
    setText('employer-address', config.EmployerAddress);
    setText('employer-phone', config.EmployerPhone ? '📞 ' + config.EmployerPhone : '');
    setText('employer-email', config.EmployerEmail);
    setText('sig-nanny-name', config.NannyName);
    setText('sig-employer-name', config.EmployerName);
    document.getElementById('period-range').textContent = periodLabel;

    // Line items
    invoiceBody.innerHTML = '';
    filtered.forEach((entry) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td>${escapeHtml(entry.date)}</td>` +
        `<td>${escapeHtml(entry.startTime)}–${escapeHtml(entry.endTime)}</td>` +
        `<td class="num">${Number(entry.hours).toFixed(2)}</td>` +
        `<td>${escapeHtml(entry.notes)}</td>`;
      invoiceBody.appendChild(tr);
    });

    document.getElementById('total-hours').textContent = totalHours.toFixed(2);
    document.getElementById('rate').textContent = money(rate);
    document.getElementById('total-pay').textContent = money(totalPay);

    // Agreement statement with placeholders filled in
    const template = (config.AgreementText && config.AgreementText.trim()) || DEFAULT_AGREEMENT;
    const agreement = template
      .replace(/\{period\}/g, periodLabel)
      .replace(/\{hours\}/g, totalHours.toFixed(2))
      .replace(/\{rate\}/g, money(rate))
      .replace(/\{total\}/g, money(totalPay));
    document.getElementById('agreement-text').textContent = agreement;

    loadStatusEl.textContent = '';
    invoiceCard.style.display = 'block';
  } catch (e) {
    loadStatusEl.textContent = `Couldn't load data: ${e.message}`;
    loadStatusEl.className = 'status error';
  }
}

generateBtn.addEventListener('click', generateInvoice);
document.getElementById('print-btn').addEventListener('click', () => window.print());

generateInvoice();
