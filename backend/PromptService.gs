/**
 * PromptService.gs
 * Centralized service for building AI prompts for Generate, Scoring, and Reporting.
 *
 * Rules:
 * - NO Sheet Read/Write logic here.
 * - NO API routing or UrlFetchApp calls.
 * - ONLY prompt construction and formatting.
 */

/**
 * Builds the prompt for NORMAL CV-based technical question generation.
 */
function buildNormalQuestionGenerationPrompt_(data, targetCount) {
  const mustCheckSkills = normalizeListInput(data.mustCheckSkills);
  let requirementContext = '';
  if (mustCheckSkills.length > 0) {
    requirementContext += `\n\nMUST VERIFY SKILLS:\n${mustCheckSkills.map((skill) => `- ${skill}`).join('\n')}\nEnsure at least one question directly tests each of these skills.`;
  }

  return [
    {
      role: 'system',
      content: `You are a senior technical interviewer. Your goal is to deeply evaluate candidates for the ${data.position || 'specified'} position by asking exactly ${targetCount} specific, challenging technical questions that expose whether they truly have the experience listed on their CV. Avoid generic textbook questions. Return only JSON.`,
    },
    {
      role: 'user',
      content: `Carefully analyze the following CV and generate exactly ${targetCount} technical interview questions for the ${data.position || 'job role'}.

Rules:
1. Questions must be SPECIFIC to the candidate's actual listed projects, tools, and experience.
2. Include a MIX of difficulty: some medium, some hard, at least one very hard.
3. At least 2 questions must be SCENARIO-BASED.
4. Questions must test REAL understanding, not definitions.
5. Each correct answer should be a detailed, expert-level explanation.${requirementContext}

Return a JSON object with these exact keys:
- "questions": array of exactly ${targetCount} question strings
- "correct_answers": array of exactly ${targetCount} detailed answer strings
- "difficulty": array of exactly ${targetCount} difficulty levels ("medium", "hard", or "very_hard")
- "topics": array of exactly ${targetCount} topic strings

CV:
${data.cvText}`,
    },
  ];
}

/**
 * Builds prompt for ONE specific resume verification question.
 */
function buildResumeVerificationPrompt_(cvText) {
  return [
    {
      role: 'system',
      content:
        'You are an AI interviewer. Generate ONE specific resume verification question based on the CV. Return JSON with "question" and "expected_answer".',
    },
    { role: 'user', content: `CV:\n${cvText}` },
  ];
}

/**
 * Builds prompt for general interview grading (Standard Mode).
 */
function buildGeneralGradingPrompt_(questionsData) {
  return [
    {
      role: 'system',
      content:
        'You are a fair and thorough interviewer evaluator. Some questions are HR screening questions and some are technical questions. For HR questions, grade clarity, honesty, responsibility, commitment, and relevance. For technical questions, grade technical accuracy and understanding of core concepts. Be lenient on exact wording — reward correct understanding. Be strict about factually wrong or completely off-topic answers.',
    },
    {
      role: 'user',
      content: `Evaluate these candidate answers.\n\n${JSON.stringify(questionsData, null, 2)}\n\nFor each question, provide:\n- "score": a number from 0 to 10\n- "feedback": one sentence explaining why this score was given\n\nReturn a JSON object with:\n- "overall_score": a number from 0 to 100 (weighted average)\n- "per_question_scores": array of objects, each with "score" and "feedback"`,
    },
  ];
}

/**
 * Builds the prompt for ICP-based technical and role-fit question generation.
 */
