const FIELDS = [
  'NannyName', 'NannyAddress', 'NannyPhone', 'NannyEmail',
  'EmployerName', 'EmployerAddress', 'EmployerPhone', 'EmployerEmail',
  'HourlyRate', 'AgreementText'
];

const DEFAULT_AGREEMENT =
  'Both parties confirm that the hours recorded above are accurate and complete ' +
  'for the pay period of {period}. Payment of ${total} ({hours} hours at ${rate}/hour) ' +
  'is due for childcare services provided during this period. Signing below indicates ' +
  'agreement that these hours and this amount are correct.';

const loadStatus = document.getElementById('load-status');
const saveStatus = document.getElementById('save-status');
const saveBtn = document.getElementById('save-details');

function el(field) {
  return document.getElementById('f-' + field);
}

async function loadDetails() {
  loadStatus.textContent = 'Loading…';
  try {
    const { config } = await fetchData();
    FIELDS.forEach((f) => {
      if (config[f] != null && config[f] !== '') el(f).value = config[f];
    });
    if (!el('AgreementText').value) el('AgreementText').value = DEFAULT_AGREEMENT;
    loadStatus.textContent = '';
  } catch (e) {
    loadStatus.textContent = `Couldn't load: ${e.message}`;
  }
}

async function saveDetails() {
  const obj = {};
  FIELDS.forEach((f) => { obj[f] = el(f).value; });
  saveStatus.textContent = 'Saving…';
  saveStatus.className = 'status';
  saveBtn.disabled = true;
  try {
    await postAction({ action: 'saveConfig', config: obj });
    saveStatus.textContent = 'Saved ✓';
    saveStatus.className = 'status success';
  } catch (e) {
    saveStatus.textContent = e.message;
    saveStatus.className = 'status error';
  } finally {
    saveBtn.disabled = false;
  }
}

saveBtn.addEventListener('click', saveDetails);
loadDetails();
