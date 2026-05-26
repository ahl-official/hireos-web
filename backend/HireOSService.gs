/**
 * Returns the Drive folder for the NEW system audio proof files.
 */
function getOrCreateNewInterviewAudioFolder_(interviewId, candidateId, candidateName) {
  const props = PropertiesService.getScriptProperties();
  let rootFolderId = props.getProperty(NEW_SYS_CONFIG.FOLDER_PROP);
  let rootFolder;

  if (rootFolderId) {
    try {
      rootFolder = DriveApp.getFolderById(rootFolderId);
    } catch (e) {
      rootFolderId = null;
    }
  }

  if (!rootFolderId) {
    const folders = DriveApp.getFoldersByName(NEW_SYS_CONFIG.FOLDER_NAME);
    if (folders.hasNext()) {
      rootFolder = folders.next();
    } else {
      rootFolder = DriveApp.createFolder(NEW_SYS_CONFIG.FOLDER_NAME);
    }
    props.setProperty(NEW_SYS_CONFIG.FOLDER_PROP, rootFolder.getId());
  }

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = now.toLocaleString('default', { month: 'long' });

  // Year folder
  let yearFolder;
  const yearFolders = rootFolder.getFoldersByName(year);
  if (yearFolders.hasNext()) {
    yearFolder = yearFolders.next();
  } else {
    yearFolder = rootFolder.createFolder(year);
  }

  // Month folder
  let monthFolder;
  const monthFolders = yearFolder.getFoldersByName(month);
  if (monthFolders.hasNext()) {
    monthFolder = monthFolders.next();
  } else {
    monthFolder = yearFolder.createFolder(month);
  }

  // Interview folder
  const safeName = (candidateName || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
  const interviewFolderName = `${safeName}__${candidateId}__${interviewId.substring(0, 8)}`;

  let interviewFolder;
  const interviewFolders = monthFolder.getFoldersByName(interviewFolderName);
  if (interviewFolders.hasNext()) {
    interviewFolder = interviewFolders.next();
  } else {
    interviewFolder = monthFolder.createFolder(interviewFolderName);
    interviewFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  return interviewFolder;
}

/**
 * Helper logs
 */
function saveSystemLog_(logType, functionName, interviewId, candidateId, message, details = '') {
  return;
}

function saveAudioUploadLog_(
  interviewId,
  candidateId,
  questionNo,
  fileName,
  fileId,
  fileUrl,
  status,
  errorMessage = ''
) {
  return;
}

function saveTranscriptionLog_(
  interviewId,
  candidateId,
  questionNo,
  sttProvider,
  transcript,
  confidence,
  language,
  status,
  errorMessage = ''
) {
  return;
}

function saveAIEvaluationLog_(
  interviewId,
  candidateId,
  questionNo,
  questionType,
  transcript,
  score,
  feedback,
  status,
  errorMessage = ''
) {
  return;
}

function saveInterviewAuditEvent(
  interviewId,
  candidateId,
  eventType,
  questionNo,
  details,
  tabSwitches,
  micStatus,
  browserName,
  deviceInfo,
  userAgent
) {
  if (tabSwitches !== undefined && tabSwitches > 0) {
    try {
      const ss = getLocalSpreadsheet();
      const candidateSheet = getOrCreateSheet(ss);
      updateRowByHeaders_(candidateSheet, 'ID', candidateId, {
        'Tab Switches': tabSwitches,
      });
    } catch (e) {
      // Ignore errors silently
    }
  }
  return;
}

/**
 * Public action to get an AssemblyAI temporary token.
 * This is called from the frontend via ACTION_HANDLERS.
 */
function getAssemblyAITemporaryToken(data) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty('ASSEMBLYAI_API_KEY');

    if (!apiKey || apiKey === 'YOUR_ASSEMBLYAI_API_KEY_HERE') {
      throw new Error(
        'AssemblyAI API key is missing. Please configure ASSEMBLYAI_API_KEY in Script Properties.'
      );
    }

    const tokenUrl = 'https://api.assemblyai.com/v2/realtime/token';
    const options = {
      method: 'post',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({ expires_in: 3600 }),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(tokenUrl, options);
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() !== 200 && response.getResponseCode() !== 201) {
      throw new Error(
        'AssemblyAI Token Error (' +
          response.getResponseCode() +
          '): ' +
          (result.error || response.getContentText())
      );
    }

    return createSuccessResponse_({
      token: result.token,
      expires_in: 3600,
    });
  } catch (e) {
    saveSystemLog_(
      'ERROR',
      'getAssemblyAITemporaryToken',
      '',
      '',
      'Failed to generate AssemblyAI token',
      e.toString()
    );
    return createErrorResponse_(e.message, e.toString());
  }
}

/**
 * Logs an interview-specific audit event (tab switches, retries, etc.)
 */
function logInterviewAudit(interviewId, eventType, details, sessionInfo = '') {
  try {
    const ss = getNewSystemSpreadsheet_();
    const sheet = ss.getSheetByName(HIREOS_SHEET_SCHEMA.AUDIT.name);
    if (sheet) {
      appendRowByHeaders_(sheet, {
        'Interview ID': interviewId,
        'Event Type': eventType,
        'Event Time': new Date().toISOString(),
        Details: details + (sessionInfo ? ` | Info: ${sessionInfo}` : ''),
      });
    }
  } catch (e) {
    saveSystemLog_(
      'ERROR',
      'logInterviewAudit',
      interviewId,
      '',
      'Failed to log interview audit',
      e.toString()
    );
  }
}

/**
 * ORPHAN/LEGACY: Saves an audio file to the new system Drive folder and returns its URL.
 * This function is currently not referenced by the active interview flow or ACTION_HANDLERS.
 */
function saveAudioProof_LEGACY(interviewId, questionIndex, audioBase64, mimeType = 'audio/webm') {
  try {
    const folder = getNewSystemFolder();
    const format = mimeType.split('/')[1] || 'webm';
    const fileName = `proof_${interviewId}_q${questionIndex}_${Date.now()}.${format}`;
    const audioBytes = Utilities.base64Decode(audioBase64);
    const blob = Utilities.newBlob(audioBytes, mimeType, fileName);

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return file.getUrl();
  } catch (e) {
    saveSystemLog_(
      'ERROR',
      'saveAudioProof_LEGACY',
      interviewId,
      '',
      'Failed to save audio proof',
      e.toString()
    );
    return 'ERROR: ' + e.toString();
  }
}
function buildTechQuestions(aiData, count) {
  return {
    questions: Array.isArray(aiData?.questions) ? aiData.questions.slice(0, count) : [],
    correctAnswers: Array.isArray(aiData?.correct_answers)
      ? aiData.correct_answers.slice(0, count)
      : [],
    topics: Array.isArray(aiData?.topics) ? aiData.topics.slice(0, count) : [],
    difficulty: Array.isArray(aiData?.difficulty) ? aiData.difficulty.slice(0, count) : [],
  };
}

function parseStoredValue(value, fallback) {
  if (value == null || value === '') return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeListInput(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      // Fall through to newline/comma splitting for freeform input.
    }

    return trimmed
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [String(value).trim()].filter(Boolean);
}

function sanitizeFileNamePart(value, fallback) {
  const clean = String(value || fallback || 'file')
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || fallback || 'file';
}

