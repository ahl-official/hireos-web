/**
 * PsychometricService.gs
 *
 * DISC / personality assessment for Candidates (and later Employees).
 *
 * ID RULES
 * - PsychometricResults.ID = HireOS Interview sheet ID for candidates
 *   (= Candidate Applications "Interview ID"). Permanent person id.
 * - It is NOT the temporary audio session interviewId from startInterviewSession.
 * - Entity_Type = "Candidate" | "Employee" so the same ID space can hold both.
 *
 * FLOW
 * 1. getPsychometricQuestions  → shuffle Qs + options, return optionIds only
 * 2. savePsychometricResult    → tally optionIds, score, profile, role fit, AI summary
 * 3. getPsychometricResult     → HR dashboard read
 * 4. sendPsychometricTestLink  → WhatsApp link (Candidate after interview; Employee anytime)
 * 5. sendPendingEmployeePsychometricLinks → bulk send to Employees with empty DISC Profile
 *
 * SCORING (server only — never trust frontend %)
 * - 20 forced-choice questions
 * - trait% = selections / 20 * 100  (D+I+S+C ≈ 100)
 * - Profile = one of 12 neighbour codes (D, Di, iD, I, …)
 * - Applied role fit = bottleneck (weakest dimension), then profile bonus/penalty
 * - Suggested roles = filter by Typical_Profiles, then AI may refine/replace
 *   (math list can be empty or a weak match — AI is intentional here)
 */

// ==========================================
// 0. SMALL HELPERS
// ==========================================

function shuffleArray_(arr) {
  const a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function formatPsychometricDate_(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeEntityType_(entityType) {
  const t = String(entityType || 'Candidate').trim().toLowerCase();
  return t === 'employee' ? 'Employee' : 'Candidate';
}

/**
 * Parse Recommended_Roles cell.
 * Prefer JSON array; otherwise split "Role — 80% Strong Fit; …" on ";".
 */
function parseRecommendedRoles_(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // fall through to semicolon text
  }

  return text
    .split(';')
    .map(function (p) {
      return p.trim();
    })
    .filter(Boolean);
}

// ==========================================
// 1. PSYCHOMETRIC RESULTS SHEET
// ==========================================

function getPsychometricSheet_() {
  const ss = getLocalSpreadsheet();
  const schema = HIREOS_SHEET_SCHEMA.PSYCHOMETRIC_RESULTS;

  if (!schema) {
    throw new Error('PSYCHOMETRIC_RESULTS is missing from HIREOS_SHEET_SCHEMA.');
  }

  ensureSheetAndHeaders_(ss, schema.name, schema.headers);

  const sheet = ss.getSheetByName(schema.name);
  if (!sheet) {
    throw new Error('PsychometricResults sheet could not be created.');
  }

  return sheet;
}

/**
 * Find PsychometricResults row by ID + Entity_Type.
 * Returns 1-based sheet row index, or -1.
 * Back-compat: also reads legacy Interview_ID column if ID is missing.
 */
function findPsychometricRowIndex_(sheet, id, entityType) {
  const safeId = String(id || '').trim();
  const type = normalizeEntityType_(entityType);
  if (!safeId) return -1;

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return -1;

  const headers = data[0].map(function (h) {
    return String(h).trim();
  });

  const idCol = headers.indexOf('ID');
  const typeCol = headers.indexOf('Entity_Type');
  const legacyIdCol = headers.indexOf('Interview_ID');

  if (idCol === -1 && legacyIdCol === -1) return -1;

  for (var r = 1; r < data.length; r++) {
    const rowId =
      idCol !== -1
        ? String(data[r][idCol] || '').trim()
        : String(data[r][legacyIdCol] || '').trim();

    const rowType =
      typeCol !== -1
        ? normalizeEntityType_(data[r][typeCol] || 'Candidate')
        : 'Candidate';

    if (rowId === safeId && rowType === type) {
      return r + 1;
    }
  }

  return -1;
}

/** Update one sheet row by 1-based index using header names. */
function updateRowByHeadersAtIndex_(sheet, rowIndex, valuesByHeader) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const row = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];

  Object.keys(valuesByHeader || {}).forEach(function (header) {
    const col = headers.indexOf(header);
    if (col !== -1) {
      row[col] = valuesByHeader[header];
    }
  });

  sheet.getRange(rowIndex, 1, 1, lastCol).setValues([row]);
}

// ==========================================
// 2. PERSON LOOKUP (Candidate / Employee)
// ==========================================

/**
 * Shared person lookup.
 * Candidate → local Interview sheet
 * Employee → external Employees spreadsheet (Script Properties)
 */
function getPsychometricPerson_(id, entityType) {
  const safeId = String(id || '').trim();
  const type = normalizeEntityType_(entityType);
  if (!safeId) return null;

  if (type === 'Employee') {
    return getPsychometricEmployee_(safeId);
  }
  return getPsychometricCandidate_(safeId);
}

function getPsychometricCandidate_(interviewId) {
  const candidateId = String(interviewId || '').trim();
  if (!candidateId) return null;

  const ss = getLocalSpreadsheet();
  const candidateSheet = getOrCreateSheet(ss);
  const rowIndex = findRowIndexByHeaderValue_(candidateSheet, 'ID', candidateId);
  if (rowIndex === -1) return null;

  const row = getRowObjectByHeaders_(candidateSheet, rowIndex);

  return {
    id: String(row['ID'] || '').trim(),
    entityType: 'Candidate',
    name: String(row['Name'] || '').trim(),
    email: String(row['Email'] || '').trim(),
    whatsapp: String(row['WhatsApp'] || '').trim(),
    position: String(row['Position'] || '').trim(),
    status: String(row['Status'] || '').trim(),
  };
}

/**
 * Employees live on the shared HR workbook (same as Candidate Applications).
 * Uses HR_SHARED_SPREADSHEET_ID by default.
 * Optional overrides: EMPLOYEES_SPREADSHEET_ID, EMPLOYEES_SHEET_NAME.
 */
function getEmployeesSheet_() {
  const empSsId = String(
    PropertiesService.getScriptProperties().getProperty('EMPLOYEES_SPREADSHEET_ID') ||
      getHrSharedSpreadsheetId_() ||
      ''
  ).trim();
  if (!empSsId) {
    throw new Error(
      'Set Script Property HR_SHARED_SPREADSHEET_ID (or EMPLOYEES_SPREADSHEET_ID).'
    );
  }
  const sheetName =
    PropertiesService.getScriptProperties().getProperty('EMPLOYEES_SHEET_NAME') ||
    'Employees';

  const empSs = SpreadsheetApp.openById(empSsId);
  return empSs.getSheetByName(sheetName);
}

function getPsychometricEmployee_(employeeId) {
  const safeId = String(employeeId || '').trim();
  if (!safeId) return null;

  const sheet = getEmployeesSheet_();
  if (!sheet) {
    console.error('[getPsychometricEmployee_] Employees sheet not found');
    return null;
  }

  const rowIndex = findRowIndexByHeaderValue_(sheet, 'Employee ID', safeId);
  if (rowIndex === -1) {
    const altIndex = findEmployeeRowFlexible_(sheet, safeId);
    if (altIndex === -1) return null;
    return mapEmployeeRow_(getRowObjectByHeaders_(sheet, altIndex));
  }

  return mapEmployeeRow_(getRowObjectByHeaders_(sheet, rowIndex));
}