function buildICPQuestionGenerationPrompt_(icp, cvText, mustCheckToolsText) {
  const icpText = sanitizePromptInput_(icp.icpContent);
  const cv = sanitizePromptInput_(cvText);
  const tools = sanitizePromptInput_(mustCheckToolsText);

  return [
    {
      role: 'system',
      content: `You are an expert recruiter. You have been given a highly detailed Ideal Candidate Profile (ICP) in Markdown format. Your goal is to generate exactly 4 deep-dive interview questions that verify if the candidate matches this specific standard.

ICP DOCUMENT:
${icpText}

RULES:
1. Generate exactly 4 questions.
2. Q1 (Skill Fit): Test hands-on experience with MANDATORY SKILLS listed in the ICP.
3. Q2 (Scenario): Present a realistic work situation based on the MAIN PURPOSE or SCENARIO BANK in the ICP.
4. Q3 (Trait): Check for one of the TOP 3 TRAITS listed. 
5. Q4 (Fit/Red Flags): Evaluate if the candidate has any RED FLAGS or fits the COMPANY CULTURE mentioned.
6. If CV or Must-Check Tools are provided, tailor the questions to cross-reference them with the ICP.
7. Return only JSON.`,
    },
    {
      role: 'user',
      content: `Generate 4 ICP-based questions for the role of ${icp.roleName}.
${cv ? `CANDIDATE CV:\n${cv}\n` : ''}${tools ? `MUST VERIFY TOOLS:\n${tools}\n` : ''}
Return a JSON object with:
- "questions": array of 4 strings
- "correct_answers": array of 4 detailed expected answer strings
- "difficulty": array of 4 difficulty levels ("medium", "hard", "very_hard")
- "topics": array of 4 topic strings ("Skill Fit", "Scenario", "Trait Check", "Culture Fit")`,
    },
  ];
}

/**
 * Builds prompt for ICP-based interview grading.
 */
function buildICPGradingPrompt_(questionsData, icp) {
  const icpText = sanitizePromptInput_(icp.icpContent);

  return [
    {
      role: 'system',
      content: `You are an AI interviewer grading technical and HR answers against a specific Ideal Candidate Profile (ICP).

ICP STANDARD:
${icpText}

RULES:
- Grade strictly on accuracy, clarity, and alignment with the ICP.
- Check if the candidate's answers show the required traits and avoid the red flags.
- Return only JSON.`,
    },
    {
      role: 'user',
      content: `Evaluate these candidate answers:\n\n${JSON.stringify(questionsData, null, 2)}\n\nReturn a JSON object with "overall_score" (0-100) and "per_question_scores" (array of objects, each with "score" and "feedback").`,
    },
  ];
}

/**
 * Builds prompt for the final detailed hiring report.
 */
function buildDetailedReportPrompt_(questionsData, icpSnapshot) {
  let icpContext = '';
  let icpFitField = '';

  if (icpSnapshot) {
    const icpText = sanitizePromptInput_(icpSnapshot.icpContent);
    icpContext = `\n\nEVALUATE AGAINST THIS ICP STANDARD:\n${icpText}\nUse these standards to determine if candidate is a true fit for this specific role profile.`;
    icpFitField =
      '\n  "icpFitAnalysis": "50-70 words specifically on how candidate matches the specific ICP standards provided.",';
  }

  return [
    {
      role: 'system',
      content: `You are an expert HR evaluator and hiring consultant. Analyze candidate responses and create a concise hiring note based only on evidence from the candidate's answers, scores, and feedback.${icpContext}

Rules:
1. Write like an internal HR evaluation report.
2. Keep the summary concise, practical, and decision-oriented.
3. Mention strengths, gaps, communication quality, role fit, and training needs.
4. Do not invent facts that are not reasonably supported by the answers.
5. If evidence is limited, say so briefly instead of over-claiming.
6. Green and red flags must be specific, short, and usable by recruiters.
7. Focus on what matters for hiring, not a long explanation.`,
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
  "recommendation": "short role recommendation",${icpFitField}
}

Requirements:
- Return 3 to 6 green flags and 2 to 5 red flags.
- Keep titles short.
- If ICP fit is provided, include "icpFitAnalysis".
- Make the summary feel similar to an HR interview review.`,
    },
  ];
}

/**
 * Helper to sanitize inputs for prompts.
 */
function sanitizePromptInput_(text) {
  if (!text) return '';
  return String(text).substring(0, 10000).replace(/["']/g, "'");
}
