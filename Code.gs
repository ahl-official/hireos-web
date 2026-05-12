// IMPORTANT: Replace this with your actual OpenRouter API Key or set it in Script Properties.
const OPENROUTER_API_KEY = PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY') || 'YOUR_OPENROUTER_API_KEY_HERE';

const SHEET_NAME = 'Candidates';
const AUDIO_REVIEW_SHEET_NAME = 'AudioReviews';
const DRIVE_ROOT_FOLDER_NAME = 'HireOS';
const AUDIO_DRIVE_FOLDER_NAME = 'Audio Files';
const PDF_DRIVE_FOLDER_NAME = 'Audio Review PDFs';
const DEFAULT_REPORT_MODEL = 'openai/gpt-4o-mini';
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const HIREOS_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('HIREOS_SPREADSHEET_ID') || '';

// Column index reference (0-based):
// 0:ID, 1:Name, 2:Email, 3:WhatsApp, 4:Questions, 5:CorrectAnswers,
// 6:Topics, 7:Difficulty, 8:CandidateAnswers, 9:PerQuestionScores,
// 10:Score, 11:TabSwitches, 12:Status, 13:Timestamp, 14:Position, 15:TimeLimit, 16:SubmittedAt, 17:QuestionTypes, 18:DetailedSummary

const HR_QUESTIONS = [
  {
    question: 'Where are you from?',
    correctAnswer: 'Expect a clear and direct location answer.',
    topic: 'HR Screening',
    difficulty: 'medium',
    questionType: 'hr'
  },
  {
    question: 'Are you currently working somewhere, or have you already left your last job?',
    correctAnswer: 'Expect a clear current status with timing.',
    topic: 'HR Screening',
    difficulty: 'medium',
    questionType: 'hr'
  },
  {
    question: 'What is your role there, or when did you leave your last job?',
    correctAnswer: 'Expect a role summary or a clear leaving timeline.',
    topic: 'HR Screening',
    difficulty: 'medium',
    questionType: 'hr'
  },
  {
    question: 'Why are you looking to change your job?',
    correctAnswer: 'Look for a specific reason such as growth, role fit, salary, or learning, not only blaming the previous company.',
    topic: 'HR Screening',
    difficulty: 'hard',
    questionType: 'hr'
  },
  {
    question: 'What are the top 3 things you are really good at? Give one real example.',
    correctAnswer: 'Look for 2 to 3 specific strengths with at least one concrete example.',
    topic: 'HR Screening',
    difficulty: 'hard',
    questionType: 'hr'
  },
  {
    question: 'When work becomes difficult or there is pressure, what do you usually do? Give one real example.',
    correctAnswer: 'Look for a real situation, the action they took, and the outcome.',
    topic: 'HR Screening',
    difficulty: 'hard',
    questionType: 'hr'
  },
  {
    question: 'What salary are you expecting next?',
    correctAnswer: 'Expect a realistic salary number or range with some justification.',
    topic: 'HR Screening',
    difficulty: 'medium',
    questionType: 'hr'
  },
  {
    question: 'If things go well, how long do you see yourself working with us?',
    correctAnswer: 'Expect a clear long-term commitment answer and what makes them stay.',
    topic: 'HR Screening',
    difficulty: 'medium',
    questionType: 'hr'
  }
];

function buildTechQuestions(aiData, count) {
  return {
    questions: Array.isArray(aiData?.questions) ? aiData.questions.slice(0, count) : [],
    correctAnswers: Array.isArray(aiData?.correct_answers) ? aiData.correct_answers.slice(0, count) : [],
    topics: Array.isArray(aiData?.topics) ? aiData.topics.slice(0, count) : [],
    difficulty: Array.isArray(aiData?.difficulty) ? aiData.difficulty.slice(0, count) : []
  };
}

function getOrCreateSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'ID', 'Name', 'Email', 'WhatsApp',
      'Questions', 'Correct Answers', 'Topics', 'Difficulty',
      'Candidate Answers', 'Per Question Scores',
      'Score', 'Tab Switches', 'Status', 'Timestamp', 'Position', 'Time Limit', 'Submitted At', 'Question Types'
    ]);
  } else {
    // Ensure the new Position, Time Limit, and Submitted At columns exist for legacy sheets
    if (sheet.getRange(1, 15).getValue() !== 'Position') {
      sheet.getRange(1, 15).setValue('Position');
    }
    if (sheet.getRange(1, 16).getValue() !== 'Time Limit') {
      sheet.getRange(1, 16).setValue('Time Limit');
    }
    if (sheet.getRange(1, 17).getValue() !== 'Submitted At') {
      sheet.getRange(1, 17).setValue('Submitted At');
    }
    if (sheet.getRange(1, 18).getValue() !== 'Question Types') {
      sheet.getRange(1, 18).setValue('Question Types');
    }
  }
  return sheet;
}

function getSpreadsheet() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  if (HIREOS_SPREADSHEET_ID) {
    return SpreadsheetApp.openById(HIREOS_SPREADSHEET_ID);
  }

  throw new Error('No spreadsheet is connected. Bind this script to your Google Sheet or set HIREOS_SPREADSHEET_ID in Script Properties.');
}

function getOrCreateAudioReviewSheet(ss) {
  let sheet = ss.getSheetByName(AUDIO_REVIEW_SHEET_NAME);
  const headers = [
    'ID', 'Candidate Name', 'Role', 'HR Notes',
    'Audio File Name', 'Audio Mime Type', 'Audio Drive File ID', 'Audio Drive URL',
    'Transcript', 'Transcript Model', 'Report JSON', 'Recommendation', 'Final Verdict',
    'PDF Drive File ID', 'PDF Drive URL', 'Status', 'Timestamp', 'Updated At', 'Error Message'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(AUDIO_REVIEW_SHEET_NAME);
    sheet.appendRow(headers);
  } else {
    for (let i = 0; i < headers.length; i++) {
      if (sheet.getRange(1, i + 1).getValue() !== headers[i]) {
        sheet.getRange(1, i + 1).setValue(headers[i]);
      }
    }
  }

  return sheet;
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
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      // Fall through to newline/comma splitting for freeform input.
    }

    return trimmed
      .split(/\r?\n|,/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [String(value).trim()].filter(Boolean);
}

function getOrCreateFolder(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(name);
}

function getAudioStorageFolders() {
  const rootFolders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
  const rootFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
  return {
    rootFolder: rootFolder,
    audioFolder: getOrCreateFolder(rootFolder, AUDIO_DRIVE_FOLDER_NAME),
    pdfFolder: getOrCreateFolder(rootFolder, PDF_DRIVE_FOLDER_NAME)
  };
}

function sanitizeFileNamePart(value, fallback) {
  const clean = String(value || fallback || 'file')
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || fallback || 'file';
}

function getAudioFormat(mimeType, fileName) {
  const mime = String(mimeType || '').toLowerCase();
  const ext = String(fileName || '').toLowerCase().split('.').pop();
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
    'audio/webm': 'webm'
  };
  const extMap = {
    mp3: 'mp3',
    wav: 'wav',
    m4a: 'm4a',
    aac: 'aac',
    ogg: 'ogg',
    flac: 'flac',
    webm: 'webm'
  };
  return mimeMap[mime] || extMap[ext] || 'mp3';
}



function callOpenRouterJson(messages, model) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'YOUR_OPENROUTER_API_KEY_HERE') {
    throw new Error('OpenRouter API key is missing. Set OPENROUTER_API_KEY in Apps Script Script Properties or replace the placeholder in Code.gs.');
  }

  const payload = {
    model: model || DEFAULT_REPORT_MODEL,
    messages: messages,
    response_format: { type: 'json_object' }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + OPENROUTER_API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
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
5. Return only JSON.`
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
- Make the output suitable for a PDF evaluation report.`
    }
  ];

  return callOpenRouterJson(messages, DEFAULT_REPORT_MODEL);
}

