// --- HIREOS CENTRALIZED SCHEMA CONFIGURATION ---
const HIREOS_LOCAL_SS_PROP = 'HIREOS_LOCAL_SPREADSHEET_ID';

const HIREOS_SHEET_SCHEMA = {
  CANDIDATES: {
    name: 'Candidates',
    headers: [
      'ID',
      'Name',
      'Email',
      'WhatsApp',
      'Questions',
      'Correct Answers',
      'Topics',
      'Difficulty',
      'Candidate Answers',
      'Per Question Scores',
      'Score',
      'Tab Switches',
      'Status',
      'Timestamp',
      'Position',
      'Time Limit',
      'Submitted At',
      'Question Types',
      'Detailed Summary',
      'Assessment Type',
      'Selected ICP ID',
      'Selected ICP Role',
      'ICP Snapshot',
      'Resume Text',
      'Must Check Tools',
      'Raw Custom Questions',
      'Interview Start Time',
      'Interview End Time',
      'Audio Folder Link',
      'Final Transcript Link',
    ],
  },
  ICP_MASTER: {
    name: 'ICP_Master',
    headers: [
      'icpId',
      'roleName',
      'level',
      'department',
      'status',
      'version',
      'icpContent',
      'mandatorySkills',
      'goodToHaveSkills',
      'topTraits',
      'redFlags',
      'stabilityChecks',
      'scenarioBank',
      'scoringRubric',
      'createdAt',
      'updatedAt',
    ],
  },
  AUDIO_REVIEWS: {
    name: 'AudioReviews',
    headers: [
      'ID',
      'Candidate Name',
      'Role',
      'HR Notes',
      'Audio File Name',
      'Audio Mime Type',
      'Audio Drive File ID',
      'Audio Drive URL',
      'Transcript',
      'Transcript Model',
      'Report JSON',
      'Recommendation',
      'Final Verdict',
      'PDF Drive File ID',
      'PDF Drive URL',
      'Status',
      'Timestamp',
      'Updated At',
      'Error Message',
    ],
  },
  ANSWERS: {
    name: 'Interview Answers',
    headers: [
      'Interview ID',
      'Candidate ID',
      'Question No',
      'Question ID',
      'Question Type',
      'Question Text',
      'Browser Preview Transcript',
      'Final Transcript',
      'Cleaned Transcript',
      'Candidate Confirmed',
      'Audio File Name',
      'Audio File Link',
      'Google Drive File ID',
      'Audio Duration Seconds',
      'Word Count',
      'Retry Count',
      'STT Confidence',
      'Language Detected',
      'Answer Status',
      'AI Score',
      'AI Feedback',
      'Created At',
      'Updated At',
    ],
  },
};

/**
 * Main setup function to initialize the local spreadsheet schema.
 * RUN THIS MANUALLY in the Apps Script editor to prepare a new sheet.
 */
function setupHireOSLocalSheets() {
  const ss = getLocalSpreadsheet();
  const results = [];

  Object.keys(HIREOS_SHEET_SCHEMA).forEach((key) => {
    const schema = HIREOS_SHEET_SCHEMA[key];
    const status = ensureSheetAndHeaders_(ss, schema.name, schema.headers);
    results.push(`${schema.name}: ${status}`);
  });

  // Seed sample ICPs if sheet is new
  seedSampleICPs_(ss);

  return {
    status: 'success',
    spreadsheetUrl: ss.getUrl(),
    results: results,
  };
}

/**
 * Seed sample ICPs for demonstration only if the sheet is empty.
 */
function seedSampleICPs_(ss) {
  const sheetName = HIREOS_SHEET_SCHEMA.ICP_MASTER.name;
  const sheet = ss.getSheetByName(sheetName);

  // Safety: If sheet doesn't exist or already has data beyond header, skip seeding
  if (!sheet || sheet.getLastRow() > 1) return;

  const samples = [
    {
      icpId: 'ICP_CRM_EXEC_001',
      roleName: 'CRM Executive',
      level: 'Mid',
      department: 'Marketing',
      status: 'active',
      version: '1.0',
      icpContent:
        '# IDEAL CANDIDATE PROFILE – CRM EXECUTIVE\n\n## 1. BASIC ROLE DETAILS\n- Role Name: CRM Executive\n- Department: Marketing\n\n## 2. MAIN PURPOSE\nManage customer relationships and loyalty programs.\n\n## 7. SKILLS REQUIRED\n- HubSpot\n- Email Marketing\n- SQL',
      mandatorySkills: 'HubSpot, Email Marketing, SQL',
      topTraits: 'Customer-centric, Detail-oriented',
      redFlags: 'Poor communication',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      icpId: 'ICP_AI_DEV_001',
      roleName: 'AI Developer',
      level: 'Senior',
      department: 'Engineering',
      status: 'active',
      version: '1.0',
      icpContent:
        '# IDEAL CANDIDATE PROFILE – AI DEVELOPER\n\n## 1. BASIC ROLE DETAILS\n- Role Name: AI Developer\n- Department: Engineering\n\n## 2. MAIN PURPOSE\nBuild and optimize AI models and internal tools.\n\n## 7. SKILLS REQUIRED\n- Python\n- OpenAI API\n- LangChain',
      mandatorySkills: 'Python, OpenAI API, LangChain',
      topTraits: 'Problem solver, Fast learner',
      redFlags: 'Lack of technical depth',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  samples.forEach((sample) => {
    // Double check if ID already exists before appending
    if (findRowIndexByHeaderValue_(sheet, 'icpId', sample.icpId) === -1) {
      appendRowByHeaders_(sheet, sample);
    }
  });
}

/**
 * Ensures a sheet exists and has the correct headers without overwriting data.
 */
function ensureSheetAndHeaders_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  let status = 'Existing';

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    status = 'Created';
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    // Formatting: Bold, background color, and frozen row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f3f4f6');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  } else {
    // Check for missing headers and append them if possible (at the end)
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const missingHeaders = headers.filter((h) => !existingHeaders.includes(h));
    if (missingHeaders.length > 0) {
      const startCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
      sheet
        .getRange(1, startCol, 1, missingHeaders.length)
        .setFontWeight('bold')
        .setBackground('#fef3c7');
      status = 'Updated (Missing headers added)';
    }
  }

  return status;
}

