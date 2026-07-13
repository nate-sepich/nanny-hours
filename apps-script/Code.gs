/**
 * Nanny Hours — Google Apps Script backend.
 *
 * Deploy this as a Web App (Execute as: Me, Access: Anyone with the link).
 * The deployed URL is the API the static site talks to.
 *
 * Run setup() once from the Apps Script editor before deploying to create
 * the Entries and Config sheets with headers and default values.
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
  config.appendRow(['EmployerName', 'Your Name']);
  config.appendRow(['PIN', '']);
  config.setFrozenRows(1);

  // Default sheet Sheet1 is unused; leave it alone in case other things reference it.
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var entriesSheet = ss.getSheetByName(ENTRIES_SHEET);
  var configSheet = ss.getSheetByName(CONFIG_SHEET);

  var entries = readEntries_(entriesSheet);
  var config = readConfig_(configSheet);

  return jsonResponse_({ entries: entries, config: config });
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

  if (config.PIN && body.pin !== config.PIN) {
    return jsonResponse_({ error: 'Incorrect PIN' });
  }

  if (body.action === 'add') {
    var entry = body.entry;
    var id = Utilities.getUuid();
    entriesSheet.appendRow([
      id,
      entry.date,
      entry.startTime,
      entry.endTime,
      entry.breakMinutes,
      entry.hours,
      entry.notes,
      new Date().toISOString()
    ]);
    return jsonResponse_({ ok: true, id: id });
  }

  if (body.action === 'delete') {
    var data = entriesSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === body.id) {
        entriesSheet.deleteRow(i + 1);
        return jsonResponse_({ ok: true });
      }
    }
    return jsonResponse_({ error: 'Entry not found' });
  }

  return jsonResponse_({ error: 'Unknown action' });
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
      startTime: row[2],
      endTime: row[3],
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

function formatDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
