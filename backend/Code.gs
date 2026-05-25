// --- CENTRALIZED RESPONSE HELPERS ---
function createSuccessResponse_(data) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success', ...data })
  ).setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse_(message, details = '', diagnostics = {}) {
  const payload = {
    status: 'error',
    message,
    details,
    ...diagnostics,
  };
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function parseRequest_(e) {
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('Invalid JSON payload');
  }
}

const ACTION_HANDLERS = {
  getAssemblyAITemporaryToken: (data) => getAssemblyAITemporaryToken(data),
  startInterviewSession: (data) => legacyDoPost_(null, 'startInterviewSession', data),
  processAnswerAudio: (data) => legacyDoPost_(null, 'processAnswerAudio', data),
  saveConfirmedAnswer: (data) => legacyDoPost_(null, 'saveConfirmedAnswer', data),
  saveInterviewAuditEvent: (data) => legacyDoPost_(null, 'saveInterviewAuditEvent', data),
  submitInterview: (data) => legacyDoPost_(null, 'submitInterview', data),
  getTest: (data) => legacyDoPost_(null, 'getTest', data),
  submitTest: (data) => legacyDoPost_(null, 'submitTest', data),
  setupNewHireOSInterviewSystem: (data) =>
    legacyDoPost_(null, 'setupNewHireOSInterviewSystem', data),
  generateICPTest: (data) =>
    createErrorResponse_(
      'ICP Culture-fit generation is currently disabled. Please use CV-based technical test.'
    ),
  evaluateAudioTurn: (data) =>
    createSuccessResponse_({ text: 'Dummy audio evaluation response for unused endpoint.' }),
  getActiveICPs: (data) => legacyDoPost_(null, 'getActiveICPs', data),
  getAllICPs: (data) => legacyDoPost_(null, 'getAllICPs', data),
  getICPById: (data) => legacyDoPost_(null, 'getICPById', data),
  saveICP: (data) => legacyDoPost_(null, 'saveICP', data),
};

function doPost(e) {
  try {
    const data = parseRequest_(e);
    const action = data.action;

    // Use dispatch map for aliases or specific new handlers
    if (ACTION_HANDLERS[action]) {
      return ACTION_HANDLERS[action](data);
    }

    // Fallback to legacy routing for existing actions
    return legacyDoPost_(e, action, data);
  } catch (error) {
    return createErrorResponse_(error.message, error.toString());
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'success', message: 'HireOS API is running safely!' })
  ).setMimeType(ContentService.MimeType.JSON);
}