// --- ORIGINAL CONFIGURATION (REFACTORED TO USE SCHEMA) ---
const OPENROUTER_API_KEY =
  PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY') ||
  'YOUR_OPENROUTER_API_KEY_HERE';

const SHEET_NAME = HIREOS_SHEET_SCHEMA.CANDIDATES.name;
const AUDIO_REVIEW_SHEET_NAME = HIREOS_SHEET_SCHEMA.AUDIO_REVIEWS.name;
const DRIVE_ROOT_FOLDER_NAME = 'HireOS';
const AUDIO_DRIVE_FOLDER_NAME = 'Audio Files';
const PDF_DRIVE_FOLDER_NAME = 'Audio Review PDFs';
const DEFAULT_REPORT_MODEL = 'openai/gpt-4o-mini';
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

// Keep legacy ID for compatibility if needed, but prefer new LOCAL ID
const HIREOS_SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty('HIREOS_SPREADSHEET_ID') || '';

const NEW_SYS_CONFIG = {
  FOLDER_NAME: 'HireOS AI Interview Audio Proof - New STT System',
  FOLDER_PROP: 'HIREOS_NEW_AUDIO_DRIVE_FOLDER_ID',
  TABS: {
    ANSWERS: HIREOS_SHEET_SCHEMA.ANSWERS.name,
  },
};

/**
 * ORPHAN/LEGACY: One-time setup function to initialize the new system infrastructure.
 * This function is currently not referenced by ACTION_HANDLERS or the frontend.
 */
function setupNewSTTProofSystem_LEGACY() {
  const ss = getNewSystemSpreadsheet();
  const folder = getNewSystemFolder();

  return {
    status: 'success',
    spreadsheetUrl: ss.getUrl(),
    folderUrl: folder.getUrl(),
    message: 'New STT Proof System infrastructure initialized successfully.',
  };
}

const HR_QUESTIONS = [
  {
    question: 'Where are you from?',
    correctAnswer: 'Expect a clear and direct location answer.',
    topic: 'HR Screening',
    difficulty: 'medium',
    questionType: 'hr',
  },
  {
    question: 'Are you currently working somewhere, or have you already left your last job?',
    correctAnswer: 'Expect a clear current status with timing.',
    topic: 'HR Screening',
    difficulty: 'medium',
    questionType: 'hr',
  },
  {
    question: 'What is your role there, or when did you leave your last job?',
    correctAnswer: 'Expect a role summary or a clear leaving timeline.',
    topic: 'HR Screening',
    difficulty: 'medium',
    questionType: 'hr',
  },
  {
    question: 'Why are you looking to change your job?',
    correctAnswer:
      'Look for a specific reason such as growth, role fit, salary, or learning, not only blaming the previous company.',
    topic: 'HR Screening',
    difficulty: 'hard',
    questionType: 'hr',
  },
  {
    question: 'What are the top 3 things you are really good at? Give one real example.',
    correctAnswer: 'Look for 2 to 3 specific strengths with at least one concrete example.',
    topic: 'HR Screening',
    difficulty: 'hard',
    questionType: 'hr',
  },
  {
    question:
      'When work becomes difficult or there is pressure, what do you usually do? Give one real example.',
    correctAnswer: 'Look for a real situation, the action they took, and the outcome.',
    topic: 'HR Screening',
    difficulty: 'hard',
    questionType: 'hr',
  },
  {
    question: 'What salary are you expecting next?',
    correctAnswer: 'Expect a realistic salary number or range with some justification.',
    topic: 'HR Screening',
    difficulty: 'medium',
    questionType: 'hr',
  },
  {
    question: 'If things go well, how long do you see yourself working with us?',
    correctAnswer: 'Expect a clear long-term commitment answer and what makes them stay.',
    topic: 'HR Screening',
    difficulty: 'medium',
    questionType: 'hr',
  },
];

const ASSEMBLYAI_API_KEY =
  PropertiesService.getScriptProperties().getProperty('ASSEMBLYAI_API_KEY') ||
  'YOUR_ASSEMBLYAI_API_KEY_HERE';

function setupHireOSAudioReview() {
  const ss = getSpreadsheet();
  const audioSheet = getOrCreateAudioReviewSheet(ss);
  const folders = getAudioStorageFolders();
  const probeDoc = DocumentApp.create(`HireOS Auth Probe ${Date.now()}`);
  probeDoc.getBody().appendParagraph('Authorization probe for HireOS audio review setup.');
  probeDoc.saveAndClose();
  const probeFile = DriveApp.getFileById(probeDoc.getId());
  const probePdf = probeFile.getAs(MimeType.PDF);
  if (!probePdf) {
    throw new Error('Could not generate PDF authorization probe.');
  }
  probeFile.setTrashed(true);

  return {
    status: 'success',
    sheetName: audioSheet.getName(),
    rootFolderName: folders.rootFolder.getName(),
    rootFolderUrl: folders.rootFolder.getUrl(),
    audioFolderUrl: folders.audioFolder.getUrl(),
    pdfFolderUrl: folders.pdfFolder.getUrl(),
  };
}