function getAudioFormat(mimeType, fileName) {
  const mime = String(mimeType || '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  const ext = String(fileName || '')
    .toLowerCase()
    .split('.')
    .pop();
  const mimeMap = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/m4a': 'm4a',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/webm': 'webm',
    'audio/webm;codecs=opus': 'webm',
  };
  const extMap = {
    mp3: 'mp3',
    wav: 'wav',
    m4a: 'm4a',
    aac: 'aac',
    ogg: 'ogg',
    flac: 'flac',
    webm: 'webm',
  };
  return mimeMap[mime] || extMap[ext] || 'mp3';
}

function callOpenRouterJson(messages, model) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'YOUR_OPENROUTER_API_KEY_HERE') {
    throw new Error(
      'OpenRouter API key is missing. Set OPENROUTER_API_KEY in Apps Script Script Properties or replace the placeholder in Code.gs.'
    );
  }

  const payload = {
    model: model || DEFAULT_REPORT_MODEL,
    messages: messages,
    response_format: { type: 'json_object' },
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + OPENROUTER_API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch('https://openrouter.ai/api/v1/chat/completions', options);
  const responseText = response.getContentText();
  const json = JSON.parse(responseText);

  if (json.error) {
    throw new Error('OpenRouter API Error: ' + json.error.message);
  }

  if (response.getResponseCode() >= 400) {
    throw new Error('OpenRouter API Error: ' + responseText);
  }

  return parseAIResponse(json.choices[0].message.content);
}

function buildAudioInterviewReport(record) {
  const messages = [
    {
      role: 'system',
      content: `You are an expert HR interviewer and hiring evaluator. Review an interview transcript and produce a structured internal hiring report.

Rules:
1. Use only evidence reasonably supported by the transcript and HR notes.
2. Keep the tone professional, practical, and decision-oriented.
3. Call out communication quality, confidence, clarity, ownership, and role fit.
4. If the transcript is thin or low quality, explicitly say evidence is limited.
5. Return only JSON.`,
    },
    {
      role: 'user',
      content: `Create a detailed audio interview evaluation for this candidate.

Candidate Name: ${record.name}
Role: ${record.role}
HR Notes: ${record.hrNotes || '(none)'}
Transcript:
${record.transcript}

Return a JSON object with this exact shape:
{
  "candidateProfile": "90-140 word profile summary",
  "summary": "120-180 word hiring summary",
  "communicationAssessment": "50-90 word communication assessment",
  "roleFit": "40-80 word fit assessment",
  "greenFlags": [
    { "title": "short label", "detail": "1-2 sentence explanation" }
  ],
  "redFlags": [
    { "title": "short label", "detail": "1-2 sentence explanation" }
  ],
  "recommendation": "short HR recommendation",
  "finalVerdict": "Proceed / Hold / Reject"
}

Requirements:
- Return 3 to 6 green flags and 2 to 5 red flags.
- Keep titles concise.
- Focus on interview evidence, not generic assumptions.
- Make the output suitable for a PDF evaluation report.`,
    },
  ];

  return callOpenRouterJson(messages, DEFAULT_REPORT_MODEL);
}

function buildAudioReviewResponse(rowObj) {
  const reportJson = parseStoredValue(rowObj['Report JSON'], {});
  return {
    id: rowObj['ID'],
    name: rowObj['Candidate Name'],
    role: rowObj['Role'],
    hrNotes: rowObj['HR Notes'],
    audioFileName: rowObj['Audio File Name'],
    audioMimeType: rowObj['Audio Mime Type'],
    audioDriveFileId: rowObj['Audio Drive File ID'],
    audioDriveUrl: rowObj['Audio Drive URL'],
    transcript: rowObj['Transcript'],
    transcriptModel: rowObj['Transcript Model'],
    report: reportJson,
    recommendation: rowObj['Recommendation'],
    finalVerdict: rowObj['Final Verdict'],
    pdfDriveFileId: rowObj['PDF Drive File ID'],
    pdfDriveUrl: rowObj['PDF Drive URL'],
    status: rowObj['Status'],
    timestamp: rowObj['Timestamp'],
    updatedAt: rowObj['Updated At'],
    errorMessage: rowObj['Error Message'] || '',
  };
}

// Helper to cleanly parse OpenRouter markdown JSON output
function parseAIResponse(responseText) {
  const clean = responseText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  return JSON.parse(clean);
}

function callOpenRouter(messages) {
  return callOpenRouterJson(messages, DEFAULT_REPORT_MODEL);
}

