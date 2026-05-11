import { useState, useRef, useCallback } from 'react';
import { extractTextFromPDF } from '../utils/pdfParser';
import { generateQuestions, addCandidate } from '../utils/googleSheets';

const GENERIC_STRINGS = ['hardworking', 'team player', 'honest', 'hard working', 'team-player', 'punctual', 'fast learner'];

const STEPS = [
  { id: 'where_from', text: 'Where are you from?' },
  { id: 'working', text: 'Are you currently working somewhere, or have you already left your last job?' },
  { id: 'role_or_left_when', text: 'If working: What is your role there? If not working: When did you leave your last job?' },
  { id: 'why_change', text: 'Why are you looking to change your job?' },
  { id: 'location_stability', text: 'Where are you staying right now? (family/alone)' },
  { id: 'work_history', text: 'Can you briefly tell me what kind of work you have done till now?' },
  { id: 'strengths', text: 'What are the top 3 things you are really good at? (Be specific, examples expected)' },
  { id: 'strength_probe', text: 'Which one of these are you best at? Tell me one situation where you did this really well.' },
  { id: 'salary_current', text: 'What is your current salary? (approx)' },
  { id: 'salary_expect', text: 'What salary are you expecting next?' },
  { id: 'commitment', text: 'Are you seriously looking for a long-term job, or just exploring options?' },
  { id: 'stay_length', text: 'If things go well, how long do you see yourself working with us?' },
  { id: 'pressure', text: 'When work becomes difficult or there is pressure, what do you usually do?' },
  { id: 'close', text: 'Thank you. This gives me a clear understanding about you. We will review and get back to you with the next step.' }
];

const safeText = (text) => String(text || '').trim();

export function useInterviewFlow() {
  const [step, setStep] = useState(0);
  const [introAccepted, setIntroAccepted] = useState(false);
  const [candidate, setCandidate] = useState({
    name: '',
    location: '',
    currentStatus: '',
    role: '',
    leftWhen: '',
    leftReason: '',
    salary: '',
    expectedSalary: '',
    commitment: '',
    stayYears: '',
    pressureResponse: '',
    strengths: '',
    strengthExample: '',
    bestStrength: '',
    bestExample: '',
    workSummary: ''
  });
  const [cvText, setCvText] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [techQuestions, setTechQuestions] = useState([]);
  const [timeLimit, setTimeLimit] = useState(15);
  const [decision, setDecision] = useState(null);
  const [notes, setNotes] = useState([]);

  const fileRef = useRef(null);

  const setAnswer = useCallback((key, value) => {
    setCandidate((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileLoading(true);

    try {
      const text = await extractTextFromPDF(file);
      setCvText(text);
      setNotes((current) => [...current, 'CV parsed from PDF']);
    } catch (error) {
      console.error('PDF parsing failed:', error);
      setNotes((current) => [...current, 'Failed to parse PDF']);
    } finally {
      setFileLoading(false);
    }
  }, []);

  const runGenerateTechQs = useCallback(async () => {
    try {
      const summary = cvText || candidate.workSummary || '';
      const q = await generateQuestions(summary, candidate.role || '', Number(timeLimit));
      setTechQuestions(q || []);
      setNotes((current) => [...current, `Generated ${q?.length || 0} technical questions`]);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unknown error';
      setNotes((current) => [...current, `Failed to generate tech questions: ${message}`]);
    }
  }, [candidate.role, candidate.workSummary, cvText, timeLimit]);

  const playIntroAndNext = useCallback(() => {
    const name = safeText(candidate.name);
    const text = `Hello ${name ? `${name}, ` : ''}this is Alisa. I would like to have a quick and simple conversation to understand you better. It will not be a formal interview.`;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find((voice) => voice.name.includes('Google') && voice.lang.startsWith('en'))
          || voices.find((voice) => voice.lang.startsWith('en'));
        if (preferred) utterance.voice = preferred;
        utterance.rate = 0.95;
        utterance.onend = () => {
          setIntroAccepted(true);
          setStep(0);
        };
        utterance.onerror = () => {
          setIntroAccepted(true);
          setStep(0);
        };
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('Speech synthesis failed:', error);
        setIntroAccepted(true);
        setStep(0);
      }
    } else {
      setIntroAccepted(true);
      setStep(0);
    }
  }, [candidate.name]);

  const analyzeAndDecide = useCallback(() => {
    const c = candidate;
    let score = 0;
    const strengths = safeText(c.strengths).toLowerCase();
    const hasGenericStrengths = GENERIC_STRINGS.some((item) => strengths.includes(item));

    if (!strengths || strengths.length < 3) {
      return { decision: 'reject', score: 0, reason: 'No clear strengths' };
    }

    if (hasGenericStrengths && safeText(c.bestExample).length < 10) {
      return { decision: 'reject', score: 10, reason: 'Generic strengths with no supporting example' };
    }

    score += 30;
    score += c.commitment?.toLowerCase().includes('long') ? 15 : 5;

    if (!safeText(c.salary) || !safeText(c.expectedSalary)) {
      return { decision: 'reject', score, reason: 'Avoided salary answer' };
    }

    score += 10;

    if (safeText(c.pressureResponse).length > 20) {
      score += 15;
    } else {
      return { decision: 'reject', score, reason: 'No substantial pressure example' };
    }

    if (safeText(c.bestExample).length > 20) {
      score += 20;
    } else {
      score -= 10;
    }

    const finalDecision = score >= 60 ? 'shortlist' : score >= 40 ? 'maybe' : 'reject';
    return { decision: finalDecision, score, reason: 'Decision computed from interview data' };
  }, [candidate]);

  const handleSubmitSession = useCallback(async () => {
    const result = analyzeAndDecide();
    setDecision(result);

    try {
      await addCandidate({ candidate: JSON.stringify({ candidate, techQuestions, decision: result, timeLimit }) });
      setNotes((current) => [...current, 'Candidate saved']);
    } catch (error) {
      console.error('Failed to save candidate:', error);
      setNotes((current) => [...current, 'Failed to save candidate']);
    }
  }, [analyzeAndDecide, candidate, techQuestions, timeLimit]);

  return {
    step,
    setStep,
    introAccepted,
    setIntroAccepted,
    candidate,
    setAnswer,
    cvText,
    setCvText,
    fileLoading,
    techQuestions,
    timeLimit,
    setTimeLimit,
    decision,
    notes,
    fileRef,
    STEPS,
    handleFile,
    runGenerateTechQs,
    playIntroAndNext,
    handleSubmitSession
  };
}
