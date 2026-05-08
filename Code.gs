// IMPORTANT: Replace this with your actual OpenRouter API Key or set it in Script Properties.
const OPENROUTER_API_KEY = PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY') || 'YOUR_OPENROUTER_API_KEY_HERE';

const SHEET_NAME = 'Candidates';

// Column index reference (0-based):
// 0:ID, 1:Name, 2:Email, 3:WhatsApp, 4:Questions, 5:CorrectAnswers,
// 6:Topics, 7:Difficulty, 8:CandidateAnswers, 9:PerQuestionScores,
// 10:Score, 11:TabSwitches, 12:Status, 13:Timestamp, 14:Position, 15:TimeLimit, 16:SubmittedAt, 17:QuestionTypes

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

function getTechQuestionCount(timeLimit) {
  const normalized = Number(timeLimit) || 15;
  if (normalized <= 15) return 2;
  if (normalized <= 30) return 3;
  if (normalized <= 45) return 4;
  if (normalized <= 60) return 5;
  return 6;
}

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

// Helper to cleanly parse OpenRouter markdown JSON output
function parseAIResponse(responseText) {
  const clean = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

function callOpenRouter(messages) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'YOUR_OPENROUTER_API_KEY_HERE') {
    throw new Error('OpenRouter API key is missing. Set OPENROUTER_API_KEY in Apps Script Script Properties or replace the placeholder in Code.gs.');
  }

  const payload = {
    model: 'openai/gpt-4o-mini',
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

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    // ==========================================
    // AI ACTIONS
    // ==========================================
    if (action === 'generateQuestions') {
        const techQuestionCount = getTechQuestionCount(data.timeLimit || data.techQuestionCount || 15);
      const messages = [
        {
          role: 'system',
          content: `You are a senior technical interviewer at a top-tier tech company. Your goal is to deeply evaluate candidates for the ${data.position || 'specified'} position by asking specific, challenging technical questions that expose whether they truly have the experience listed on their CV. Avoid generic textbook questions. Return only JSON.`
        },
        {
          role: 'user',
            content: `Carefully analyze the following CV and generate exactly ${techQuestionCount} technical interview questions for the ${data.position || 'job role'}.\n\nRules:\n1. Questions must be SPECIFIC to the candidate's actual listed projects, tools, and experience.\n2. Include a MIX of difficulty: some medium, some hard, at least one very hard.\n3. At least ${Math.ceil(techQuestionCount / 2)} questions must be SCENARIO-BASED.\n4. Questions must test REAL understanding, not definitions.\n5. Each correct answer should be a detailed, expert-level explanation.\n\nReturn a JSON object with these exact keys:\n- "questions": array of exactly ${techQuestionCount} question strings\n- "correct_answers": array of exactly ${techQuestionCount} detailed answer strings\n- "difficulty": array of exactly ${techQuestionCount} difficulty levels ("medium", "hard", or "very_hard")\n- "topics": array of exactly ${techQuestionCount} topic strings\n\nCV:\n${data.cvText}`
        }
      ];
      
      const aiData = callOpenRouter(messages);
      const tech = buildTechQuestions(aiData, techQuestionCount);
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
        correct_answer: data.correctAnswers[i],
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss);

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
              score: r[10], tabSwitches: r[11], status: r[12], timestamp: r[13], position: r[14] || '', timeLimit: r[15] || 15, submittedAt: r[16] || '', questionTypes: r[17] || ''
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