function legacyDoPost_(e, action, data) {
  try {
    // data and action passed from new doPost

    // ==========================================
    // DATABASE ACTIONS (MOVE ABOVE INITIALIZATION)
    // ==========================================
    if (action === 'getTest') {
      const id = data.id;
      if (!id) {
        return createErrorResponse_('Candidate ID is missing from request', '', {
          errorCode: 'CANDIDATE_ID_MISSING',
          backendStep: 'PARSE_ID',
        });
      }

      let ss;
      try {
        ss = getNewSystemSpreadsheet_();
      } catch (e) {
        saveSystemLog_(
          'ERROR',
          'getTest',
          '',
          id,
          'Spreadsheet not found during getTest',
          e.toString()
        );
        return createErrorResponse_(e.message, e.toString(), {
          errorCode: e.errorCode || 'UNKNOWN_BACKEND_ERROR',
          backendStep: 'SPREADSHEET_LOOKUP',
          diagnostics: e.diagnostics || getSpreadsheetDiagnostics_(),
        });
      }

      const sheet = getOrCreateSheet(ss);
      const rowIndex = findRowIndexByHeaderValue_(sheet, 'ID', id);
      if (rowIndex !== -1) {
        const row = getRowObjectByHeaders_(sheet, rowIndex);
        const questionsJson = row['Questions'];

        if (!questionsJson) {
          return createErrorResponse_('Questions data is missing for this candidate', '', {
            errorCode: 'QUESTIONS_MISSING',
            backendStep: 'DATA_LOOKUP',
            candidateId: id,
          });
        }

        try {
          JSON.parse(questionsJson);
        } catch (e) {
          return createErrorResponse_('Questions data is not valid JSON', e.toString(), {
            errorCode: 'QUESTIONS_JSON_INVALID',
            backendStep: 'JSON_PARSE',
            candidateId: id,
          });
        }

        return createSuccessResponse_({
          name: row['Name'] || '',
          email: row['Email'] || '',
          questions: questionsJson,
          answers: row['Correct Answers'],
          topics: row['Topics'],
          difficulty: row['Difficulty'],
          timeLimit: row['Time Limit'],
          questionTypes: row['Question Types'] || '',
          status: row['Status'] || 'Pending',
          assessmentType: row['Assessment Type'] || 'normal',
          selectedIcpRole: row['Selected ICP Role'] || '',
        });
      }
      return createErrorResponse_('Candidate not found in spreadsheet', '', {
        errorCode: 'CANDIDATE_NOT_FOUND',
        backendStep: 'ROW_LOOKUP',
        candidateId: id,
      });
    }

    if (action === 'getActiveICPs') {
      return createSuccessResponse_({ icps: getActiveICPs_() });
    }

    if (action === 'getAllICPs') {
      return createSuccessResponse_({ icps: getAllICPs_() });
    }

    if (action === 'getICPById') {
      return createSuccessResponse_({ icp: getICPById_(data.icpId) });
    }

    if (action === 'saveICP') {
      return createSuccessResponse_({ icp: saveICP_(data) });
    }

    if (action === 'addCandidate') {
      const id = Utilities.getUuid();
      const timestamp = new Date().toISOString();
      const ss = getSpreadsheet();
      const sheet = getOrCreateSheet(ss);
      appendRowByHeaders_(sheet, {
        ID: id,
        Name: data.name,
        Email: data.email || '',
        WhatsApp: data.wp,
        Questions: data.questions,
        'Correct Answers': data.answers,
        Topics: data.topics || '',
        Difficulty: data.difficulty || '',
        'Candidate Answers': '',
        'Per Question Scores': '',
        Score: '',
        'Tab Switches': 0,
        Status: 'Pending',
        Timestamp: timestamp,
        Position: data.position || '',
        'Time Limit': data.timeLimit || 15,
        'Submitted At': '',
        'Question Types': data.questionTypes || '',
        'Assessment Type': data.assessmentType || 'normal',
        'Selected ICP ID': data.selectedIcpId || '',
        'Selected ICP Role': data.selectedIcpRole || '',
        'ICP Snapshot': data.icpSnapshot || '',
        'Resume Text': data.resumeText || '',
        'Must Check Tools': data.mustCheckTools || '',
        'Raw Custom Questions': data.rawCustomQuestions || '',
      });
      return createSuccessResponse_({ data: { id: id } });
    }

    if (action === 'submitTest') {
      const id = data.id;
      const ss = getSpreadsheet();
      const sheet = getOrCreateSheet(ss);
      const success = updateRowByHeaders_(sheet, 'ID', id, {
        'Candidate Answers': data.candidateAnswers,
        'Per Question Scores': data.perQuestionScores || '',
        Score: data.score,
        'Tab Switches': data.tabSwitches,
        Status: data.status,
        'Submitted At': new Date().toISOString(),
      });
      if (success) return createSuccessResponse_({});
      return createErrorResponse_('Test not found');
    }

    // ==========================================
    // NEW STT PROOF SYSTEM ACTIONS
    // ==========================================
    if (action === 'startInterviewSession') {
      const {
        candidateId,
        candidateName,
        candidateEmail,
        candidatePhone,
        roleApplied,
        totalQuestions,
      } = data;

      // 1. Validate Payload
      if (!candidateId || !candidateName) {
        return createErrorResponse_('Missing required session data', '', {
          errorCode: 'SESSION_PAYLOAD_INVALID',
          backendStep: 'SESSION_PAYLOAD_VALIDATE',
        });
      }

      // 2. Spreadsheet Lookup
      let ss;
      try {
        ss = getNewSystemSpreadsheet_();
      } catch (e) {
        saveSystemLog_(
          'ERROR',
          'startInterviewSession',
          '',
          candidateId,
          'Spreadsheet lookup failed',
          e.toString()
        );
        return createErrorResponse_(e.message, e.toString(), {
          errorCode: e.errorCode || 'SPREADSHEET_NOT_FOUND',
          backendStep: 'SESSION_SPREADSHEET_LOOKUP',
          diagnostics: getSpreadsheetDiagnostics_(),
        });
      }

      // 3. Initialize Session
      const interviewId = Utilities.getUuid();
      const timestamp = new Date().toISOString();
      try {
        const candidateSheet = getOrCreateSheet(ss);
        updateRowByHeaders_(candidateSheet, 'ID', candidateId, {
          Status: 'In Progress',
          'Interview Start Time': timestamp,
        });

        saveInterviewAuditEvent(
          interviewId,
          candidateId,
          'INTERVIEW_STARTED',
          '',
          'Candidate started interview session'
        );
        return createSuccessResponse_({ interviewId });
      } catch (e) {
        return createErrorResponse_('Failed to initialize session database entry', e.toString(), {
          errorCode: 'SESSION_WRITE_FAILED',
          backendStep: 'SESSION_STATUS_UPDATE',
        });
      }
    }

    if (action === 'processAnswerAudio') {
      const {
        interviewId,
        candidateId,
        candidateName,
        questionNo,
        questionText,
        audioBase64,
        mimeType,
        browserPreviewTranscript,
      } = data;
      const folder = getOrCreateNewInterviewAudioFolder_(interviewId, candidateId, candidateName);

      saveSystemLog_(
        'DEBUG',
        'processAnswerAudio',
        interviewId,
        candidateId,
        'Processing audio start',
        `Base64 length: ${audioBase64?.length}, MimeType: ${mimeType}`
      );

      const cleanMimeType = mimeType.split(';')[0].trim();
      const format = cleanMimeType.split('/')[1] || 'webm';
      const fileName = `Q${String(questionNo).padStart(2, '0')}_Answer_${new Date().getTime()}.${format}`;

      let audioUrl = '';
      let fileId = '';
      try {
        const audioBytes = Utilities.base64Decode(audioBase64);
        saveSystemLog_(
          'DEBUG',
          'processAnswerAudio',
          interviewId,
          candidateId,
          'Audio decoded',
          `Byte length: ${audioBytes.length}`
        );
        const blob = Utilities.newBlob(audioBytes, cleanMimeType, fileName);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        audioUrl = file.getUrl();
        fileId = file.getId();
        saveAudioUploadLog_(
          interviewId,
          candidateId,
          questionNo,
          fileName,
          fileId,
          audioUrl,
          'SUCCESS'
        );
      } catch (e) {
        saveAudioUploadLog_(
          interviewId,
          candidateId,
          questionNo,
          fileName,
          '',
          '',
          'FAILED',
          e.toString()
        );
        return createResponse({ status: 'error', message: 'Failed to save audio proof' });
      }

      let assemblyAiResult;
      try {
        assemblyAiResult = transcribeWithAssemblyAI_(
          audioBase64,
          mimeType,
          interviewId,
          candidateId
        );
        saveTranscriptionLog_(
          interviewId,
          candidateId,
          questionNo,
          'AssemblyAI Best',
          assemblyAiResult.transcript,
          assemblyAiResult.confidence,
          'en',
          'SUCCESS'
        );

        return createResponse({
          status: 'success',
          audio: {
            fileId,
            fileName,
            fileUrl: audioUrl,
            folderId: folder.getId(),
            folderUrl: folder.getUrl(),
          },
          transcription: assemblyAiResult,
        });
      } catch (e) {
        saveSystemLog_(
          'ERROR',
          'processAnswerAudio',
          interviewId,
          candidateId,
          'AssemblyAI Error',
          e.toString()
        );
        saveTranscriptionLog_(
          interviewId,
          candidateId,
          questionNo,
          'AssemblyAI Best',
          '',
          0,
          'en',
          'FAILED',
          e.toString()
        );
        return createResponse({
          status: 'error',
          message: 'Transcription failed: ' + e.message,
          debug: e.toString(),
        });
      }
    }

    if (action === 'saveConfirmedAnswer') {
      const ss = getNewSystemSpreadsheet_();
      const sheetTabName = HIREOS_SHEET_SCHEMA.ANSWERS.name;
      ensureSheetAndHeaders_(ss, sheetTabName, HIREOS_SHEET_SCHEMA.ANSWERS.headers);
      const sheet = ss.getSheetByName(sheetTabName);
      const timestamp = new Date().toISOString();

      appendRowByHeaders_(sheet, {
        'Interview ID': data.interviewId,
        'Candidate ID': data.candidateId,
        'Question No': data.questionNo,
        'Question ID': data.questionId,
        'Question Type': data.questionType,
        'Question Text': data.questionText,
        'Browser Preview Transcript': data.browserPreviewTranscript || '',
        'Final Transcript': data.finalTranscript,
        'Cleaned Transcript': data.cleanedTranscript || '',
        'Candidate Confirmed': data.candidateConfirmed || 'Yes',
        'Audio File Name': data.audioFileName || '',
        'Audio File Link': data.audioFileLink || '',
        'Google Drive File ID': data.driveFileId || '',
        'Audio Duration Seconds': data.audioDurationSeconds || 0,
        'Word Count': 0, // Placeholder
        'Retry Count': data.retryCount || 0,
        'STT Confidence': data.sttConfidence || 0,
        'Language Detected': data.languageDetected || 'en',
        'Answer Status': data.answerStatus || 'Confirmed',
        'AI Score': 0,
        'AI Feedback': '',
        'Created At': timestamp,
        'Updated At': timestamp,
      });

      saveInterviewAuditEvent(
        data.interviewId,
        data.candidateId,
        'TRANSCRIPT_CONFIRMED',
        data.questionNo,
        `Candidate confirmed transcript for Q${data.questionNo}`
      );
      return createResponse({ status: 'success' });
    }

    if (action === 'saveInterviewAuditEvent') {
      const {
        interviewId,
        candidateId,
        eventType,
        questionNo,
        details,
        tabSwitches,
        micStatus,
        browserName,
        deviceInfo,
        userAgent,
      } = data;
      if (tabSwitches !== undefined && tabSwitches > 0) {
        const ss = getNewSystemSpreadsheet_();
        const candidateSheet = getOrCreateSheet(ss);
        updateRowByHeaders_(candidateSheet, 'ID', candidateId, {
          'Tab Switches': tabSwitches,
        });
      }
      return createSuccessResponse_({});
    }

    if (action === 'submitInterview') {
      const { interviewId, candidateId, candidateName } = data;
      const ss = getNewSystemSpreadsheet_();

      // 1. Gather all answers
      const answersTabName = HIREOS_SHEET_SCHEMA.ANSWERS.name;
      ensureSheetAndHeaders_(ss, answersTabName, HIREOS_SHEET_SCHEMA.ANSWERS.headers);
      const answersSheet = ss.getSheetByName(answersTabName);

      const rows = answersSheet.getDataRange().getValues();
      const headers = rows[0];
      const interviewAnswers = rows
        .slice(1)
        .filter((r) => r[0] === interviewId)
        .map((r) => {
          let obj = {};
          headers.forEach((h, i) => (obj[h] = r[i]));
          return obj;
        });

      if (interviewAnswers.length === 0) {
        saveSystemLog_(
          'ERROR',
          'submitInterview',
          interviewId,
          candidateId,
          'No confirmed answers found for this interview ID'
        );
        return createErrorResponse_(
          'No confirmed answers found to grade. Please ensure you have answered and confirmed at least one question.'
        );
      }

      // 2. Fetch ICP Snapshot if available
      let icpSnapshot = null;
      try {
        const candidateSheet = getOrCreateSheet(ss);
        const cRowIdx = findRowIndexByHeaderValue_(candidateSheet, 'ID', candidateId);
        if (cRowIdx !== -1) {
          const cRow = getRowObjectByHeaders_(candidateSheet, cRowIdx);
          icpSnapshot = parseStoredValue(cRow['ICP Snapshot'], null);
        }
      } catch (e) {
        saveSystemLog_(
          'WARN',
          'submitInterview',
          interviewId,
          candidateId,
          'Failed to fetch candidate ICP snapshot',
          e.toString()
        );
      }

      // 3. Generate JSON & Drive File
      const finalJson = {
        interviewId,
        candidateId,
        candidateName,
        answers: interviewAnswers.map((a) => ({
          questionNo: a['Question No'],
          questionText: a['Question Text'],
          finalTranscript: a['Cleaned Transcript'] || a['Final Transcript'],
          audioFileLink: a['Audio File Link'],
          durationSeconds: a['Audio Duration Seconds'],
          retryCount: a['Retry Count'],
          confidence: a['STT Confidence'],
        })),
      };

      let finalTranscriptLink = '';
      let folder;
      try {
        folder = getOrCreateNewInterviewAudioFolder_(interviewId, candidateId, candidateName);
        const jsonBlob = Utilities.newBlob(
          JSON.stringify(finalJson, null, 2),
          'final_transcript.json',
          'application/json'
        );
        const jsonFile = folder.createFile(jsonBlob);
        jsonFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        finalTranscriptLink = jsonFile.getUrl();
      } catch (e) {
        saveSystemLog_(
          'ERROR',
          'submitInterview',
          interviewId,
          candidateId,
          'Failed to save final JSON to Drive',
          e.toString()
        );
        // Continue anyway if grading might still work
      }

      // 4. AI Grading
      const gradePromptData = interviewAnswers.map((a) => ({
        question: a['Question Text'],
        answer: a['Cleaned Transcript'] || a['Final Transcript'],
      }));

      const messages = icpSnapshot
        ? buildICPGradingPrompt_(gradePromptData, icpSnapshot)
        : buildGeneralGradingPrompt_(gradePromptData);

      let gradeResult = { overall_score: 0, per_question_scores: [] };
      try {
        gradeResult = callOpenRouterJson(messages);
      } catch (e) {
        saveSystemLog_(
          'ERROR',
          'submitInterview',
          interviewId,
          candidateId,
          'AI Grading Failed',
          e.toString()
        );
      }

      // Log AI Evaluation
      try {
        interviewAnswers.forEach((a, i) => {
          const scoreInfo = gradeResult.per_question_scores[i] || { score: 0, feedback: '' };
          saveAIEvaluationLog_(
            interviewId,
            candidateId,
            a['Question No'],
            a['Question Type'],
            a['Cleaned Transcript'] || a['Final Transcript'],
            scoreInfo.score,
            scoreInfo.feedback,
            'SUCCESS'
          );
        });
      } catch (e) {
        saveSystemLog_(
          'WARN',
          'submitInterview',
          interviewId,
          candidateId,
          'Failed to log AI evaluation rows',
          e.toString()
        );
      }

      // 5. Update Candidates Sheet
      const now = new Date().toISOString();

      const candidateAnswersList = interviewAnswers.map(
        (a) => a['Cleaned Transcript'] || a['Final Transcript'] || ''
      );

      const updateData = {
        Status: 'Completed',
        Score: gradeResult.overall_score,
        'Submitted At': now,
        'Interview End Time': now,
        'Candidate Answers': JSON.stringify(candidateAnswersList),
        'Per Question Scores': JSON.stringify(gradeResult.per_question_scores || []),
      };

      if (folder) updateData['Audio Folder Link'] = folder.getUrl();
      if (finalTranscriptLink) updateData['Final Transcript Link'] = finalTranscriptLink;

      try {
        const candidateSheet = getOrCreateSheet(ss);
        updateRowByHeaders_(candidateSheet, 'ID', candidateId, updateData);
      } catch (e) {
        // Ignore errors silently
      }

      saveInterviewAuditEvent(
        interviewId,
        candidateId,
        'INTERVIEW_COMPLETED',
        '',
        'Interview fully submitted and graded'
      );
      return createSuccessResponse_({ gradeResult });
    }

    if (action === 'setupNewHireOSInterviewSystem') {
      return createResponse(setupHireOSLocalSheets());
    }

    // ==========================================
    // AI ACTIONS
    // ==========================================

    if (action === 'generateQuestions') {
      const isIcp = data.assessmentType === 'icp';
      const icp = isIcp ? getICPById_(data.selectedIcpId) : null;
      const customQuestions = normalizeListInput(data.customQuestions);

      let techQuestions = [];
      let techAnswers = [];
      let techTopics = [];
      let techDifficulty = [];
      let techTypes = [];

      if (isIcp && icp) {
        // --- NEW ICP MODE LOGIC (FULL TEXT) ---
        const messages = buildICPQuestionGenerationPrompt_(icp, data.cvText, data.mustCheckSkills);
        let aiData;
        try {
          aiData = callOpenRouterJson(messages);
        } catch (e) {
          aiData = { questions: [], correct_answers: [], difficulty: [], topics: [] };
        }

        techQuestions = Array.isArray(aiData?.questions) ? aiData.questions : [];
        techAnswers = Array.isArray(aiData?.correct_answers) ? aiData.correct_answers : [];
        techTopics = Array.isArray(aiData?.topics) ? aiData.topics : [];
        techDifficulty = Array.isArray(aiData?.difficulty) ? aiData.difficulty : [];
        techTypes = techQuestions.map(() => 'icp_probe');

        // Fallback if AI fails to return 4 questions
        while (techQuestions.length < 4) {
          const idx = techQuestions.length;
          const fallbacks = ['Skill Fit', 'Scenario', 'Trait Check', 'Culture Fit'];
          techQuestions.push(
            `Could you provide more detail on your experience related to the ${fallbacks[idx] || 'role'} requirements?`
          );
          techAnswers.push('Expect a detailed professional response aligned with the ICP.');
          techTopics.push(fallbacks[idx] || 'General Fit');
          techDifficulty.push('medium');
          techTypes.push('icp_fallback');
        }
      } else {
        // --- NORMAL MODE LOGIC ---
        const targetTechCount = 4;
        const messages = buildNormalQuestionGenerationPrompt_(data, targetTechCount);

        let aiData;
        try {
          aiData = callOpenRouter(messages);
        } catch (e) {
          aiData = { questions: [], correct_answers: [], difficulty: [], topics: [] };
        }

        techQuestions = Array.isArray(aiData?.questions) ? aiData.questions : [];
        techAnswers = Array.isArray(aiData?.correct_answers) ? aiData.correct_answers : [];
        techTopics = Array.isArray(aiData?.topics) ? aiData.topics : [];
        techDifficulty = Array.isArray(aiData?.difficulty) ? aiData.difficulty : [];

        if (techQuestions.length < targetTechCount) {
          const fallbacks = [
            `Can you explain a complex technical challenge you faced while working as a ${data.position || 'Professional'} and how you solved it?`,
            `Which tools or libraries mentioned in your CV are you most comfortable with, and why?`,
            `How do you ensure the quality and performance of the code or systems you build?`,
            `If you had to learn a new technology for this ${data.position || 'role'} in one week, what would be your strategy?`,
          ];
          while (techQuestions.length < targetTechCount) {
            const idx = techQuestions.length;
            techQuestions.push(fallbacks[idx] || fallbacks[0]);
            techAnswers.push(
              'Expect a detailed explanation of their process, problem-solving skills, and technical depth.'
            );
            techTopics.push('Technical Experience');
            techDifficulty.push('medium');
          }
        }
        techQuestions = techQuestions.slice(0, targetTechCount);
        techAnswers = techAnswers.slice(0, targetTechCount);
        techTopics = techTopics.slice(0, targetTechCount);
        techDifficulty = techDifficulty.slice(0, targetTechCount);
        techTypes = techQuestions.map(() => 'technical');
      }

      // Final Combine
      const finalQuestions = HR_QUESTIONS.map((q) => q.question)
        .concat(techQuestions)
        .concat(customQuestions);
      const finalAnswers = HR_QUESTIONS.map((q) => q.correctAnswer)
        .concat(techAnswers)
        .concat(
          customQuestions.map(
            () =>
              'Candidate specific answer (Custom Question). Evaluate based on relevance and clarity.'
          )
        );
      const finalTopics = HR_QUESTIONS.map((q) => q.topic)
        .concat(techTopics)
        .concat(customQuestions.map(() => 'Custom'));
      const finalDifficulty = HR_QUESTIONS.map((q) => q.difficulty)
        .concat(techDifficulty)
        .concat(customQuestions.map(() => 'medium'));
      const finalTypes = HR_QUESTIONS.map((q) => q.questionType)
        .concat(techTypes)
        .concat(customQuestions.map(() => 'custom'));

      const combined = {
        questions: finalQuestions,
        correct_answers: finalAnswers,
        topics: finalTopics,
        difficulty: finalDifficulty,
        questionTypes: finalTypes,
        hrQuestionCount: HR_QUESTIONS.length,
        techQuestionCount: techQuestions.length,
        customQuestionCount: customQuestions.length,
        icpSnapshot: icp ? JSON.stringify(icp) : null,
        assessmentType: isIcp ? 'icp' : 'normal',
        timeLimit: Number(data.timeLimit || 15),
      };

      return createResponse({ status: 'success', data: combined });
    }

    if (action === 'gradeTest') {
      const questionsData = data.questions.map((q, i) => ({
        question: q,
        topic: data.topics[i] || `Question ${i + 1}`,
        candidate_answer: data.candidateAnswers[i] || '(no answer given)',
        question_type:
          data.questionTypes?.[i] || (i < (data.hrQuestionCount || 0) ? 'hr' : 'technical'),
      }));

      const messages = buildGeneralGradingPrompt_(questionsData);
      const aiData = callOpenRouter(messages);
      return createResponse({ status: 'success', data: aiData });
    }

    if (action === 'generateDetailedSummary') {
      const candidateId = data.candidateId;
      const candidateSheet = getOrCreateSheet(getSpreadsheet());
      const cRowIdx = findRowIndexByHeaderValue_(candidateSheet, 'ID', candidateId);
      let icpSnapshot = null;
      if (cRowIdx !== -1) {
        const cRow = getRowObjectByHeaders_(candidateSheet, cRowIdx);
        icpSnapshot = parseStoredValue(cRow['ICP Snapshot'], null);
      }

      const questionsData = data.questions.map((q, i) => ({
        question: q,
        topic: data.topics[i] || `Question ${i + 1}`,
        candidate_answer: data.candidateAnswers[i] || '(no answer given)',
        feedback: data.perQuestionScores[i]?.feedback || '',
        score: data.perQuestionScores[i]?.score || 0,
        question_type: data.questionTypes?.[i] || 'technical',
      }));

      const messages = buildDetailedReportPrompt_(questionsData, icpSnapshot);
      const aiResult = callOpenRouter(messages);
      return createResponse({ status: 'success', data: aiResult });
    }

    if (action === 'regenerateReport') {
      const id = data.id;
      const ss = getSpreadsheet();
      const sheet = getOrCreateSheet(ss);
      const rowIndex = findRowIndexByHeaderValue_(sheet, 'ID', id);
      if (rowIndex !== -1) {
        const r = getRowObjectByHeaders_(sheet, rowIndex);
        const parseStored = (value) => {
          if (value == null || value === '') return [];
          if (Array.isArray(value)) return value;
          try {
            return JSON.parse(value);
          } catch {
            return [];
          }
        };

        const questions = parseStored(r['Questions']);
        const correctAnswers = parseStored(r['Correct Answers']);
        const topics = parseStored(r['Topics']);
        const difficulty = parseStored(r['Difficulty']);
        const candidateAnswers = parseStored(r['Candidate Answers']);
        const questionTypes = parseStored(r['Question Types']);

        let score = Number(r['Score']) || 0;
        let perQuestionScores = parseStored(r['Per Question Scores']);

        // Healing: If candidate answers are empty, try to fetch them from the ANSWERS sheet
        if (candidateAnswers.length === 0) {
          try {
            const answersTabName = HIREOS_SHEET_SCHEMA.ANSWERS.name;
            const answersSheet = ss.getSheetByName(answersTabName);
            if (answersSheet) {
              const rows = answersSheet.getDataRange().getValues();
              const headers = rows[0];
              const cIdIdx = headers.indexOf('Candidate ID');
              const qNoIdx = headers.indexOf('Question No');
              const transcriptIdx = headers.indexOf('Cleaned Transcript');
              const finalTranscriptIdx = headers.indexOf('Final Transcript');
              
              if (cIdIdx !== -1) {
                const foundAnswers = rows.slice(1).filter(row => row[cIdIdx] === id);
                if (foundAnswers.length > 0) {
                  foundAnswers.sort((a, b) => Number(a[qNoIdx]) - Number(b[qNoIdx]));
                  foundAnswers.forEach(row => {
                    const ans = row[transcriptIdx] || row[finalTranscriptIdx] || '';
                    candidateAnswers.push(ans);
                  });
                  
                  updateRowByHeaders_(sheet, 'ID', id, {
                    'Candidate Answers': JSON.stringify(candidateAnswers)
                  });
                }
              }
            }
          } catch(e) {
            Logger.log('Healing failed: ' + e.toString());
          }
        }

        if (questions.length > 0 && candidateAnswers.length > 0) {
          try {
            const questionsData = questions.map((q, idx) => ({
              question: q,
              topic: topics[idx] || `Question ${idx + 1}`,
              correct_answer: correctAnswers[idx],
              candidate_answer: candidateAnswers[idx] || '(no answer given)',
              question_type: questionTypes?.[idx] || 'technical',
            }));

            const messages = [
              {
                role: 'system',
                content:
                  'You are a fair and thorough interviewer evaluator. Grade candidate answers fairly. For HR questions, grade clarity, honesty, responsibility, commitment, and relevance. For technical questions, grade technical accuracy and understanding. Be lenient on exact wording but strict on factually wrong answers.',
              },
              {
                role: 'user',
                content: `Evaluate these candidate answers.\n\n${JSON.stringify(questionsData, null, 2)}\n\nFor each question, provide:\n- "score": a number from 0 to 10\n- "feedback": one sentence explaining why\n\nReturn JSON with:\n- "overall_score": 0-100\n- "per_question_scores": array of {score, feedback}`,
              },
            ];

            const gradeResult = callOpenRouter(messages);
            score = Number(gradeResult.overall_score || score || 0);
            perQuestionScores = gradeResult.per_question_scores || perQuestionScores || [];
            updateRowByHeaders_(sheet, 'ID', id, {
              'Per Question Scores': JSON.stringify(perQuestionScores),
              Score: score,
            });
          } catch (gradeErr) {
            Logger.log('Re-grade failed: ' + gradeErr.toString());
          }
        }

        return createSuccessResponse_({
          data: {
            id: r['ID'],
            name: r['Name'],
            email: r['Email'],
            wp: r['WhatsApp'],
            questions: JSON.stringify(questions),
            correctAnswers: JSON.stringify(correctAnswers),
            topics: JSON.stringify(topics),
            difficulty: JSON.stringify(difficulty),
            candidateAnswers: JSON.stringify(candidateAnswers),
            perQuestionScores: JSON.stringify(perQuestionScores),
            score: score,
            tabSwitches: r['Tab Switches'],
            status: r['Status'],
            timestamp: r['Timestamp'],
            position: r['Position'] || '',
            timeLimit: r['Time Limit'] || 15,
            submittedAt: r['Submitted At'] || '',
            questionTypes: JSON.stringify(questionTypes),
          },
        });
      }
      return createErrorResponse_('Candidate not found');
    }

    if (action === 'processAudioReview') {
      if (!data.name || !data.role) {
        return createErrorResponse_('Candidate name and role are required.');
      }
      const hasTranscript = !!String(data.transcript || '').trim();
      const hasAudio = !!data.audioBase64;
      if (!hasTranscript && !hasAudio) {
        return createErrorResponse_('Transcript or audio file is required.');
      }

      const ss = getSpreadsheet();
      const audioReviewSheet = getOrCreateAudioReviewSheet(ss);
      const id = Utilities.getUuid();
      const timestamp = new Date().toISOString();
      appendRowByHeaders_(audioReviewSheet, {
        ID: id,
        'Candidate Name': data.name,
        Role: data.role,
        'HR Notes': data.hrNotes || '',
        'Audio File Name': data.audioFileName || '',
        'Audio Mime Type': data.audioMimeType || '',
        Status: 'Processing',
        Timestamp: timestamp,
        'Updated At': timestamp,
      });

      const rowIndex = findRowIndexByHeaderValue_(audioReviewSheet, 'ID', id);

      try {
        let audioFileId = '';
        let audioFileUrl = '';
        let safeAudioName = data.audioFileName || '';
        let transcript = String(data.transcript || '').trim();

        if (hasAudio) {
          const audioBytes = Utilities.base64Decode(data.audioBase64);
          if (audioBytes.length > MAX_AUDIO_BYTES) {
            return createErrorResponse_(
              'Audio file is too large. Please upload a file smaller than 20MB.'
            );
          }

          const format = getAudioFormat(data.audioMimeType, data.audioFileName);
          safeAudioName =
            data.audioFileName ||
            `${sanitizeFileNamePart(data.name, 'candidate')}-${sanitizeFileNamePart(data.role, 'role')}-${Date.now()}.${format}`;
        }

        const report = buildAudioInterviewReport({
          name: data.name,
          role: data.role,
          hrNotes: data.hrNotes || '',
          transcript: transcript,
        });

        const updatedAt = new Date().toISOString();
        updateRowByHeaders_(audioReviewSheet, 'ID', id, {
          'Audio File Name': safeAudioName,
          'Audio Drive File ID': audioFileId,
          'Audio Drive URL': audioFileUrl,
          Transcript: transcript,
          'Transcript Model': 'web-speech-api',
          'Report JSON': JSON.stringify(report),
          Recommendation: report.recommendation || '',
          'Final Verdict': report.finalVerdict || '',
          Status: 'Completed',
          'Updated At': updatedAt,
        });

        const updatedRow = getRowObjectByHeaders_(audioReviewSheet, rowIndex);
        return createSuccessResponse_({ data: buildAudioReviewResponse(updatedRow) });
      } catch (err) {
        updateRowByHeaders_(audioReviewSheet, 'ID', id, {
          Status: 'Error',
          'Updated At': new Date().toISOString(),
          'Error Message': err.toString(),
        });
        return createErrorResponse_(err.toString());
      }
    }

    if (action === 'getAllAudioReviews') {
      const ss = getSpreadsheet();
      const audioReviewSheet = getOrCreateAudioReviewSheet(ss);
      const data = audioReviewSheet.getDataRange().getValues();
      const headers = data[0];
      const headerMap = {};
      headers.forEach((h, i) => (headerMap[h] = i));

      const reviews = [];
      for (let i = 1; i < data.length; i++) {
        const r = data[i];
        const rowObj = {};
        headers.forEach((h, idx) => (rowObj[h] = r[idx]));
        reviews.push(buildAudioReviewResponse(rowObj));
      }
      return createSuccessResponse_({ data: reviews.reverse() });
    }

    if (action === 'getAudioReviewDetails') {
      const id = data.id;
      const ss = getSpreadsheet();
      const audioReviewSheet = getOrCreateAudioReviewSheet(ss);
      const rowIndex = findRowIndexByHeaderValue_(audioReviewSheet, 'ID', id);
      if (rowIndex !== -1) {
        const rowObj = getRowObjectByHeaders_(audioReviewSheet, rowIndex);
        return createSuccessResponse_({ data: buildAudioReviewResponse(rowObj) });
      }
      return createErrorResponse_('Audio review not found');
    }

    if (action === 'regenerateAudioReview') {
      const id = data.id;
      const ss = getSpreadsheet();
      const audioReviewSheet = getOrCreateAudioReviewSheet(ss);
      const rowIndex = findRowIndexByHeaderValue_(audioReviewSheet, 'ID', id);
      if (rowIndex !== -1) {
        const rowObj = getRowObjectByHeaders_(audioReviewSheet, rowIndex);
        const transcript = rowObj['Transcript'];
        if (!transcript) {
          return createErrorResponse_('Transcript not found for this audio review.');
        }

        try {
          const report = buildAudioInterviewReport({
            name: rowObj['Candidate Name'],
            role: rowObj['Role'],
            hrNotes: rowObj['HR Notes'] || '',
            transcript: transcript,
          });

          const updatedAt = new Date().toISOString();
          updateRowByHeaders_(audioReviewSheet, 'ID', id, {
            'Report JSON': JSON.stringify(report),
            Recommendation: report.recommendation || '',
            'Final Verdict': report.finalVerdict || '',
            Status: 'Completed',
            'Updated At': updatedAt,
            'Error Message': '',
          });

          const refreshedRow = getRowObjectByHeaders_(audioReviewSheet, rowIndex);
          return createSuccessResponse_({ data: buildAudioReviewResponse(refreshedRow) });
        } catch (err) {
          updateRowByHeaders_(audioReviewSheet, 'ID', id, {
            Status: 'Error',
            'Updated At': new Date().toISOString(),
            'Error Message': err.toString(),
          });
          return createErrorResponse_(err.toString());
        }
      }
      return createErrorResponse_('Audio review not found');
    }

    if (action === 'getAllCandidates') {
      const ss = getSpreadsheet();
      const sheet = getOrCreateSheet(ss);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const headerMap = {};
      headers.forEach((h, i) => (headerMap[h] = i));

      const candidates = [];
      for (let i = 1; i < data.length; i++) {
        const r = data[i];

        // Ensure dates are strings for React/JSON serialization
        const rawTime = r[headerMap['Timestamp']];
        const timestampStr =
          rawTime instanceof Date ? rawTime.toISOString() : String(rawTime || '');

        const rawSubmit = r[headerMap['Submitted At']];
        const submittedAtStr =
          rawSubmit instanceof Date ? rawSubmit.toISOString() : String(rawSubmit || '');

        candidates.push({
          id: r[headerMap['ID']],
          name: r[headerMap['Name']],
          email: r[headerMap['Email']],
          wp: r[headerMap['WhatsApp']],
          score: r[headerMap['Score']],
          tabSwitches: r[headerMap['Tab Switches']],
          status: r[headerMap['Status']],
          timestamp: timestampStr,
          position: r[headerMap['Position']] || '',
          timeLimit: r[headerMap['Time Limit']] || 15,
          submittedAt: submittedAtStr,
          assessmentType: r[headerMap['Assessment Type']] || 'normal',
        });
      }
      return createSuccessResponse_({ data: candidates.reverse() });
    }

    if (action === 'getCandidateDetails') {
      const id = data.id;
      const ss = getSpreadsheet();
      const sheet = getOrCreateSheet(ss);
      const rowIndex = findRowIndexByHeaderValue_(sheet, 'ID', id);
      if (rowIndex !== -1) {
        const r = getRowObjectByHeaders_(sheet, rowIndex);
        return createSuccessResponse_({
          candidate: {
            id: r['ID'],
            name: r['Name'],
            email: r['Email'],
            wp: r['WhatsApp'],
            questions: r['Questions'],
            correctAnswers: r['Correct Answers'],
            topics: r['Topics'],
            difficulty: r['Difficulty'],
            candidateAnswers: r['Candidate Answers'],
            perQuestionScores: r['Per Question Scores'],
            score: r['Score'],
            tabSwitches: r['Tab Switches'],
            status: r['Status'],
            timestamp: r['Timestamp'],
            position: r['Position'] || '',
            timeLimit: r['Time Limit'] || 15,
            submittedAt: r['Submitted At'] || '',
            questionTypes: r['Question Types'] || '',
            detailedSummary: r['Detailed Summary'] || '',
          },
        });
      }
      return createErrorResponse_('Candidate not found');
    }

    if (action === 'deleteCandidate') {
      const id = data.id;
      const ss = getSpreadsheet();
      const sheet = getOrCreateSheet(ss);
      const rowIndex = findRowIndexByHeaderValue_(sheet, 'ID', id);
      if (rowIndex !== -1) {
        sheet.deleteRow(rowIndex);
        return createSuccessResponse_({});
      }
      return createErrorResponse_('Candidate not found');
    }

    if (action === 'deleteCandidates') {
      const ids = data.ids || [];
      const ss = getSpreadsheet();
      const sheet = getOrCreateSheet(ss);
      const headerMap = getHeaderMap_(sheet);
      const idCol = headerMap['ID'];
      const rows = sheet.getDataRange().getValues();
      let deleted = 0;
      // Loop backwards to preserve row indices when deleting
      for (let i = rows.length - 1; i >= 1; i--) {
        if (ids.includes(rows[i][idCol - 1])) {
          sheet.deleteRow(i + 1);
          deleted++;
        }
      }
      return createSuccessResponse_({ deleted });
    }

    if (action === 'saveCandidateSummary') {
      const candidateId = data.candidateId;
      const summaryData = data.summary; // JSON string or object
      const ss = getSpreadsheet();
      const sheet = getOrCreateSheet(ss);
      const success = updateRowByHeaders_(sheet, 'ID', candidateId, {
        'Detailed Summary':
          typeof summaryData === 'string' ? summaryData : JSON.stringify(summaryData),
      });
      if (success) return createSuccessResponse_({ data: { saved: true } });
      return createErrorResponse_('Candidate not found');
    }

    return createResponse({ status: 'error', message: 'Invalid action' });
  } catch (error) {
    return createResponse({ status: 'error', message: error.toString() });
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * Calculates a simple word-based similarity score between two texts.
 * Used to compare Browser STT vs Cloud STT quality.
 */
function calculateTextMatch(text1, text2) {
  if (!text1 || !text2) return 0;

  const clean = (text) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

  const w1 = clean(text1);
  const w2 = clean(text2);

  if (w1.length === 0 || w2.length === 0) return 0;

  const intersection = w1.filter((word) => w2.includes(word));
  const uniqueIntersection = [...new Set(intersection)];

  // Basic Jaccard-like similarity focused on word presence
  return (intersection.length / Math.max(w1.length, w2.length)) * 100;
}

/**
 * Helper for batch transcribing audio using AssemblyAI REST API.
 * Uses Script Properties: ASSEMBLYAI_API_KEY.
 */
function transcribeWithAssemblyAI_(
  audioBase64,
  mimeType = 'audio/webm',
  interviewId = '',
  candidateId = ''
) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('ASSEMBLYAI_API_KEY');

  if (!apiKey || apiKey === 'YOUR_ASSEMBLYAI_API_KEY_HERE') {
    throw new Error('AssemblyAI API key is missing. Set ASSEMBLYAI_API_KEY in Script Properties.');
  }

  const audioBytes = Utilities.base64Decode(audioBase64);
  saveSystemLog_(
    'DEBUG',
    'transcribeWithAssemblyAI_',
    interviewId,
    candidateId,
    'Starting AssemblyAI flow',
    `Bytes length: ${audioBytes.length}, Mime: ${mimeType}`
  );

  // 1. Upload
  const uploadUrlEndpoint = 'https://api.assemblyai.com/v2/upload';
  const uploadOptions = {
    method: 'post',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/octet-stream',
    },
    payload: audioBytes,
    muteHttpExceptions: true,
  };

  let uploadResponse;
  try {
    uploadResponse = UrlFetchApp.fetch(uploadUrlEndpoint, uploadOptions);
  } catch (e) {
    throw new Error('AssemblyAI upload request failed: ' + e.toString());
  }

  const uploadResult = JSON.parse(uploadResponse.getContentText());
  if (uploadResponse.getResponseCode() !== 200) {
    saveSystemLog_(
      'ERROR',
      'transcribeWithAssemblyAI_',
      interviewId,
      candidateId,
      'AssemblyAI Upload Failed',
      uploadResponse.getContentText()
    );
    throw new Error(
      'AssemblyAI Upload Error: ' + (uploadResult.error || uploadResponse.getContentText())
    );
  }

  const audioUrl = uploadResult.upload_url;
  saveSystemLog_(
    'DEBUG',
    'transcribeWithAssemblyAI_',
    interviewId,
    candidateId,
    'AssemblyAI Upload Success',
    `URL: ${audioUrl}`
  );

  // 2. Transcribe
  const transcribeEndpoint = 'https://api.assemblyai.com/v2/transcript';
  const transcribeOptions = {
    method: 'post',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({
      audio_url: audioUrl,
      // speech_models is now mandatory as an array.
      // "universal-1" was base, "universal-2" was enhanced.
      // "universal-3-pro" is their latest flagship model.
      speech_models: ['universal-3-pro'],
      language_code: 'en',
    }),
    muteHttpExceptions: true,
  };

  const transcribeResponse = UrlFetchApp.fetch(transcribeEndpoint, transcribeOptions);
  const transcribeResult = JSON.parse(transcribeResponse.getContentText());

  if (transcribeResponse.getResponseCode() !== 200) {
    saveSystemLog_(
      'ERROR',
      'transcribeWithAssemblyAI_',
      interviewId,
      candidateId,
      'AssemblyAI Start Failed',
      transcribeResponse.getContentText()
    );
    throw new Error(
      'AssemblyAI Transcribe Error: ' +
        (transcribeResult.error || transcribeResponse.getContentText())
    );
  }

  const transcriptId = transcribeResult.id;
  saveSystemLog_(
    'DEBUG',
    'transcribeWithAssemblyAI_',
    interviewId,
    candidateId,
    'AssemblyAI Processing Started',
    `Transcript ID: ${transcriptId}`
  );

  // 3. Poll
  const pollEndpoint = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
  const pollOptions = {
    method: 'get',
    headers: { Authorization: apiKey },
    muteHttpExceptions: true,
  };

  let status = 'queued';
  let finalResult = null;
  let attempts = 0;
  const MAX_ATTEMPTS = 60; // 3 minutes total

  while (status !== 'completed' && status !== 'error' && attempts < MAX_ATTEMPTS) {
    Utilities.sleep(3000);
    attempts++;

    const pollResponse = UrlFetchApp.fetch(pollEndpoint, pollOptions);
    finalResult = JSON.parse(pollResponse.getContentText());
    status = finalResult.status;

    if (attempts % 5 === 0) {
      saveSystemLog_(
        'DEBUG',
        'transcribeWithAssemblyAI_',
        interviewId,
        candidateId,
        'AssemblyAI Polling',
        `Attempt: ${attempts}, Status: ${status}`
      );
    }
  }

  if (status === 'error') {
    saveSystemLog_(
      'ERROR',
      'transcribeWithAssemblyAI_',
      interviewId,
      candidateId,
      'AssemblyAI Processing Error',
      finalResult.error
    );
    throw new Error('AssemblyAI Processing Error: ' + finalResult.error);
  }

  if (status !== 'completed') {
    saveSystemLog_(
      'ERROR',
      'transcribeWithAssemblyAI_',
      interviewId,
      candidateId,
      'AssemblyAI Timeout',
      `Status: ${status}`
    );
    throw new Error('AssemblyAI Transcription Timed Out after 3 minutes.');
  }

  saveSystemLog_(
    'DEBUG',
    'transcribeWithAssemblyAI_',
    interviewId,
    candidateId,
    'AssemblyAI Completed',
    `Text length: ${finalResult.text?.length || 0}, Duration: ${finalResult.audio_duration || 0}s`
  );

  return {
    transcript: finalResult.text || '',
    confidence: finalResult.confidence || 0,
    audioDuration: finalResult.audio_duration || 0,
    provider: 'assemblyai',
  };
}

