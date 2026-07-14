/**
 * Nanny Hours — Google Apps Script backend.
 *
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone).
 * Run setup() once (only on an empty sheet — it clears Entries).
 * Run setupBackup() once to schedule weekly Sheet backups (approves Drive access).
 *
 * If Config has a non-empty PIN, reads (doGet) and writes (doPost) require it.
 * The PIN is never returned in responses. All writes go through plain-text
 * cells so a value starting with = / + / @ can't become a live formula.
 */

var ENTRIES_SHEET = 'Entries';
var CONFIG_SHEET = 'Config';

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var entries = ss.getSheetByName(ENTRIES_SHEET);
  if (!entries) entries = ss.insertSheet(ENTRIES_SHEET);
  entries.clear();
  entries.appendRow(['ID', 'Date', 'Start Time', 'End Time', 'Break Minutes', 'Hours', 'Notes', 'Submitted At', 'Rate']);
  entries.setFrozenRows(1);

  var config = ss.getSheetByName(CONFIG_SHEET);
  if (!config) config = ss.insertSheet(CONFIG_SHEET);
  config.clear();
  config.appendRow(['Key', 'Value']);
  [['HourlyRate', 20], ['NannyName', 'Nanny Name'], ['NannyAddress', ''],
   ['NannyPhone', ''], ['NannyEmail', ''], ['EmployerName', 'Your Name'],
   ['EmployerAddress', ''], ['EmployerPhone', ''], ['EmployerEmail', ''],
   ['AgreementText', ''], ['Schedule', ''], ['Schedules', ''], ['PIN', '']
  ].forEach(function (r) { config.appendRow(r); });
  config.setFrozenRows(1);
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var config = readConfig_(ss.getSheetByName(CONFIG_SHEET));
    var pin = (e && e.parameter && e.parameter.pin) || '';
    if (config.PIN && String(pin) !== String(config.PIN)) {
      return jsonResponse_({ error: pin ? 'Incorrect PIN' : 'PIN required' });
    }
    var entries = readEntries_(ss.getSheetByName(ENTRIES_SHEET));
    return jsonResponse_({ entries: entries, config: stripPin_(config) });
  } catch (err) {
    return jsonResponse_({ error: 'Server error: ' + err.message });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (lockErr) {
    return jsonResponse_({ error: 'Busy, please retry' });
  }
  try {
    var body = JSON.parse(e.postData.contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var entriesSheet = ss.getSheetByName(ENTRIES_SHEET);
    var configSheet = ss.getSheetByName(CONFIG_SHEET);
    var config = readConfig_(configSheet);

    if (config.PIN && String(body.pin) !== String(config.PIN)) {
      return jsonResponse_({ error: body.pin ? 'Incorrect PIN' : 'PIN required' });
    }

    if (body.action === 'add') {
      return jsonResponse_({ ok: true, id: addEntry_(entriesSheet, body.entry) });
    }
    if (body.action === 'update') {
      return jsonResponse_(updateEntry_(entriesSheet, body.id, body.entry));
    }
    if (body.action === 'delete') {
      return jsonResponse_(deleteEntry_(entriesSheet, body.id));
    }
    if (body.action === 'saveConfig') {
      return jsonResponse_(saveConfig_(configSheet, body.config || {}));
    }
    if (body.action === 'saveSchedule') {
      return jsonResponse_(saveSchedule_(configSheet, body));
    }
    if (body.action === 'batch') {
      var results = [];
      var ops = body.ops || [];
      for (var k = 0; k < ops.length; k++) {
        var op = ops[k];
        if (op.op === 'add') results.push({ op: 'add', id: addEntry_(entriesSheet, op.entry) });
        else if (op.op === 'update') results.push({ op: 'update', result: updateEntry_(entriesSheet, op.id, op.entry) });
        else if (op.op === 'delete') results.push({ op: 'delete', result: deleteEntry_(entriesSheet, op.id) });
      }
      return jsonResponse_({ ok: true, results: results });
    }
    return jsonResponse_({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse_({ error: 'Server error: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

// ---------- entries ----------
function addEntry_(sheet, entry) {
  var id = Utilities.getUuid();
  sheet.appendRow([id, entry.date, entry.startTime, entry.endTime,
    entry.breakMinutes, entry.hours, sanitize_(entry.notes), new Date().toISOString(), entry.rate]);
  return id;
}

function updateEntry_(sheet, id, entry) {
  var row = findRowById_(sheet, id);
  if (row < 0) return { error: 'Entry not found' };
  sheet.getRange(row, 2, 1, 6).setValues([[entry.date, entry.startTime, entry.endTime,
    entry.breakMinutes, entry.hours, sanitize_(entry.notes)]]);
  return { ok: true };
}

function deleteEntry_(sheet, id) {
  var row = findRowById_(sheet, id);
  if (row < 0) return { error: 'Entry not found' };
  sheet.deleteRow(row);
  return { ok: true };
}

function findRowById_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return -1;
}

// ---------- config / schedule ----------
function saveConfig_(sheet, obj) {
  var data = sheet.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < data.length; i++) index[data[i][0]] = i + 1;
  Object.keys(obj).forEach(function (k) {
    if (k === 'PIN') return; // PIN managed only in the sheet
    if (index[k]) {
      sheet.getRange(index[k], 2).setValue(sanitize_(obj[k]));
    } else {
      var r = sheet.getLastRow() + 1;
      sheet.getRange(r, 1).setValue(k);
      sheet.getRange(r, 2).setValue(sanitize_(obj[k]));
    }
  });
  return { ok: true };
}

// Merge one week into the Schedules blob (read-merge-write, under the doPost lock).
function saveSchedule_(sheet, body) {
  var config = readConfig_(sheet);
  var data = { startHour: body.startHour, endHour: body.endHour, slot: body.slot, weeks: {} };
  if (config.Schedules) {
    try {
      var p = JSON.parse(config.Schedules);
      if (p && p.weeks) data = p;
    } catch (e) { /* start fresh */ }
  }
  data.startHour = body.startHour;
  data.endHour = body.endHour;
  data.slot = body.slot;
  data.weeks[body.weekStart] = body.week;
  return saveConfig_(sheet, { Schedules: JSON.stringify(data) });
}

// ---------- read ----------
function readEntries_(sheet) {
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    rows.push({
      id: row[0],
      date: formatDate_(row[1]),
      startTime: formatTime_(row[2]),
      endTime: formatTime_(row[3]),
      breakMinutes: row[4],
      hours: row[5],
      notes: row[6],
      submittedAt: row[7],
      rate: row[8]
    });
  }
  return rows;
}

function readConfig_(sheet) {
  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < data.length; i++) config[data[i][0]] = data[i][1];
  return config;
}

function stripPin_(config) {
  var safe = {};
  Object.keys(config).forEach(function (k) { if (k !== 'PIN') safe[k] = config[k]; });
  return safe;
}

// Prefix a leading = / + / - / @ with an apostrophe so the value can't become
// a live spreadsheet formula. Sheets treats the apostrophe as a text marker and
// strips it on read.
function sanitize_(v) {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function formatDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

function formatTime_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  return value;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- weekly backup ----------
function setupBackup() {
  // Run once from the editor to schedule weekly backups (asks for Drive access).
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupSheet_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupSheet_').timeBased().everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
}

function backupSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = 'Nanny Hours backup ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  DriveApp.getFileById(ss.getId()).makeCopy(name);

  // Keep only the most recent 8 backups.
  var copies = [];
  var it = DriveApp.searchFiles('title contains "Nanny Hours backup "');
  while (it.hasNext()) copies.push(it.next());
  copies.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (var i = 8; i < copies.length; i++) copies[i].setTrashed(true);
}