function findEmployeeRowFlexible_(sheet, employeeId) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return -1;

  const headers = data[0].map(function (h) {
    return String(h).trim();
  });
  const col = headers.indexOf('Employee ID');
  if (col === -1) return -1;

  const target = String(employeeId).trim();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][col]).trim() === target) {
      return r + 1;
    }
  }
  return -1;
}

function mapEmployeeRow_(row) {
  const status = String(row['Status'] || '').trim();

  return {
    id: String(row['Employee ID'] || '').trim(),
    entityType: 'Employee',
    name: String(row['Full Name'] || '').trim(),
    email: String(
      row['Company E-mail ID'] || row['Personal E-mail ID'] || ''
    ).trim(),
    whatsapp: String(row['Mobile Number'] || '').trim(),
    position: String(row['Current Designation'] || '').trim(),
    status: status,
    department: String(row['Department'] || '').trim(),
    company: String(row['Company'] || '').trim(),
  };
}

// ==========================================
// 3. GET ONE PSYCHOMETRIC RESULT (HR API)
// ==========================================

function getPsychometricResult(data) {
  try {
    const id = String(
      (typeof data === 'string' ? data : null) ||
        (data && (data.id || data.interviewId)) ||
        ''
    ).trim();

    const entityType = normalizeEntityType_(
      typeof data === 'object' && data ? data.entityType : 'Candidate'
    );

    if (!id) {
      return createErrorResponse_('ID is required.', '', {
        errorCode: 'PSYCHOMETRIC_ID_MISSING',
        backendStep: 'VALIDATE_ID',
      });
    }

    const person = getPsychometricPerson_(id, entityType);
    if (!person) {
      return createErrorResponse_(entityType + ' not found.', '', {
        errorCode: 'PSYCHOMETRIC_PERSON_NOT_FOUND',
        backendStep: 'PERSON_LOOKUP',
        id: id,
        entityType: entityType,
      });
    }

    const sheet = getPsychometricSheet_();
    const rowIndex = findPsychometricRowIndex_(sheet, id, entityType);

    // Person exists, but DISC has not started.
    if (rowIndex === -1) {
      return createSuccessResponse_({
        data: {
          id: person.id,
          entityType: person.entityType,
          interviewId: person.entityType === 'Candidate' ? person.id : '',
          candidateName: person.name,
          email: person.email,
          whatsapp: person.whatsapp,
          position: person.position,
          status: 'Not Started',
          testSentAt: '',
          testCompletedAt: '',
          discD: 0,
          discI: 0,
          discS: 0,
          discC: 0,
          discProfile: '',
          appliedRole: person.position,
          roleFitScore: 0,
          roleFitLabel: '',
          discSummary: '',
          recommendedRoles: [],
        },
      });
    }

    const row = getRowObjectByHeaders_(sheet, rowIndex);
    const rowEntity = normalizeEntityType_(row['Entity_Type'] || person.entityType);
    const rowId = String(row['ID'] || row['Interview_ID'] || person.id || '');

    return createSuccessResponse_({
      data: {
        id: rowId,
        entityType: rowEntity,
        interviewId: rowEntity === 'Candidate' ? rowId : '',
        candidateName: String(row['Name'] || row['Candidate_Name'] || person.name || ''),
        email: String(row['Email'] || ''),
        whatsapp: String(row['WhatsApp'] || ''),
        testSentAt: formatPsychometricDate_(row['Test_Sent_At']),
        testCompletedAt: formatPsychometricDate_(row['Test_Completed_At']),
        discD: Number(row['DISC_D'] || 0),
        discI: Number(row['DISC_I'] || 0),
        discS: Number(row['DISC_S'] || 0),
        discC: Number(row['DISC_C'] || 0),
        discProfile: String(row['DISC_Profile'] || ''),
        appliedRole: String(row['Applied_Role'] || person.position || ''),
        roleFitScore: Number(row['Role_Fit_Score'] || 0),
        roleFitLabel: String(row['Role_Fit_Label'] || ''),
        discSummary: String(row['DISC_Summary'] || ''),
        recommendedRoles: parseRecommendedRoles_(row['Recommended_Roles']),
        status: String(row['Status'] || 'Not Started'),
        updatedAt: formatPsychometricDate_(row['Updated_At']),
        position: person.position,
      },
    });
  } catch (error) {
    console.error('[getPsychometricResult] Error:', error);
    return createErrorResponse_(
      'Failed to load personality assessment.',
      error.toString(),
      {
        errorCode: 'PSYCHOMETRIC_GET_FAILED',
        backendStep: 'GET_PSYCHOMETRIC_RESULT',
      }
    );
  }
}

// ==========================================
// 4. QUESTIONS SHEET + FETCH (candidate portal)
// ==========================================

function getPsychometricQuestionsSheet_() {
  const ss = getLocalSpreadsheet();
  const schema = HIREOS_SHEET_SCHEMA.PSYCHOMETRIC_QUESTIONS;

  if (!schema) {
    throw new Error('PSYCHOMETRIC_QUESTIONS is missing from HIREOS_SHEET_SCHEMA.');
  }

  ensureSheetAndHeaders_(ss, schema.name, schema.headers);

  const sheet = ss.getSheetByName(schema.name);
  if (!sheet) {
    throw new Error('PsychometricQuestions sheet could not be created.');
  }

  return sheet;
}

/** Active questions sorted by Question_No. Includes D/I/S/C texts for scoring. */
function getPsychometricQuestionRows_() {
  const sheet = getPsychometricQuestionsSheet_();
  const rows = getRowsAsObjects_(sheet);

  return rows
    .filter(function (row) {
      return (
        String(row['Status'] || '')
          .trim()
          .toLowerCase() === 'active'
      );
    })
    .sort(function (a, b) {
      return Number(a['Question_No'] || 0) - Number(b['Question_No'] || 0);
    });
}

/**
 * Map Candidate ID → { discProfile, discStatus } for list views.
 * Reads PsychometricResults once (Entity_Type = Candidate).
 */
function getCandidatePsychometricSummaryMap_() {
  const map = {};
  try {
    const sheet = getPsychometricSheet_();
    const rows = getRowsAsObjects_(sheet);

    rows.forEach(function (row) {
      const entity = normalizeEntityType_(row['Entity_Type'] || 'Candidate');
      if (entity !== 'Candidate') return;

      const id = String(row['ID'] || row['Interview_ID'] || '').trim();
      if (!id) return;

      const statusRaw = String(row['Status'] || '').trim();
      const statusLower = statusRaw.toLowerCase();
      var discStatus = 'Not Started';
      if (statusLower === 'completed') discStatus = 'Completed';
      else if (statusLower === 'pending') discStatus = 'Pending';

      map[id] = {
        discProfile: String(row['DISC_Profile'] || '').trim(),
        discStatus: discStatus,
      };
    });
  } catch (e) {
    console.error('[getCandidatePsychometricSummaryMap_]', e);
  }
  return map;
}

/**
 * Gate for opening / submitting the DISC test.
 *
 * Candidate:
 *   - Interview sheet Status must be Completed
 *   - PsychometricResults must NOT be Completed (Pending or Not Started OK)
 *
 * Employee:
 *   - No interview check (employees only take DISC)
 *   - PsychometricResults must NOT be Completed (Pending or Not Started OK)
 *
 * Returns null if OK, or createErrorResponse_ if blocked.
 */