/**
 * ICP MASTER DATA HELPERS
 */
function getActiveICPs_() {
  const ss = getLocalSpreadsheet();
  const sheet = ss.getSheetByName(HIREOS_SHEET_SCHEMA.ICP_MASTER.name);
  if (!sheet) return [];

  const data = getRowsAsObjects_(sheet);
  return data
    .filter((row) => row.status === 'active')
    .map((row) => ({
      icpId: row.icpId,
      roleName: row.roleName,
      level: row.level,
      department: row.department,
      version: row.version,
      status: row.status,
    }));
}

function getAllICPs_() {
  const ss = getLocalSpreadsheet();
  const sheet = ss.getSheetByName(HIREOS_SHEET_SCHEMA.ICP_MASTER.name);
  if (!sheet) return [];

  return getRowsAsObjects_(sheet);
}

function getICPById_(icpId) {
  const ss = getLocalSpreadsheet();
  const sheet = ss.getSheetByName(HIREOS_SHEET_SCHEMA.ICP_MASTER.name);
  if (!sheet) return null;

  const rowIndex = findRowIndexByHeaderValue_(sheet, 'icpId', icpId);
  if (rowIndex === -1) return null;

  return getRowObjectByHeaders_(sheet, rowIndex);
}

function saveICP_(data) {
  const ss = getLocalSpreadsheet();
  const sheet = ss.getSheetByName(HIREOS_SHEET_SCHEMA.ICP_MASTER.name);
  if (!sheet) throw new Error('ICP_Master sheet not found. Please run setup.');

  const now = new Date().toISOString();
  let icpId = data.icpId;
  const isNew = !icpId;

  if (isNew) {
    icpId = `ICP_${String(data.roleName || 'NEW')
      .replace(/\s+/g, '_')
      .toUpperCase()}_${Date.now()}`;
  }

  // Ensure all schema columns are present to avoid appendRow errors
  const payload = {
    icpId: icpId,
    roleName: data.roleName || 'New Role',
    level: data.level || 'Not Specified',
    department: data.department || 'HR/Admin',
    status: data.status || 'active',
    version: data.version || '1.0',
    icpContent: data.icpContent || '',
    mandatorySkills: data.mandatorySkills || '',
    goodToHaveSkills: data.goodToHaveSkills || '',
    topTraits: data.topTraits || '',
    redFlags: data.redFlags || '',
    stabilityChecks: data.stabilityChecks || '',
    scenarioBank: data.scenarioBank || '',
    scoringRubric: data.scoringRubric || '',
    updatedAt: now,
  };

  if (isNew) {
    payload.createdAt = now;
    appendRowByHeaders_(sheet, payload);
  } else {
    updateRowByHeaders_(sheet, 'icpId', icpId, payload);
  }

  return payload;
}
