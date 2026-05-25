/**
 * Returns the local spreadsheet based on Script Properties or Active state.
 */
function getLocalSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(HIREOS_LOCAL_SS_PROP);

  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      console.warn('ID in HIREOS_LOCAL_SPREADSHEET_ID is invalid, falling back.');
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    props.setProperty(HIREOS_LOCAL_SS_PROP, ss.getId());
    return ss;
  }

  // Fallback to HIREOS_SPREADSHEET_ID if available
  if (typeof HIREOS_SPREADSHEET_ID !== 'undefined' && HIREOS_SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(HIREOS_SPREADSHEET_ID);
    } catch (e) {
      console.warn('Fallback to HIREOS_SPREADSHEET_ID failed:', e.toString());
    }
  }

  throw new Error(
    'No spreadsheet found. Bind this script to a Google Sheet or set HIREOS_LOCAL_SPREADSHEET_ID in Script Properties.'
  );
}

// --- COLUMN MAPPING HELPERS ---

/**
 * Returns a map of header names to 1-based column indices.
 * WARNING: DO NOT USE HARDCODED COLUMN INDICES. ALWAYS USE THIS HELPER.
 */
function getHeaderMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((header, index) => {
    if (header) map[header] = index + 1;
  });
  return map;
}

/**
 * Appends a row using an object mapping header names to values.
 */
function appendRowByHeaders_(sheet, rowObject) {
  const headerMap = getHeaderMap_(sheet);
  const lastCol = sheet.getLastColumn();
  const rowData = new Array(lastCol).fill('');

  Object.keys(rowObject).forEach((header) => {
    const colIndex = headerMap[header];
    if (colIndex) {
      rowData[colIndex - 1] = rowObject[header];
    }
  });

  sheet.appendRow(rowData);
}

/**
 * Updates a row by matching a column value and providing an object of updates.
 */
function updateRowByHeaders_(sheet, matchHeader, matchValue, updatesObject) {
  const headerMap = getHeaderMap_(sheet);
  const matchCol = headerMap[matchHeader];
  if (!matchCol) return false;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][matchCol - 1] === matchValue) {
      const rowIndex = i + 1;
      Object.keys(updatesObject).forEach((header) => {
        const col = headerMap[header];
        if (col) {
          sheet.getRange(rowIndex, col).setValue(updatesObject[header]);
        }
      });
      return true;
    }
  }
  return false;
}

/**
 * Finds the 1-based row index of a value in a column identified by its header.
 */
function findRowIndexByHeaderValue_(sheet, headerName, value) {
  const headerMap = getHeaderMap_(sheet);
  const colIndex = headerMap[headerName];
  if (!colIndex) return -1;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex - 1] === value) {
      return i + 1;
    }
  }
  return -1;
}

/**
 * Returns a row as an object mapping header names to values.
 */
function getRowObjectByHeaders_(sheet, rowIndex) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const obj = {};
  headers.forEach((header, i) => {
    if (header) obj[header] = rowData[i];
  });
  return obj;
}

/**
 * Returns all rows in a sheet as an array of objects mapping header names to values.
 */
function getRowsAsObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  return data.map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      if (header) obj[header] = row[i];
    });
    return obj;
  });
}

/**
 * Returns safe diagnostic information about spreadsheet availability.
 */
function getSpreadsheetDiagnostics_() {
  const props = PropertiesService.getScriptProperties();
  return {
    hasLocalProp: !!props.getProperty(HIREOS_LOCAL_SS_PROP),
    hasLegacyProp: !!props.getProperty('HIREOS_SPREADSHEET_ID'),
    hasActiveSS: !!SpreadsheetApp.getActiveSpreadsheet(),
  };
}

/**
 * Robustly returns the spreadsheet intended for candidate lookups.
 * Priority: HIREOS_LOCAL_SPREADSHEET_ID > Active SS > HIREOS_SPREADSHEET_ID
 */
function getNewSystemSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const diag = getSpreadsheetDiagnostics_();
  let ssId = props.getProperty(HIREOS_LOCAL_SS_PROP) || props.getProperty('HIREOS_SPREADSHEET_ID');

  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      console.warn('Configured SS ID is invalid, falling back to active.');
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    props.setProperty(HIREOS_LOCAL_SS_PROP, ss.getId());
    return ss;
  }

  const error = new Error('Spreadsheet not found.');
  error.errorCode = 'SPREADSHEET_NOT_FOUND';
  error.diagnostics = diag;
  throw error;
}

function getOrCreateSheet(ss) {
  const schema = HIREOS_SHEET_SCHEMA.CANDIDATES;
  ensureSheetAndHeaders_(ss, schema.name, schema.headers);
  return ss.getSheetByName(schema.name);
}

function getSpreadsheet() {
  try {
    return getNewSystemSpreadsheet_();
  } catch (e) {
    throw new Error(
      'No spreadsheet is connected. Bind this script to your Google Sheet or set HIREOS_LOCAL_SPREADSHEET_ID in Script Properties.'
    );
  }
}

function getOrCreateAudioReviewSheet(ss) {
  const schema = HIREOS_SHEET_SCHEMA.AUDIO_REVIEWS;
  ensureSheetAndHeaders_(ss, schema.name, schema.headers);
  return ss.getSheetByName(schema.name);
}

function getOrCreateFolder(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(name);
}

function getAudioStorageFolders() {
  const rootFolders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
  const rootFolder = rootFolders.hasNext()
    ? rootFolders.next()
    : DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
  return {
    rootFolder: rootFolder,
    audioFolder: getOrCreateFolder(rootFolder, AUDIO_DRIVE_FOLDER_NAME),
    pdfFolder: getOrCreateFolder(rootFolder, PDF_DRIVE_FOLDER_NAME),
  };
}

/**
 * STUB: Returns the Drive folder for the new system.
 * Added to prevent ReferenceError in legacy/orphan code.
 */
function getNewSystemFolder() {
  const folders = DriveApp.getFoldersByName(NEW_SYS_CONFIG.FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  // Fallback to creating it if called, though this is legacy code.
  return DriveApp.createFolder(NEW_SYS_CONFIG.FOLDER_NAME);
}

/**
 * STUB: Placeholder for missing PDF building logic.
 * Added to prevent ReferenceError if referenced by legacy/planned features.
 */
function buildAudioReviewPdf() {
  console.warn('buildAudioReviewPdf is not implemented. Use frontend PDF generation instead.');
  return null;
}