function assertCanTakePsychometric_(person, id, entityType) {
  if (!person) {
    return createErrorResponse_(entityType + ' not found.', '', {
      errorCode: 'PSYCHOMETRIC_PERSON_NOT_FOUND',
      backendStep: 'PERSON_LOOKUP',
      id: id,
      entityType: entityType,
    });
  }

  // Candidate only: must finish HireOS interview first
  if (person.entityType === 'Candidate') {
    const interviewStatus = String(person.status || '')
      .trim()
      .toLowerCase();
    if (interviewStatus !== 'completed') {
      return createErrorResponse_(
        'Personality assessment is available only after the interview is completed.',
        'interviewStatus=' + (person.status || ''),
        {
          errorCode: 'PSYCHOMETRIC_INTERVIEW_NOT_COMPLETED',
          backendStep: 'VALIDATE_INTERVIEW_STATUS',
          id: id,
          entityType: entityType,
          interviewStatus: person.status || '',
        }
      );
    }
  }

  // Candidate + Employee: block retake if DISC already Completed
  const sheet = getPsychometricSheet_();
  const rowIndex = findPsychometricRowIndex_(sheet, id, entityType);
  if (rowIndex !== -1) {
    const existing = getRowObjectByHeaders_(sheet, rowIndex);
    const psychoStatus = String(existing['Status'] || '')
      .trim()
      .toLowerCase();
    if (psychoStatus === 'completed') {
      return createErrorResponse_(
        'Personality assessment already completed.',
        '',
        {
          errorCode: 'PSYCHOMETRIC_ALREADY_COMPLETED',
          backendStep: 'PREVENT_RETAKE',
          id: id,
          entityType: entityType,
        }
      );
    }
  }

  return null; // Pending or Not Started → allowed
}

/**
 * Public API for the test page.
 * Returns optionId + text only (never exposes dimension as a UI field).
 * optionId format: "{Question_No}_{D|I|S|C}" e.g. "1_D"
 *
 * Opens only when allowed for this entity type (see assertCanTakePsychometric_).
 */
function getPsychometricQuestions(data) {
  try {
    const id = String(
      (typeof data === 'string' ? data : null) ||
        (data && (data.id || data.interviewId)) ||
        ''
    ).trim();

    const entityType = normalizeEntityType_(
      typeof data === 'object' && data ? data.entityType : 'Candidate'
    );

    if (!id) {
      return createErrorResponse_('ID is required.', '', {
        errorCode: 'PSYCHOMETRIC_ID_MISSING',
        backendStep: 'VALIDATE_ID',
      });
    }

    const person = getPsychometricPerson_(id, entityType);
    const blocked = assertCanTakePsychometric_(person, id, entityType);
    if (blocked) return blocked;

    const rows = getPsychometricQuestionRows_();
    if (!rows.length) {
      return createErrorResponse_('No active psychometric questions found.', '', {
        errorCode: 'PSYCHOMETRIC_QUESTIONS_EMPTY',
        backendStep: 'LOAD_QUESTIONS',
      });
    }

    const questions = rows.map(function (row) {
      const questionNo = Number(row['Question_No'] || 0);

      const dimOptions = ['D', 'I', 'S', 'C']
        .map(function (dim) {
          const text = String(row[dim] || '').trim();
          if (!text) return null;
          return {
            optionId: questionNo + '_' + dim,
            text: text,
          };
        })
        .filter(Boolean);

      const shuffledOptions = shuffleArray_(dimOptions);
      const labels = ['A', 'B', 'C', 'D'];

      const options = shuffledOptions.map(function (opt, index) {
        return {
          label: labels[index],
          optionId: opt.optionId,
          text: opt.text,
        };
      });

      return {
        questionNo: questionNo,
        questionText: String(row['Question_Text'] || '').trim(),
        options: options,
      };
    });

    const shuffledQuestions = shuffleArray_(questions);

    return createSuccessResponse_({
      data: {
        id: person.id,
        entityType: person.entityType,
        interviewId: person.entityType === 'Candidate' ? person.id : '',
        candidateName: person.name,
        position: person.position,
        questionCount: shuffledQuestions.length,
        questions: shuffledQuestions,
      },
    });
  } catch (error) {
    console.error('[getPsychometricQuestions] Error:', error);
    return createErrorResponse_(
      'Failed to load psychometric questions.',
      error.toString(),
      {
        errorCode: 'PSYCHOMETRIC_QUESTIONS_GET_FAILED',
        backendStep: 'GET_PSYCHOMETRIC_QUESTIONS',
      }
    );
  }
}

// ==========================================
// 5. DISC ROLE BENCHMARKS SHEET
// ==========================================

function getDiscRoleBenchmarksSheet_() {
  const ss = getLocalSpreadsheet();
  const schema = HIREOS_SHEET_SCHEMA.DISC_ROLE_BENCHMARKS;

  if (!schema) {
    throw new Error('DISC_ROLE_BENCHMARKS is missing from HIREOS_SHEET_SCHEMA.');
  }

  ensureSheetAndHeaders_(ss, schema.name, schema.headers);

  const sheet = ss.getSheetByName(schema.name);
  if (!sheet) {
    throw new Error('DISC_Role_Benchmarks sheet could not be created.');
  }

  return sheet;
}

/**
 * Active role benchmarks as objects.
 * Ranges are on the 0–100 trait-score scale.
 */
function getActiveDiscRoleBenchmarks_() {
  const sheet = getDiscRoleBenchmarksSheet_();
  const rows = getRowsAsObjects_(sheet);

  return rows
    .filter(function (row) {
      return (
        String(row['Status'] || '')
          .trim()
          .toLowerCase() === 'active'
      );
    })
    .map(function (row) {
      return {
        roleName: String(row['Role_Name'] || '').trim(),
        D_Min: Number(row['D_Min'] || 0),
        D_Max: Number(row['D_Max'] || 0),
        I_Min: Number(row['I_Min'] || 0),
        I_Max: Number(row['I_Max'] || 0),
        S_Min: Number(row['S_Min'] || 0),
        S_Max: Number(row['S_Max'] || 0),
        C_Min: Number(row['C_Min'] || 0),
        C_Max: Number(row['C_Max'] || 0),
        typicalProfiles: String(row['Typical_Profiles'] || '')
          .split(',')
          .map(function (p) {
            return p.trim();
          })
          .filter(Boolean),
      };
    })
    .filter(function (row) {
      return !!row.roleName;
    });
}

// ==========================================
// 6. ROLE FIT MATH (0–100 trait score scale)
// ==========================================
// Gap outside preferred range → dimension fit = MAX(0, 100 − Gap × penalty)
// Role fit = MIN(D,I,S,C fits)  ← bottleneck (weakest trait caps the score)
// Then optional profile match +5 / mismatch −15
// ==========================================

var UNDER_MIN_PENALTY_ = 3.0; // lacking a needed trait
var OVER_MAX_PENALTY_ = 4.0; // excess conflicting trait (stricter)
var PROFILE_MATCH_BONUS_ = 5;
var PROFILE_MISMATCH_PENALTY_ = 15;

