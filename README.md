# Nanny Hours

A small static site for tracking a nanny's hours and generating printable
invoices for tax records. Hosted on GitHub Pages; data lives in a Google
Sheet via a Google Apps Script "API".

- `index.html` — the nanny logs hours here (start/end time, auto-computed
  total, notes). Also shows/deletes recent entries.
- `invoice.html` — pick a date range, see itemized hours and total pay,
  print/save as PDF.

## 1. Create the Google Sheet + Apps Script backend

1. Create a new Google Sheet (sheets.new). Name it something like "Nanny Hours".
2. In the Sheet, go to **Extensions → Apps Script**.
3. Delete the default code and paste in the contents of
   `apps-script/Code.gs` from this repo.
4. In the Apps Script editor, select the `setup` function from the dropdown
   next to "Run" and click **Run**. This creates the `Entries` and `Config`
   sheets with headers and default values. The first run will prompt you to
   authorize the script — approve it (it's your own script acting on your
   own sheet).
5. Go back to the Sheet and open the **Config** tab. Set:
   - `HourlyRate` — the agreed rate (e.g. `20`)
   - `NannyName` — your nanny's name (shown on invoices)
   - `EmployerName` — your name/household (shown on invoices)
   - `PIN` — optional. Leave blank for no PIN. If set, this PIN is required
     to submit or delete entries — it's a light deterrent, not real
     security (see note below).
6. Back in the Apps Script editor, click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
   - Click **Deploy**, authorize again if prompted.
7. Copy the **Web app URL** it gives you (ends in `/exec`).

## 2. Point the site at your Apps Script

Open `js/config.js` and paste the URL:

```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
```

## 3. Publish with GitHub Pages

1. Create a new GitHub repo and push this folder's contents to it.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set Source to **Deploy from a branch**,
   branch `main`, folder `/ (root)`.
4. Save. GitHub will give you a URL like
   `https://<your-username>.github.io/<repo-name>/` — that's the link to
   send your nanny.

## Using it

- **Nanny**: opens the site link, logs each shift (date, start/end time,
  optional break, optional note), hits submit. She can see and delete her
  own recent entries if she makes a mistake.
- **You**: open `invoice.html`, pick a pay period, click Generate, then
  "Print / Save as PDF" to get a clean invoice for your records or for
  handing to your nanny.
- Need to fix a typo'd entry, change the rate, or edit history? Open the
  Google Sheet directly — it's the source of truth.

## Notes on security

This is designed for convenience within a family, not as a secured app.
Anyone with the Apps Script URL can read/write entries (or bypass the PIN
if you don't set one). Don't post the Apps Script URL or GitHub Pages link
publicly. This is fine for a private, low-stakes tool but isn't meant to
protect sensitive data.
