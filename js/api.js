// Shared across all pages. Escape untrusted strings before inserting into HTML.
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const PIN_KEY = 'nannyHoursPin';

function getPin() {
  try { return localStorage.getItem(PIN_KEY) || ''; } catch (e) { return ''; }
}
function setPin(p) {
  try { localStorage.setItem(PIN_KEY, p || ''); } catch (e) { /* ignore */ }
}

// Shows a small unlock modal and resolves with the entered PIN.
function promptPin(wasWrong) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'pin-overlay';
    ov.innerHTML =
      '<div class="pin-modal">' +
      '<h2>Enter PIN</h2>' +
      '<p class="muted">' +
      (wasWrong ? 'That PIN was incorrect. Try again.' : 'This timesheet is protected. Enter the PIN to continue.') +
      '</p>' +
      '<input type="password" inputmode="numeric" class="pin-input" autocomplete="off" />' +
      '<button class="pin-unlock">Unlock</button>' +
      '</div>';
    document.body.appendChild(ov);
    const input = ov.querySelector('.pin-input');
    const btn = ov.querySelector('.pin-unlock');
    setTimeout(() => input.focus(), 50);
    function submit() {
      const v = input.value.trim();
      ov.remove();
      resolve(v);
    }
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  });
}

function needsPin(err) {
  return err === 'PIN required' || err === 'Incorrect PIN';
}

async function fetchData() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = APPS_SCRIPT_URL + '?pin=' + encodeURIComponent(getPin());
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load data');
    let data;
    try { data = await res.json(); }
    catch (e) { throw new Error('The server returned an unexpected response — please retry.'); }
    if (needsPin(data.error)) {
      const p = await promptPin(data.error === 'Incorrect PIN');
      setPin(p);
      continue;
    }
    if (data.error) throw new Error(data.error);
    return data;
  }
  throw new Error('Too many PIN attempts');
}

async function postAction(payload) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const body = Object.assign({}, payload, { pin: getPin() });
    // text/plain avoids a CORS preflight that Apps Script web apps don't handle.
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Request failed');
    const data = await res.json();
    if (needsPin(data.error)) {
      const p = await promptPin(data.error === 'Incorrect PIN');
      setPin(p);
      continue;
    }
    if (data.error) throw new Error(data.error);
    return data;
  }
  throw new Error('Too many PIN attempts');
}