/** Returns 0–100 for one DISC dimension vs [min, max]. */
function calculateDimensionFit_(score, minimum, maximum) {
  const value = Number(score || 0);
  const min = Number(minimum || 0);
  const max = Number(maximum || 0);

  if (value >= min && value <= max) {
    return 100;
  }

  if (value < min) {
    return Math.max(0, 100 - (min - value) * UNDER_MIN_PENALTY_);
  }

  return Math.max(0, 100 - (value - max) * OVER_MAX_PENALTY_);
}

/**
 * Role fit = weakest dimension (bottleneck).
 * Optional discProfile:
 *  - in Typical_Profiles → +5
 *  - not in list → −15
 */
function calculateRoleFit_(scores, benchmark, discProfile) {
  const dFit = calculateDimensionFit_(scores.D, benchmark.D_Min, benchmark.D_Max);
  const iFit = calculateDimensionFit_(scores.I, benchmark.I_Min, benchmark.I_Max);
  const sFit = calculateDimensionFit_(scores.S, benchmark.S_Min, benchmark.S_Max);
  const cFit = calculateDimensionFit_(scores.C, benchmark.C_Min, benchmark.C_Max);

  let fitScore = Math.min(dFit, iFit, sFit, cFit);

  if (discProfile) {
    if (roleMatchesDiscProfile_(benchmark, discProfile)) {
      fitScore = Math.min(100, fitScore + PROFILE_MATCH_BONUS_);
    } else {
      fitScore = Math.max(0, fitScore - PROFILE_MISMATCH_PENALTY_);
    }
  }

  return Math.round(fitScore);
}

function getRoleFitLabel_(score) {
  if (score >= 85) return 'Strong Fit';
  if (score >= 70) return 'Moderate Fit';
  if (score >= 50) return 'Weak Fit';
  return 'Low Fit';
}

/** Compare one score set against all active roles (ranked). */
function getRoleFitsForScores_(scores, discProfile) {
  const benchmarks = getActiveDiscRoleBenchmarks_();

  return benchmarks
    .map(function (benchmark) {
      const fitScore = calculateRoleFit_(scores, benchmark, discProfile || '');
      return {
        roleName: benchmark.roleName,
        fitScore: fitScore,
        fitLabel: getRoleFitLabel_(fitScore),
        typicalProfiles: benchmark.typicalProfiles,
      };
    })
    .sort(function (a, b) {
      return b.fitScore - a.fitScore;
    });
}

/** 20-question trait score: selections / 20 * 100 */
function calculateDiscScoresFromCounts_(counts) {
  const totalQuestions = 20;
  const d = Number(counts.D || 0);
  const i = Number(counts.I || 0);
  const s = Number(counts.S || 0);
  const c = Number(counts.C || 0);

  return {
    D: Math.round((d / totalQuestions) * 100),
    I: Math.round((i / totalQuestions) * 100),
    S: Math.round((s / totalQuestions) * 100),
    C: Math.round((c / totalQuestions) * 100),
    raw: { D: d, I: i, S: s, C: c, totalQuestions: totalQuestions },
  };
}

function normalizeProfileCode_(profile) {
  return String(profile || '').trim().toLowerCase();
}

/**
 * Normalize role names so "AI Developer" === "ai developer".
 */