function buildAudioReviewResponse(row) {
  const reportJson = parseStoredValue(row[10], {});
  return {
    id: row[0],
    name: row[1],
    role: row[2],
    hrNotes: row[3],
    audioFileName: row[4],
    audioMimeType: row[5],
    audioDriveFileId: row[6],
    audioDriveUrl: row[7],
    transcript: row[8],
    transcriptModel: row[9],
    report: reportJson,
    recommendation: row[11],
    finalVerdict: row[12],
    pdfDriveFileId: row[13],
    pdfDriveUrl: row[14],
    status: row[15],
    timestamp: row[16],
    updatedAt: row[17],
    errorMessage: row[18] || ''
  };
}

// Helper to cleanly parse OpenRouter markdown JSON output
function parseAIResponse(responseText) {
  const clean = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

function callOpenRouter(messages) {
  return callOpenRouterJson(messages, DEFAULT_REPORT_MODEL);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    // ==========================================
    // AI ACTIONS
    // ==========================================
    if (action === 'generateQuestions') {
      const techQuestionCount = 4;

      // Extract optional HR requirement fields
      const mustCheckSkills = normalizeListInput(data.mustCheckSkills);
      const customQuestions = normalizeListInput(data.customQuestions);
      const totalTechQuestionCount = techQuestionCount + customQuestions.length;

      // Build requirement context for the prompt
      let requirementContext = '';
      if (mustCheckSkills.length > 0) {
        requirementContext += `\n\nMUST VERIFY SKILLS:\n${mustCheckSkills.map(skill => `- ${skill}`).join('\n')}\nEnsure at least one question directly tests each of these skills.`;
      }
      if (customQuestions.length > 0) {
        requirementContext += `\n\nCUSTOM QUESTIONS TO INCLUDE:\n${customQuestions.map(q => `- ${q}`).join('\n')}\nInclude these exact questions in the interview.`;
      }

      const customQuestionBlock = customQuestions.length > 0
        ? `\n\nMANDATORY CUSTOM QUESTIONS:\n${customQuestions.map(q => `- ${q}`).join('\n')}\nThese questions must appear verbatim in the final question list, and matching correct answers must be provided for each one.`
        : '';

      const messages = [
        {
          role: 'system',
          content: `You are a senior technical interviewer at a top-tier tech company. Your goal is to deeply evaluate candidates for the ${data.position || 'specified'} position by asking specific, challenging technical questions that expose whether they truly have the experience listed on their CV. Avoid generic textbook questions. Return only JSON.`
        },
        {
          role: 'user',
          content: `Carefully analyze the following CV and generate exactly ${totalTechQuestionCount} technical interview questions for the ${data.position || 'job role'}.

Rules:
1. Questions must be SPECIFIC to the candidate's actual listed projects, tools, and experience.
2. Include a MIX of difficulty: some medium, some hard, at least one very hard.
3. At least ${Math.ceil(totalTechQuestionCount / 2)} questions must be SCENARIO-BASED.
4. Questions must test REAL understanding, not definitions.
5. Each correct answer should be a detailed, expert-level explanation.${requirementContext}${customQuestionBlock}

Return a JSON object with these exact keys:
- "questions": array of exactly ${totalTechQuestionCount} question strings
- "correct_answers": array of exactly ${totalTechQuestionCount} detailed answer strings
- "difficulty": array of exactly ${totalTechQuestionCount} difficulty levels ("medium", "hard", or "very_hard")
- "topics": array of exactly ${totalTechQuestionCount} topic strings

CV:
${data.cvText}`
        }
      ];

      const aiData = callOpenRouter(messages);
      const tech = buildTechQuestions(aiData, totalTechQuestionCount);
      const combined = {
        questions: HR_QUESTIONS.map(q => q.question).concat(tech.questions),
        correct_answers: HR_QUESTIONS.map(q => q.correctAnswer).concat(tech.correctAnswers),
        topics: HR_QUESTIONS.map(q => q.topic).concat(tech.topics),
        difficulty: HR_QUESTIONS.map(q => q.difficulty).concat(tech.difficulty),
        questionTypes: HR_QUESTIONS.map(q => q.questionType).concat(tech.questions.map(() => 'technical')),
        hrQuestionCount: HR_QUESTIONS.length,
        techQuestionCount: tech.questions.length,
        timeLimit: Number(data.timeLimit || 15)
      };
      return createResponse({ status: 'success', data: combined });
    }
    
    if (action === 'gradeTest') {
      const questionsData = data.questions.map((q, i) => ({
        question: q,
        topic: data.topics[i] || `Question ${i + 1}`,
        candidate_answer: data.candidateAnswers[i] || '(no answer given)',
        question_type: data.questionTypes?.[i] || (i < (data.hrQuestionCount || 0) ? 'hr' : 'technical')
      }));

      const messages = [
        {
          role: 'system',
          content: 'You are a fair and thorough interviewer evaluator. Some questions are HR screening questions and some are technical questions. For HR questions, grade clarity, honesty, responsibility, commitment, and relevance. For technical questions, grade technical accuracy and understanding of core concepts. Be lenient on exact wording — reward correct understanding. Be strict about factually wrong or completely off-topic answers.'
        },
        {
          role: 'user',
          content: `Evaluate these candidate answers.\n\n${JSON.stringify(questionsData, null, 2)}\n\nFor each question, provide:\n- "score": a number from 0 to 10\n- "feedback": one sentence explaining why this score was given\n\nReturn a JSON object with:\n- "overall_score": a number from 0 to 100 (weighted average)\n- "per_question_scores": array of objects, each with "score" and "feedback"`
        }
      ];

      const aiData = callOpenRouter(messages);
      return createResponse({ status: 'success', data: aiData });
    }

    // ==========================================
    // DATABASE ACTIONS
    // ==========================================
    const ss = getSpreadsheet();
    const sheet = getOrCreateSheet(ss);
    const audioReviewSheet = getOrCreateAudioReviewSheet(ss);

    if (action === 'addCandidate') {
      const id = Utilities.getUuid();
      const timestamp = new Date().toISOString();
      sheet.appendRow([
        id, data.name, data.email || '', data.wp,
        data.questions, data.answers, data.topics || '', data.difficulty || '',
        '', '', '', 0, 'Pending', timestamp, data.position || '', data.timeLimit || 15, '', data.questionTypes || ''
      ]);
      return createResponse({ status: 'success', id: id });
    }

    if (action === 'getTest') {
      const id = data.id;
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) {
          return createResponse({
            status: 'success',
            name: rows[i][1] || '',
            questions: rows[i][4],
            answers: rows[i][5],
            topics: rows[i][6],
            difficulty: rows[i][7],
            timeLimit: rows[i][15],
            questionTypes: rows[i][17] || ''
          });
        }
      }
      return createResponse({ status: 'error', message: 'Test not found' });
    }

    if (action === 'submitTest') {
      const id = data.id;
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) {
          sheet.getRange(i + 1, 9).setValue(data.candidateAnswers);
          sheet.getRange(i + 1, 10).setValue(data.perQuestionScores || '');
          sheet.getRange(i + 1, 11).setValue(data.score);
          sheet.getRange(i + 1, 12).setValue(data.tabSwitches);
          sheet.getRange(i + 1, 13).setValue(data.status);
          sheet.getRange(i + 1, 17).setValue(new Date().toISOString());
          return createResponse({ status: 'success' });
        }
      }
      return createResponse({ status: 'error', message: 'Test not found' });
    }

    if (action === 'generateDetailedSummary') {
      const questionsData = data.questions.map((q, i) => ({
        question: q,
        topic: data.topics[i] || `Question ${i + 1}`,
        candidate_answer: data.candidateAnswers[i] || '(no answer given)',
        feedback: data.perQuestionScores[i]?.feedback || '',
        score: data.perQuestionScores[i]?.score || 0,
        question_type: data.questionTypes?.[i] || 'technical'
      }));

      const messages = [
        {
          role: 'system',
          content: `You are an expert HR evaluator and hiring consultant. Analyze candidate responses and create a concise hiring note based only on evidence from the candidate's answers, scores, and feedback.

Rules:
1. Write like an internal HR evaluation report.
2. Keep the summary concise, practical, and decision-oriented.
3. Mention strengths, gaps, communication quality, role fit, and training needs.
4. Do not invent facts that are not reasonably supported by the answers.
5. If evidence is limited, say so briefly instead of over-claiming.
6. Green and red flags must be specific, short, and usable by recruiters.
7. Focus on what matters for hiring, not a long explanation.`
        },
        {
          role: 'user',
          content: `Create a concise hiring evaluation based on these interview responses:\n\n${JSON.stringify(questionsData, null, 2)}\n\nReturn a JSON object with this exact shape:
{
  "summary": "120-170 word hiring summary in the style of an HR evaluator. Mention strongest positives, key concerns, communication/ownership signals, and best-fit role level.",
  "greenFlags": [
    { "title": "short label", "detail": "1-2 sentence explanation tied to the answers" }
  ],
  "redFlags": [
    { "title": "short label", "detail": "1-2 sentence explanation tied to the answers" }
  ],
  "recommendation": "short role recommendation"
}

Requirements:
- Return 3 to 6 green flags and 2 to 5 red flags.
- Keep titles short, like "Clear project ownership" or "Weak debugging depth".
- Prefer evidence from answers over score math.
- If communication seems unclear, mention it only if supported by the answer quality or feedback.
- Make the summary feel similar to an HR interview review, not a generic AI recap.`
        }
      ];

      const aiResult = callOpenRouter(messages);
      return createResponse({ status: 'success', data: aiResult });
    }

    if (action === 'regenerateReport') {
      const id = data.id;
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) {
          const r = rows[i];
          const parseStored = (value) => {
            if (value == null || value === '') return [];
            if (Array.isArray(value)) return value;
            try {
              return JSON.parse(value);
            } catch {
              return [];
            }
          };

          const questions = parseStored(r[4]);
          const correctAnswers = parseStored(r[5]);
          const topics = parseStored(r[6]);
          const difficulty = parseStored(r[7]);
          const candidateAnswers = parseStored(r[8]);
          const questionTypes = parseStored(r[17]);

          let score = Number(r[10]) || 0;
          let perQuestionScores = parseStored(r[9]);

          if (questions.length > 0 && candidateAnswers.length > 0) {
            try {
              const questionsData = questions.map((q, idx) => ({
                question: q,
                topic: topics[idx] || `Question ${idx + 1}`,
                correct_answer: correctAnswers[idx],
                candidate_answer: candidateAnswers[idx] || '(no answer given)',
                question_type: questionTypes?.[idx] || 'technical'
              }));

              const messages = [
                {
                  role: 'system',
                  content: 'You are a fair and thorough interviewer evaluator. Grade candidate answers fairly. For HR questions, grade clarity, honesty, responsibility, commitment, and relevance. For technical questions, grade technical accuracy and understanding. Be lenient on exact wording but strict on factually wrong answers.'
                },
                {
                  role: 'user',
                  content: `Evaluate these candidate answers.\n\n${JSON.stringify(questionsData, null, 2)}\n\nFor each question, provide:\n- "score": a number from 0 to 10\n- "feedback": one sentence explaining why\n\nReturn JSON with:\n- "overall_score": 0-100\n- "per_question_scores": array of {score, feedback}`
                }
              ];
              
              const gradeResult = callOpenRouter(messages);
              score = Number(gradeResult.overall_score || score || 0);
              perQuestionScores = gradeResult.per_question_scores || perQuestionScores || [];
              sheet.getRange(i + 1, 10).setValue(JSON.stringify(perQuestionScores));
              sheet.getRange(i + 1, 11).setValue(score);
            } catch (gradeErr) {
              // If re-grading fails, keep existing scores
              Logger.log('Re-grade failed: ' + gradeErr.toString());
            }
          }

          return createResponse({
            status: 'success',
            data: {
              id: r[0],
              name: r[1],
              email: r[2],
              wp: r[3],
              questions: JSON.stringify(questions),
              correctAnswers: JSON.stringify(correctAnswers),
              topics: JSON.stringify(topics),
              difficulty: JSON.stringify(difficulty),
              candidateAnswers: JSON.stringify(candidateAnswers),
              perQuestionScores: JSON.stringify(perQuestionScores),
              score: score,
              tabSwitches: r[11],
              status: r[12],
              timestamp: r[13],
              position: r[14] || '',
              timeLimit: r[15] || 15,
              submittedAt: r[16] || '',
              questionTypes: JSON.stringify(questionTypes)
            }
          });
        }
      }
      return createResponse({ status: 'error', message: 'Candidate not found' });
    }



    if (action === 'processAudioReview') {
      if (!data.name || !data.role) {
        return createResponse({ status: 'error', message: 'Candidate name and role are required.' });
      }
      const hasTranscript = !!String(data.transcript || '').trim();
      const hasAudio = !!data.audioBase64;
      if (!hasTranscript && !hasAudio) {
        return createResponse({ status: 'error', message: 'Transcript or audio file is required.' });
      }

      const id = Utilities.getUuid();
      const timestamp = new Date().toISOString();
      audioReviewSheet.appendRow([
        id, data.name, data.role, data.hrNotes || '',
        data.audioFileName, data.audioMimeType || '', '', '',
        '', 'web-speech-api', '', '', '',
        '', '', 'Processing', timestamp, timestamp, ''
      ]);

      const rowIndex = audioReviewSheet.getLastRow();

      try {
        let audioFileId = '';
        let audioFileUrl = '';
        let safeAudioName = data.audioFileName || '';
        let transcript = String(data.transcript || '').trim();

        if (hasAudio) {
          const audioBytes = Utilities.base64Decode(data.audioBase64);
          if (audioBytes.length > MAX_AUDIO_BYTES) {
            return createResponse({ status: 'error', message: 'Audio file is too large. Please upload a file smaller than 20MB.' });
          }

          const format = getAudioFormat(data.audioMimeType, data.audioFileName);
          safeAudioName = data.audioFileName || `${sanitizeFileNamePart(data.name, 'candidate')}-${sanitizeFileNamePart(data.role, 'role')}-${Date.now()}.${format}`;
        }

        const report = buildAudioInterviewReport({
          name: data.name,
          role: data.role,
          hrNotes: data.hrNotes || '',
          transcript: transcript
        });

        const updatedAt = new Date().toISOString();
        audioReviewSheet.getRange(rowIndex, 1, 1, 19).setValues([[
          id,
          data.name,
          data.role,
          data.hrNotes || '',
          safeAudioName,
          data.audioMimeType || '',
          audioFileId,
          audioFileUrl,
          transcript,
          'web-speech-api',
          JSON.stringify(report),
          report.recommendation || '',
          report.finalVerdict || '',
          '', // pdf.fileId (removed)
          '', // pdf.url (removed)
          'Completed',
          timestamp,
          updatedAt,
          ''
        ]]);

        const row = audioReviewSheet.getRange(rowIndex, 1, 1, 19).getValues()[0];
        return createResponse({ status: 'success', data: buildAudioReviewResponse(row) });
      } catch (err) {
        audioReviewSheet.getRange(rowIndex, 16).setValue('Error');
        audioReviewSheet.getRange(rowIndex, 18).setValue(new Date().toISOString());
        audioReviewSheet.getRange(rowIndex, 19).setValue(err.toString());
        return createResponse({ status: 'error', message: err.toString() });
      }
    }

    if (action === 'getAllAudioReviews') {
      const rows = audioReviewSheet.getDataRange().getValues();
      const reviews = [];
      for (let i = 1; i < rows.length; i++) {
        reviews.push(buildAudioReviewResponse(rows[i]));
      }
      return createResponse({ status: 'success', data: reviews.reverse() });
    }

    if (action === 'getAudioReviewDetails') {
      const id = data.id;
      const rows = audioReviewSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) {
          return createResponse({ status: 'success', data: buildAudioReviewResponse(rows[i]) });
        }
      }
      return createResponse({ status: 'error', message: 'Audio review not found' });
    }

    if (action === 'regenerateAudioReview') {
      const id = data.id;
      const rows = audioReviewSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) {
          const row = rows[i];
          const transcript = row[8];
          if (!transcript) {
            return createResponse({ status: 'error', message: 'Transcript not found for this audio review.' });
          }

          try {
            const report = buildAudioInterviewReport({
              name: row[1],
              role: row[2],
              hrNotes: row[3] || '',
              transcript: transcript
            });
            const pdf = buildAudioReviewPdf(report, {
              name: row[1],
              role: row[2],
              hrNotes: row[3] || '',
              transcript: transcript
            });
            const updatedAt = new Date().toISOString();
            audioReviewSheet.getRange(i + 1, 11).setValue(JSON.stringify(report));
            audioReviewSheet.getRange(i + 1, 12).setValue(report.recommendation || '');
            audioReviewSheet.getRange(i + 1, 13).setValue(report.finalVerdict || '');
            audioReviewSheet.getRange(i + 1, 14).setValue(pdf.fileId);
            audioReviewSheet.getRange(i + 1, 15).setValue(pdf.url);
            audioReviewSheet.getRange(i + 1, 16).setValue('Completed');
            audioReviewSheet.getRange(i + 1, 18).setValue(updatedAt);
            audioReviewSheet.getRange(i + 1, 19).setValue('');
            const refreshed = audioReviewSheet.getRange(i + 1, 1, 1, 19).getValues()[0];
            return createResponse({ status: 'success', data: buildAudioReviewResponse(refreshed) });
          } catch (err) {
            audioReviewSheet.getRange(i + 1, 16).setValue('Error');
            audioReviewSheet.getRange(i + 1, 18).setValue(new Date().toISOString());
            audioReviewSheet.getRange(i + 1, 19).setValue(err.toString());
            return createResponse({ status: 'error', message: err.toString() });
          }
        }
      }
      return createResponse({ status: 'error', message: 'Audio review not found' });
    }

    if (action === 'getAllCandidates') {
      const rows = sheet.getDataRange().getValues();
      const candidates = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        candidates.push({
          id: r[0], name: r[1], email: r[2], wp: r[3],
          score: r[10], tabSwitches: r[11], status: r[12], timestamp: r[13], position: r[14] || '', timeLimit: r[15] || 15, submittedAt: r[16] || ''
        });
      }
      return createResponse({ status: 'success', data: candidates.reverse() });
    }

    if (action === 'getCandidateDetails') {
      const id = data.id;
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r[0] === id) {
          return createResponse({
            status: 'success',
            candidate: {
              id: r[0], name: r[1], email: r[2], wp: r[3],
              questions: r[4], correctAnswers: r[5], topics: r[6], difficulty: r[7],
              candidateAnswers: r[8], perQuestionScores: r[9],
              score: r[10], tabSwitches: r[11], status: r[12], timestamp: r[13], position: r[14] || '', timeLimit: r[15] || 15, submittedAt: r[16] || '', questionTypes: r[17] || '', detailedSummary: r[18] || ''
            }
          });
        }
      }
      return createResponse({ status: 'error', message: 'Candidate not found' });
    }

    if (action === 'deleteCandidate') {
      const id = data.id;
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === id) {
          sheet.deleteRow(i + 1);
          return createResponse({ status: 'success' });
        }
      }
      return createResponse({ status: 'error', message: 'Candidate not found' });
    }

    if (action === 'deleteCandidates') {
      const ids = data.ids || [];
      const rows = sheet.getDataRange().getValues();
      let deleted = 0;
      // Loop backwards to preserve row indices when deleting
      for (let i = rows.length - 1; i >= 1; i--) {
        if (ids.includes(rows[i][0])) {
          sheet.deleteRow(i + 1);
          deleted++;
        }
      }
      return createResponse({ status: 'success', deleted });
    }

    if (action === 'saveCandidateSummary') {
      const candidateId = data.candidateId;
      const summaryData = data.summary; // JSON string or object
      const rows = sheet.getDataRange().getValues();
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === candidateId) {
          // Column 18 (0-based) is DetailedSummary
          sheet.getRange(i + 1, 19).setValue(typeof summaryData === 'string' ? summaryData : JSON.stringify(summaryData));
          return createResponse({ status: 'success', data: { saved: true } });
        }
      }
      return createResponse({ status: 'error', message: 'Candidate not found' });
    }

    return createResponse({ status: 'error', message: 'Invalid action' });

  } catch (error) {
    return createResponse({ status: 'error', message: error.toString() });
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return createResponse({ status: 'success', message: 'HireOS API is running safely!' });
}

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
    pdfFolderUrl: folders.pdfFolder.getUrl()
  };
}
