/**
 * Nanny Hours — Google Apps Script backend.
 *
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone).
 * Run setup() once before deploying to create the Entries and Config sheets.
 *
 * If Config has a non-empty PIN, both reads (doGet) and writes (doPost)
 * require ?pin=... / {pin:...}. The PIN is never returned in responses.
 */

var ENTRIES_SHEET = 'Entries';
var CONFIG_SHEET = 'Config';

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var entries = ss.getSheetByName(ENTRIES_SHEET);
  if (!entries) entries = ss.insertSheet(ENTRIES_SHEET);
  entries.clear();
  entries.appendRow(['ID', 'Date', 'Start Time', 'End Time', 'Break Minutes', 'Hours', 'Notes', 'Submitted At']);
  entries.setFrozenRows(1);

  var config = ss.getSheetByName(CONFIG_SHEET);
  if (!config) config = ss.insertSheet(CONFIG_SHEET);
  config.clear();
  config.appendRow(['Key', 'Value']);
  config.appendRow(['HourlyRate', 20]);
  config.appendRow(['NannyName', 'Nanny Name']);
  config.appendRow(['NannyAddress', '']);
  config.appendRow(['NannyPhone', '']);
  config.appendRow(['NannyEmail', '']);
  config.appendRow(['EmployerName', 'Your Name']);
  config.appendRow(['EmployerAddress', '']);
  config.appendRow(['EmployerPhone', '']);
  config.appendRow(['EmployerEmail', '']);
  config.appendRow(['AgreementText', '']);
  config.appendRow(['PIN', '']);
  config.setFrozenRows(1);
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = readConfig_(ss.getSheetByName(CONFIG_SHEET));

  var pin = (e && e.parameter && e.parameter.pin) || '';
  if (config.PIN && String(pin) !== String(config.PIN)) {
    return jsonResponse_({ error: pin ? 'Incorrect PIN' : 'PIN required' });
  }

  var entries = readEntries_(ss.getSheetByName(ENTRIES_SHEET));
  return jsonResponse_({ entries: entries, config: stripPin_(config) });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ error: 'Invalid request body' });
  }

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

  if (body.action === 'batch') {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var results = [];
      var ops = body.ops || [];
      for (var k = 0; k < ops.length; k++) {
        var op = ops[k];
        if (op.op === 'add') {
          results.push({ op: 'add', id: addEntry_(entriesSheet, op.entry) });
        } else if (op.op === 'update') {
          results.push({ op: 'update', result: updateEntry_(entriesSheet, op.id, op.entry) });
        } else if (op.op === 'delete') {
          results.push({ op: 'delete', result: deleteEntry_(entriesSheet, op.id) });
        }
      }
      return jsonResponse_({ ok: true, results: results });
    } finally {
      lock.releaseLock();
    }
  }

  return jsonResponse_({ error: 'Unknown action' });
}

function addEntry_(sheet, entry) {
  var id = Utilities.getUuid();
  sheet.appendRow([
    id, entry.date, entry.startTime, entry.endTime,
    entry.breakMinutes, entry.hours, entry.notes, new Date().toISOString()
  ]);
  return id;
}

function updateEntry_(sheet, id, entry) {
  var row = findRowById_(sheet, id);
  if (row < 0) return { error: 'Entry not found' };
  sheet.getRange(row, 2, 1, 6).setValues([[
    entry.date, entry.startTime, entry.endTime, entry.breakMinutes, entry.hours, entry.notes
  ]]);
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
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return i + 2;
  }
  return -1;
}

function saveConfig_(sheet, obj) {
  var data = sheet.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < data.length; i++) index[data[i][0]] = i + 1;
  Object.keys(obj).forEach(function (k) {
    if (k === 'PIN') return; // PIN is managed in the sheet only, never via the web form
    if (index[k]) sheet.getRange(index[k], 2).setValue(obj[k]);
    else sheet.appendRow([k, obj[k]]);
  });
  return { ok: true };
}

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
      submittedAt: row[7]
    });
  }
  return rows;
}

function readConfig_(sheet) {
  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < data.length; i++) {
    config[data[i][0]] = data[i][1];
  }
  return config;
}

function stripPin_(config) {
  var safe = {};
  Object.keys(config).forEach(function (k) {
    if (k !== 'PIN') safe[k] = config[k];
  });
  return safe;
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