function normalizeRoleNameKey_(roleName) {
  return String(roleName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roleMatchesDiscProfile_(benchmark, discProfile) {
  const target = normalizeProfileCode_(discProfile);
  if (!target) return false;

  const list = benchmark.typicalProfiles || [];
  for (var i = 0; i < list.length; i++) {
    if (normalizeProfileCode_(list[i]) === target) {
      return true;
    }
  }
  return false;
}

function mapBenchmarkRow_(row) {
  return {
    roleName: String(row['Role_Name'] || '').trim(),
    D_Min: Number(row['D_Min'] || 0),
    D_Max: Number(row['D_Max'] || 0),
    I_Min: Number(row['I_Min'] || 0),
    I_Max: Number(row['I_Max'] || 0),
    S_Min: Number(row['S_Min'] || 0),
    S_Max: Number(row['S_Max'] || 0),
    C_Min: Number(row['C_Min'] || 0),
    C_Max: Number(row['C_Max'] || 0),
    typicalProfiles: String(row['Typical_Profiles'] || '')
      .split(',')
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean),
  };
}

/**
 * Find benchmark by role name (case/spacing insensitive).
 * Checks ALL rows (any Status) so AI never creates a duplicate.
 */
function findBenchmarkByRoleName_(roleName) {
  const target = normalizeRoleNameKey_(roleName);
  if (!target) return null;

  const sheet = getDiscRoleBenchmarksSheet_();
  const rows = getRowsAsObjects_(sheet);

  for (var i = 0; i < rows.length; i++) {
    const name = String(rows[i]['Role_Name'] || '').trim();
    if (!name) continue;
    if (normalizeRoleNameKey_(name) === target) {
      return mapBenchmarkRow_(rows[i]);
    }
  }

  for (var j = 0; j < rows.length; j++) {
    const name = String(rows[j]['Role_Name'] || '').trim();
    if (!name) continue;
    const key = normalizeRoleNameKey_(name);
    if (key.indexOf(target) !== -1 || target.indexOf(key) !== -1) {
      return mapBenchmarkRow_(rows[j]);
    }
  }

  return null;
}

function getOrCreateRoleBenchmark_(roleName) {
  const existing = findBenchmarkByRoleName_(roleName);
  if (existing) return existing;

  try {
    return createRoleBenchmarkWithAI_(roleName);
  } catch (error) {
    console.error('[getOrCreateRoleBenchmark_] AI create failed:', error);
    return null;
  }
}

/**
 * Ask AI for DISC ranges for a missing role, save to DISC_Role_Benchmarks, return it.
 * Never appends if a case-insensitive match already exists.
 */
function createRoleBenchmarkWithAI_(roleName) {
  const cleanName = String(roleName || '').trim();
  if (!cleanName) return null;

  const existing = findBenchmarkByRoleName_(cleanName);
  if (existing) return existing;

  const examples = getActiveDiscRoleBenchmarks_().slice(0, 8);
  const prompt = buildDiscRoleBenchmarkPrompt_({
    roleName: cleanName,
    examples: examples,
  });
  const ai = callOpenRouterJson(prompt);

  const aiName = String(ai.roleName || cleanName).trim();
  const existingAfterAi =
    findBenchmarkByRoleName_(aiName) || findBenchmarkByRoleName_(cleanName);
  if (existingAfterAi) return existingAfterAi;

  const row = {
    Role_Name: aiName || cleanName,
    D_Min: Number(ai.D_Min),
    D_Max: Number(ai.D_Max),
    I_Min: Number(ai.I_Min),
    I_Max: Number(ai.I_Max),
    S_Min: Number(ai.S_Min),
    S_Max: Number(ai.S_Max),
    C_Min: Number(ai.C_Min),
    C_Max: Number(ai.C_Max),
    Typical_Profiles: Array.isArray(ai.Typical_Profiles)
      ? ai.Typical_Profiles.join(', ')
      : String(ai.Typical_Profiles || ''),
    Status: 'Active',
  };

  if (
    isNaN(row.D_Min) ||
    isNaN(row.D_Max) ||
    isNaN(row.I_Min) ||
    isNaN(row.I_Max) ||
    isNaN(row.S_Min) ||
    isNaN(row.S_Max) ||
    isNaN(row.C_Min) ||
    isNaN(row.C_Max)
  ) {
    throw new Error('AI returned invalid DISC ranges for role: ' + cleanName);
  }

  const sheet = getDiscRoleBenchmarksSheet_();
  appendRowByHeaders_(sheet, row);

  return mapBenchmarkRow_(row);
}

/** Always calculate fit for the applied / current position. */
function getAppliedRoleFit_(scores, appliedRoleName, discProfile) {
  const benchmark = getOrCreateRoleBenchmark_(appliedRoleName);

  if (!benchmark) {
    return {
      appliedRole: String(appliedRoleName || '').trim(),
      roleFitScore: 0,
      roleFitLabel: 'No Benchmark',
      matched: false,
    };
  }

  const fitScore = calculateRoleFit_(scores, benchmark, discProfile || '');

  return {
    appliedRole: benchmark.roleName,
    roleFitScore: fitScore,
    roleFitLabel: getRoleFitLabel_(fitScore),
    matched: true,
  };
}

// ==========================================
// 7. DISC PROFILE (12 allowed codes only)
// ==========================================
// Highest = primary
// Secondary only if within 2 selections AND neighbouring
// Neighbours: D-I, I-S, S-C, C-D
// Opposites (no secondary): D-S, I-C
// Style: primary UPPER, secondary lower → Di, iD, CS, etc.
// Allowed: D, Di, iD, I, iS, Si, S, SC, CS, C, CD, DC

var DISC_NEIGHBOURS_ = {
  D: { I: true, C: true },
  I: { D: true, S: true },
  S: { I: true, C: true },
  C: { S: true, D: true },
};

var DISC_ALLOWED_PROFILES_ = {
  D: true,
  Di: true,
  iD: true,
  I: true,
  iS: true,
  Si: true,
  S: true,
  SC: true,
  CS: true,
  C: true,
  CD: true,
  DC: true,
};

function formatDiscProfileCode_(primary, secondary) {
  if (!secondary) return primary;

  // Only these 8 blends are allowed (plus 4 singles).
  // Map primary+secondary → canonical code (fixes Id/Is/Sc/… falling back to one letter).
  var map = {
    DI: 'Di',
    ID: 'iD',
    IS: 'iS',
    SI: 'Si',
    SC: 'SC',
    CS: 'CS',
    CD: 'CD',
    DC: 'DC',
  };

  return map[String(primary) + String(secondary)] || primary;
}

/**
 * counts = { D: 7, I: 8, S: 3, C: 2 }
 * returns e.g. { profile: 'iD', primary: 'I', secondary: 'D', ... }
 *
 * Two-letter profile ONLY when:
 *  - secondary count > 0
 *  - primary − secondary ≤ 2 selections (scores are near)
 *  - primary/secondary are neighbours on the DISC circle
 * Otherwise primary only (D / I / S / C).
 */
function getDiscProfileFromCounts_(counts) {
  const dims = [
    { key: 'D', value: Number(counts.D || 0) },
    { key: 'I', value: Number(counts.I || 0) },
    { key: 'S', value: Number(counts.S || 0) },
    { key: 'C', value: Number(counts.C || 0) },
  ];

  dims.sort(function (a, b) {
    if (b.value !== a.value) return b.value - a.value;
    var order = { D: 0, I: 1, S: 2, C: 3 };
    return order[a.key] - order[b.key];
  });

  const primary = dims[0];
  const secondary = dims[1];
  var useSecondary = false;

  if (
    secondary &&
    secondary.value > 0 &&
    primary.value - secondary.value <= 2 &&
    DISC_NEIGHBOURS_[primary.key] &&
    DISC_NEIGHBOURS_[primary.key][secondary.key]
  ) {
    useSecondary = true;
  }

  var profile = useSecondary
    ? formatDiscProfileCode_(primary.key, secondary.key)
    : primary.key;

  if (!DISC_ALLOWED_PROFILES_[profile]) {
    profile = primary.key;
    useSecondary = false;
  }

  return {
    profile: profile,
    primary: primary.key,
    secondary: useSecondary ? secondary.key : '',
    primaryCount: primary.value,
    secondaryCount: useSecondary ? secondary.value : 0,
  };
}

/**
 * Math shortlist: roles whose Typical_Profiles includes the candidate profile,
 * ranked by range-based fit %. May be empty → AI fill is intentional.
 */
function getSuggestedRolesByProfile_(scores, discProfile, appliedRoleName) {
  const benchmarks = getActiveDiscRoleBenchmarks_();
  const appliedLower = String(appliedRoleName || '').trim().toLowerCase();

  return benchmarks
    .filter(function (benchmark) {
      return roleMatchesDiscProfile_(benchmark, discProfile);
    })
    .map(function (benchmark) {
      const fitScore = calculateRoleFit_(scores, benchmark, discProfile);
      return {
        roleName: benchmark.roleName,
        fitScore: fitScore,
        fitLabel: getRoleFitLabel_(fitScore),
        typicalProfiles: benchmark.typicalProfiles,
        isAppliedRole:
          benchmark.roleName.toLowerCase() === appliedLower ||
          benchmark.roleName.toLowerCase().indexOf(appliedLower) !== -1,
      };
    })
    .sort(function (a, b) {
      return b.fitScore - a.fitScore;
    });
}

// ==========================================
// 8. SCORE FROM optionIds
// ==========================================

function tallyDiscCountsFromOptionIds_(optionIds) {
  const rows = getPsychometricQuestionRows_();
  const valid = {};

  rows.forEach(function (row) {
    const qNo = Number(row['Question_No'] || 0);
    ['D', 'I', 'S', 'C'].forEach(function (dim) {
      if (String(row[dim] || '').trim()) {
        valid[qNo + '_' + dim] = dim;
      }
    });
  });

  const counts = { D: 0, I: 0, S: 0, C: 0 };
  const seenQuestions = {};
  const answers = optionIds || [];

  for (var i = 0; i < answers.length; i++) {
    const optionId = String(answers[i] || '').trim();
    const dim = valid[optionId];

    if (!dim) {
      throw new Error('Invalid optionId: ' + optionId);
    }

    const questionNo = optionId.split('_')[0];
    if (seenQuestions[questionNo]) {
      throw new Error('Duplicate answer for question: ' + questionNo);
    }

    seenQuestions[questionNo] = true;
    counts[dim] = counts[dim] + 1;
  }

  return {
    counts: counts,
    answeredCount: answers.length,
    expectedCount: rows.length,
  };
}

function calculateDiscResultFromAnswers_(optionIds, appliedRoleName) {
  const tallied = tallyDiscCountsFromOptionIds_(optionIds);
  const scores = calculateDiscScoresFromCounts_(tallied.counts);
  const profileInfo = getDiscProfileFromCounts_(tallied.counts);

  const applied = getAppliedRoleFit_(
    scores,
    appliedRoleName || '',
    profileInfo.profile
  );

  const suggested = getSuggestedRolesByProfile_(
    scores,
    profileInfo.profile,
    appliedRoleName || ''
  );

  return {
    counts: tallied.counts,
    answeredCount: tallied.answeredCount,
    expectedCount: tallied.expectedCount,
    scores: {
      D: scores.D,
      I: scores.I,
      S: scores.S,
      C: scores.C,
    },
    profile: profileInfo.profile,
    primary: profileInfo.primary,
    secondary: profileInfo.secondary,
    appliedRoleFit: applied,
    recommendedRoles: suggested,
  };
}

// ==========================================
// 9. SAVE PSYCHOMETRIC RESULT
// Frontend submits optionIds only — never trust scores.
// ==========================================

function savePsychometricResult(data) {
  try {
    const id = String((data && (data.id || data.interviewId)) || '').trim();
    const entityType = normalizeEntityType_(data && data.entityType);
    const optionIds = (data && data.optionIds) || (data && data.answers) || [];

    if (!id) {
      return createErrorResponse_('ID is required.', '', {
        errorCode: 'PSYCHOMETRIC_ID_MISSING',
        backendStep: 'VALIDATE_ID',
      });
    }

    if (!Array.isArray(optionIds) || optionIds.length === 0) {
      return createErrorResponse_('Answers are required.', '', {
        errorCode: 'PSYCHOMETRIC_ANSWERS_MISSING',
        backendStep: 'VALIDATE_ANSWERS',
      });
    }

    const person = getPsychometricPerson_(id, entityType);
    const blocked = assertCanTakePsychometric_(person, id, entityType);
    if (blocked) return blocked;

    const sheet = getPsychometricSheet_();
    const rowIndex = findPsychometricRowIndex_(sheet, id, entityType);

    // 1) Deterministic scoring
    let calc;
    try {
      calc = calculateDiscResultFromAnswers_(optionIds, person.position);
    } catch (calcError) {
      return createErrorResponse_(
        'Failed to score personality assessment.',
        calcError.toString(),
        {
          errorCode: 'PSYCHOMETRIC_SCORE_FAILED',
          backendStep: 'CALCULATE_DISC',
          id: id,
          entityType: entityType,
        }
      );
    }

    if (calc.answeredCount !== calc.expectedCount) {
      return createErrorResponse_(
        'Please answer all questions before submitting.',
        'answered=' + calc.answeredCount + ', expected=' + calc.expectedCount,
        {
          errorCode: 'PSYCHOMETRIC_INCOMPLETE_ANSWERS',
          backendStep: 'VALIDATE_ANSWER_COUNT',
          id: id,
          entityType: entityType,
        }
      );
    }

    // 2) AI summary + recommended roles
    // Math roles are a starting point; AI may refine/replace when empty or weak.
    let discSummary = '';
    let recommendedRolesForSheet = calc.recommendedRoles || [];

    try {
      const prompt = buildDiscSummaryPrompt_({
        scores: calc.scores,
        profile: calc.profile,
        appliedRole: person.position,
        appliedRoleFit: calc.appliedRoleFit,
        recommendedRoles: calc.recommendedRoles,
      });

      const ai = callOpenRouterJson(prompt);
      discSummary = String(ai.summary || '').trim();

      const aiRoles = normalizeAiRecommendedRoles_(ai.recommendedRoles);
      if (aiRoles.length) {
        recommendedRolesForSheet = aiRoles;
      } else if (!recommendedRolesForSheet.length && ai.recommendedRolesText) {
        recommendedRolesForSheet = String(ai.recommendedRolesText)
          .split(',')
          .map(function (r) {
            return { roleName: r.trim(), fitScore: '', fitLabel: '' };
          })
          .filter(function (r) {
            return !!r.roleName;
          });
      }
    } catch (aiError) {
      console.error('[savePsychometricResult] AI summary failed:', aiError);
      discSummary =
        calc.profile +
        ' profile. Applied role fit: ' +
        (calc.appliedRoleFit.roleFitScore || 0) +
        '% (' +
        (calc.appliedRoleFit.roleFitLabel || '') +
        ').';
    }

    const now = new Date().toISOString();

    const rowPayload = {
      ID: person.id,
      Entity_Type: person.entityType,
      Name: person.name,
      Email: person.email,
      WhatsApp: person.whatsapp,
      Test_Completed_At: now,
      DISC_D: calc.scores.D,
      DISC_I: calc.scores.I,
      DISC_S: calc.scores.S,
      DISC_C: calc.scores.C,
      DISC_Profile: calc.profile,
      Applied_Role: calc.appliedRoleFit.appliedRole || person.position || '',
      Role_Fit_Score: calc.appliedRoleFit.roleFitScore || 0,
      Role_Fit_Label: calc.appliedRoleFit.roleFitLabel || '',
      DISC_Summary: discSummary,
      Recommended_Roles: formatRecommendedRolesText_(recommendedRolesForSheet),
      Status: 'Completed',
      Updated_At: now,
    };

    if (rowIndex === -1) {
      rowPayload.Test_Sent_At = now;
      appendRowByHeaders_(sheet, rowPayload);
    } else {
      updateRowByHeadersAtIndex_(sheet, rowIndex, rowPayload);
    }

    // Sync profile label onto HR workbook for pending/completed checks
    try {
      if (person.entityType === 'Candidate') {
        syncPsychometricToApplicationsSheet_(person.id, calc.profile);
      } else if (person.entityType === 'Employee') {
        syncPsychometricToEmployeesSheet_(person.id, calc.profile);
      }
    } catch (syncError) {
      console.error('[savePsychometricResult] HR sheet sync failed:', syncError);
    }

    return createSuccessResponse_({
      data: {
        id: person.id,
        entityType: person.entityType,
        interviewId: person.entityType === 'Candidate' ? person.id : '',
        candidateName: person.name,
        position: person.position,
        status: 'Completed',
        discD: calc.scores.D,
        discI: calc.scores.I,
        discS: calc.scores.S,
        discC: calc.scores.C,
        discProfile: calc.profile,
        appliedRole: calc.appliedRoleFit.appliedRole || person.position || '',
        roleFitScore: calc.appliedRoleFit.roleFitScore || 0,
        roleFitLabel: calc.appliedRoleFit.roleFitLabel || '',
        discSummary: discSummary,
        recommendedRoles: recommendedRolesForSheet,
        testCompletedAt: now,
      },
    });
  } catch (error) {
    console.error('[savePsychometricResult] Error:', error);
    return createErrorResponse_(
      'Failed to save personality assessment.',
      error.toString(),
      {
        errorCode: 'PSYCHOMETRIC_SAVE_FAILED',
        backendStep: 'SAVE_PSYCHOMETRIC_RESULT',
      }
    );
  }
}

function formatRecommendedRolesText_(recommendedRoles) {
  const list = recommendedRoles || [];
  if (!list.length) return '';

  return list
    .map(function (role) {
      const name = role.roleName || role;
      const score = role.fitScore;
      const label = role.fitLabel;

      if (score == null || score === '') {
        return String(name);
      }

      return (
        String(name) +
        ' — ' +
        score +
        '%' +
        (label ? ' ' + label : '')
      );
    })
    .join('; ');
}

function normalizeAiRecommendedRoles_(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map(function (r) {
      if (!r) return null;

      if (typeof r === 'string') {
        return { roleName: r.trim(), fitScore: '', fitLabel: '', reason: '' };
      }

      const name = String(r.roleName || r.name || '').trim();
      if (!name) return null;

      return {
        roleName: name,
        fitScore: r.fitScore != null ? Number(r.fitScore) : '',
        fitLabel: String(r.fitLabel || '').trim(),
        reason: String(r.reason || '').trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

/**
 * Best-effort sync of DISC_Profile into Candidate Applications.
 * Creates a "DISC Profile" column if missing.
 */
function syncPsychometricToApplicationsSheet_(interviewId, discProfile) {
  const hrSs = SpreadsheetApp.openById(getHrSharedSpreadsheetId_());
  const appSheet = hrSs.getSheetByName('Candidate Applications');
  if (!appSheet) return;

  const appData = appSheet.getDataRange().getValues();
  if (!appData.length) return;

  const headers = appData[0].map(function (h) {
    return String(h).trim();
  });

  const intvIdCol = headers.findIndex(function (h) {
    return h.toLowerCase() === 'interview id';
  });
  if (intvIdCol === -1) return;

  let discCol = headers.findIndex(function (h) {
    return h.toLowerCase() === 'disc profile';
  });

  if (discCol === -1) {
    discCol = headers.length;
    appSheet.getRange(1, discCol + 1).setValue('DISC Profile');
  }

  const safeId = String(interviewId).trim();
  for (var i = 1; i < appData.length; i++) {
    if (String(appData[i][intvIdCol]).trim() === safeId) {
      appSheet.getRange(i + 1, discCol + 1).setValue(discProfile || '');
      break;
    }
  }
}

/**
 * Write DISC Profile onto HR Employees tab.
 * Empty = pending; filled = completed (HR bulk-send uses this).
 */
function syncPsychometricToEmployeesSheet_(employeeId, discProfile) {
  const sheet = getEmployeesSheet_();
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  if (!data.length) return;

  const headers = data[0].map(function (h) {
    return String(h).trim();
  });

  const idCol = headers.findIndex(function (h) {
    return h.toLowerCase() === 'employee id';
  });
  if (idCol === -1) return;

  let discCol = headers.findIndex(function (h) {
    return h.toLowerCase() === 'disc profile';
  });

  if (discCol === -1) {
    discCol = headers.length;
    sheet.getRange(1, discCol + 1).setValue('DISC Profile');
  }

  const safeId = String(employeeId).trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === safeId) {
      sheet.getRange(i + 1, discCol + 1).setValue(discProfile || '');
      break;
    }
  }
}

// ==========================================
// 10. WHATSAPP SEND (after interview)
// ==========================================

function sendWhatsAppMessage_(phone, text) {
  const props = PropertiesService.getScriptProperties();
  const base = props.getProperty('WAHA_BASE_URL');
  const session = props.getProperty('WAHA_SESSION');
  const apiKey = props.getProperty('WAHA_API_KEY');

  var clean = String(phone || '').replace(/\D/g, '');
  if (!clean) throw new Error('Invalid phone');
  if (clean.length === 10) clean = '91' + clean;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-Api-Key'] = apiKey;

  const res = UrlFetchApp.fetch(base + '/api/sendText', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify({
      session: session,
      chatId: clean + '@c.us',
      text: text,
    }),
    muteHttpExceptions: true,
  });

  return {
    status: res.getResponseCode(),
    body: res.getContentText(),
  };
}

/**
 * Send psychometric WhatsApp link (Candidate or Employee).
 *
 * Body: { id|interviewId, entityType?: 'Candidate'|'Employee', force?: boolean }
 *
 * Candidate rules:
 * 1. Interview Status must be Completed (unless you only use force from HR after check).
 * 2. PsychometricResults Completed → never send.
 * 3. Auto (force=false): skip if already Pending.
 * 4. HR Resend (force=true): Pending or Not Started OK.
 *
 * Employee rules:
 * - No interview check.
 * - Same Completed / Pending / force rules on PsychometricResults.
 * - Link includes ?entity=Employee
 */
function sendPsychometricTestLink(candidateIdOrData) {
  try {
    const isObj =
      candidateIdOrData && typeof candidateIdOrData === 'object';
    const id = String(
      (isObj
        ? candidateIdOrData.id ||
          candidateIdOrData.interviewId ||
          candidateIdOrData.employeeId
        : candidateIdOrData) || ''
    ).trim();
    const force = !!(isObj && candidateIdOrData.force);
    const entityType = normalizeEntityType_(
      isObj ? candidateIdOrData.entityType : 'Candidate'
    );

    if (!id) {
      return createErrorResponse_('ID is required.', '', {
        errorCode: 'PSYCHOMETRIC_ID_MISSING',
      });
    }

    // Auto-send kill switch (manual Resend with force still works)
    if (!force) {
      const auto = PropertiesService.getScriptProperties().getProperty(
        'SEND_PSYCHOMETRIC_AUTO'
      );
      if (String(auto || 'true').toLowerCase() === 'false') {
        return createSuccessResponse_({
          data: { skipped: true, reason: 'AUTO_DISABLED', entityType: entityType },
        });
      }
    }

    const person = getPsychometricPerson_(id, entityType);
    if (!person) {
      return createErrorResponse_(entityType + ' not found.', '', {
        errorCode: 'PSYCHOMETRIC_PERSON_NOT_FOUND',
        id: id,
        entityType: entityType,
      });
    }

    // Candidate only: interview must be Completed
    if (entityType === 'Candidate') {
      const interviewStatus = String(person.status || '')
        .trim()
        .toLowerCase();
      if (interviewStatus !== 'completed') {
        return createSuccessResponse_({
          data: {
            skipped: true,
            reason: 'INTERVIEW_NOT_COMPLETED',
            id: id,
            entityType: entityType,
            interviewStatus: person.status || '',
          },
        });
      }
    }

    const sheet = getPsychometricSheet_();
    const rowIndex = findPsychometricRowIndex_(sheet, id, entityType);
    const psychoStatus =
      rowIndex === -1
        ? ''
        : String(getRowObjectByHeaders_(sheet, rowIndex)['Status'] || '')
            .trim()
            .toLowerCase();

    if (psychoStatus === 'completed') {
      return createSuccessResponse_({
        data: {
          skipped: true,
          reason: 'ALREADY_COMPLETED',
          id: id,
          entityType: entityType,
        },
      });
    }

    if (!force && psychoStatus === 'pending') {
      return createSuccessResponse_({
        data: {
          skipped: true,
          reason: 'ALREADY_SENT',
          id: id,
          entityType: entityType,
        },
      });
    }

    const portalBase = (
      PropertiesService.getScriptProperties().getProperty('PSYCHOMETRIC_PORTAL_URL') ||
      'https://candidate-application-form-seven.vercel.app'
    ).replace(/\/$/, '');

    var link = portalBase + '/psychometric/' + encodeURIComponent(id);
    if (entityType === 'Employee') {
      link += '?entity=Employee';
    }

    if (!person.whatsapp) {
      return createErrorResponse_(
        'No WhatsApp / mobile number on ' + entityType.toLowerCase() + '.',
        '',
        {
          errorCode: 'PSYCHOMETRIC_NO_WHATSAPP',
          id: id,
          entityType: entityType,
        }
      );
    }

    const message =
      entityType === 'Employee'
        ? 'Hi ' +
          (person.name || 'there') +
          ',\n\n' +
          'Please take this short personality assessment (~10 minutes). Your own link:\n\n' +
          link +
          '\n\n' +
          '– American Hairline HR'
        : 'Hi ' +
          (person.name || 'there') +
          ',\n\n' +
          'Thanks for completing your interview. Please also take this short personality assessment (~10 minutes):\n\n' +
          link +
          '\n\n' +
          '– American Hairline HR';

    const wa = sendWhatsAppMessage_(person.whatsapp, message);

    if (wa.status < 200 || wa.status >= 300) {
      return createErrorResponse_(
        'WhatsApp send failed.',
        'status=' + wa.status + ' body=' + String(wa.body || '').substring(0, 300),
        {
          errorCode: 'PSYCHOMETRIC_WHATSAPP_FAILED',
          id: id,
          entityType: entityType,
        }
      );
    }

    const now = new Date().toISOString();

    const payload = {
      ID: person.id,
      Entity_Type: entityType,
      Name: person.name,
      Email: person.email,
      WhatsApp: person.whatsapp,
      Test_Sent_At: now,
      Status: 'Pending',
      Applied_Role: person.position || '',
      Updated_At: now,
    };

    if (rowIndex === -1) {
      appendRowByHeaders_(sheet, payload);
    } else {
      updateRowByHeadersAtIndex_(sheet, rowIndex, payload);
    }

    return createSuccessResponse_({
      data: {
        id: id,
        entityType: entityType,
        link: link,
        message: message,
        whatsapp: wa,
        status: 'Pending',
        resent: force,
      },
    });
  } catch (error) {
    console.error('[sendPsychometricTestLink]', error);
    return createErrorResponse_(
      'Failed to send psychometric WhatsApp.',
      error.toString(),
      { errorCode: 'PSYCHOMETRIC_SEND_FAILED' }
    );
  }
}

/**
 * Bulk-send DISC links to Active employees whose Employees!DISC Profile is empty.
 * Each employee gets their own /psychometric/{EmployeeID}?entity=Employee link.
 *
 * Optional: { force: true } to resend even if PsychometricResults is already Pending.
 */
function sendPendingEmployeePsychometricLinks(data) {
  try {
    // HR bulk action is intentional — default force so AUTO kill-switch does not block it
    const force = !(data && data.force === false);
    const sheet = getEmployeesSheet_();
    if (!sheet) {
      return createErrorResponse_('Employees sheet not found.', '', {
        errorCode: 'EMPLOYEES_SHEET_MISSING',
      });
    }

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return createSuccessResponse_({
        data: { sent: 0, skipped: 0, results: [] },
      });
    }

    const headers = values[0].map(function (h) {
      return String(h).trim();
    });
    const idCol = headers.findIndex(function (h) {
      return h.toLowerCase() === 'employee id';
    });
    const discCol = headers.findIndex(function (h) {
      return h.toLowerCase() === 'disc profile';
    });
    const statusCol = headers.findIndex(function (h) {
      return h.toLowerCase() === 'status';
    });
    const phoneCol = headers.findIndex(function (h) {
      return h.toLowerCase() === 'mobile number';
    });

    if (idCol === -1) {
      return createErrorResponse_('Employee ID column missing.', '', {
        errorCode: 'EMPLOYEE_ID_COLUMN_MISSING',
      });
    }

    // Ensure DISC Profile column exists for pending checks
    if (discCol === -1) {
      sheet.getRange(1, headers.length + 1).setValue('DISC Profile');
    }

    const results = [];
    var sent = 0;
    var skipped = 0;

    for (var i = 1; i < values.length; i++) {
      const empId = String(values[i][idCol] || '').trim();
      if (!empId) continue;

      const empStatus =
        statusCol === -1
          ? 'active'
          : String(values[i][statusCol] || '')
              .trim()
              .toLowerCase();
      if (empStatus && empStatus !== 'active') {
        skipped++;
        results.push({ id: empId, skipped: true, reason: 'NOT_ACTIVE' });
        continue;
      }

      const discProfile =
        discCol === -1 ? '' : String(values[i][discCol] || '').trim();
      if (discProfile) {
        skipped++;
        results.push({
          id: empId,
          skipped: true,
          reason: 'DISC_PROFILE_PRESENT',
        });
        continue;
      }

      const phone =
        phoneCol === -1 ? '' : String(values[i][phoneCol] || '').trim();
      if (!phone) {
        skipped++;
        results.push({ id: empId, skipped: true, reason: 'NO_PHONE' });
        continue;
      }

      const res = sendPsychometricTestLink({
        id: empId,
        entityType: 'Employee',
        force: force,
      });

      // createSuccessResponse_ / createErrorResponse_ return ContentService objects
      // in some paths — parse content if needed
      var parsed = res;
      try {
        if (res && typeof res.getContent === 'function') {
          parsed = JSON.parse(res.getContent());
        }
      } catch (e) {}

      const ok =
        parsed &&
        (parsed.status === 'success' ||
          parsed.success === true ||
          (parsed.data && !parsed.data.skipped && parsed.data.link));
      const skippedSend = parsed && parsed.data && parsed.data.skipped;

      if (skippedSend) {
        skipped++;
        results.push({
          id: empId,
          skipped: true,
          reason: parsed.data.reason || 'SKIPPED',
        });
      } else if (ok || (parsed && parsed.data && parsed.data.link)) {
        sent++;
        results.push({
          id: empId,
          sent: true,
          link: parsed.data.link,
        });
      } else {
        skipped++;
        results.push({
          id: empId,
          skipped: true,
          reason: (parsed && (parsed.message || parsed.errorCode)) || 'SEND_FAILED',
        });
      }
    }

    return createSuccessResponse_({
      data: { sent: sent, skipped: skipped, results: results },
    });
  } catch (error) {
    console.error('[sendPendingEmployeePsychometricLinks]', error);
    return createErrorResponse_(
      'Failed to bulk-send employee psychometric links.',
      error.toString(),
      { errorCode: 'EMPLOYEE_BULK_SEND_FAILED' }
    );
  }
}

// ==========================================
// 11. MANUAL TESTS (Apps Script editor only)
// ==========================================

/**
 * Test WhatsApp psychometric link WITHOUT completing the interview.
 * 1. Put a real Interview-sheet candidate ID below (must have WhatsApp)
 * 2. Select this function → Run
 * 3. Check Executions + the candidate's WhatsApp
 */
function testSendPsychometricTestLink() {
  const candidateId = 'PASTE_REAL_CANDIDATE_ID_HERE'; // Interview sheet ID

  const response = sendPsychometricTestLink({
    id: candidateId,
    entityType: 'Candidate',
    force: true, // send even if already Pending
  });

  Logger.log(response.getContent());
}

function testSendEmployeePsychometricTestLink() {
  const employeeId = 'PASTE_REAL_EMPLOYEE_ID_HERE'; // Employees!Employee ID

  const response = sendPsychometricTestLink({
    id: employeeId,
    entityType: 'Employee',
    force: true,
  });

  Logger.log(response.getContent());
}

function testSavePsychometricResult() {
  const response = savePsychometricResult({
    id: '89fdb7ef-bca9-4991-96cc-4d70842eed61',
    entityType: 'Candidate',
    optionIds: [
      '1_D',
      '2_D',
      '3_I',
      '4_D',
      '5_I',
      '6_D',
      '7_I',
      '8_D',
      '9_I',
      '10_D',
      '11_I',
      '12_D',
      '13_I',
      '14_D',
      '15_I',
      '16_S',
      '17_C',
      '18_S',
      '19_C',
      '20_I',
    ],
  });

  Logger.log(response.getContent());
}
