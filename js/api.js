async function fetchData() {
  const res = await fetch(APPS_SCRIPT_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load data');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function postAction(payload) {
  // text/plain avoids a CORS preflight request, which Apps Script web apps don't handle.
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Request failed');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}
