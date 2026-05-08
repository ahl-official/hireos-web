import { useState, useRef } from 'react';
import { extractTextFromPDF } from '../utils/pdfParser';
import { generateQuestions, addCandidate } from '../utils/googleSheets';

const GENERIC_STRINGS = ['hardworking','team player','honest','hard working','team-player','punctual','fast learner'];

export default function Interview() {
  const [step, setStep] = useState(0);
  const [introAccepted, setIntroAccepted] = useState(false);
  const [candidate, setCandidate] = useState({ name: '', location: '', currentStatus: '', role: '', leftWhen: '', leftReason: '', salary: '', expectedSalary: '', commitment: '', stayYears: '', pressureResponse: '', strengths: '', strengthExample: '', bestStrength: '', bestExample: '', workSummary: '' });
  const [cvText, setCvText] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [techQuestions, setTechQuestions] = useState([]);
  const [timeLimit, setTimeLimit] = useState(15); // minutes total
  const [decision, setDecision] = useState(null);
  const [notes, setNotes] = useState([]);

  const fileRef = useRef(null);

  const steps = [
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

  const setAnswer = (key, value) => setCandidate(prev => ({ ...prev, [key]: value }));

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileLoading(true);
    try {
      const text = await extractTextFromPDF(f);
      setCvText(text);
      setNotes(n => [...n, 'CV parsed from PDF']);
    } catch {
      setNotes(n => [...n, 'Failed to parse PDF']);
    } finally {
      setFileLoading(false);
    }
  };

  const runGenerateTechQs = async () => {
    try {
      const q = await generateQuestions(cvText || candidate.workSummary || '', candidate.role || '', Number(timeLimit));
      setTechQuestions(q || []);
      setNotes(n => [...n, `Generated ${q?.length || 0} technical questions`]);
    } catch (err) {
      // surface any server message if present
      const msg = err?.response?.data?.message || err?.message || String(err);
      setNotes(n => [...n, `Failed to generate tech questions: ${msg}`]);
    }
  };

  const playIntroAndNext = () => {
    const name = (candidate.name || '').trim();
    const text = `Hello ${name ? name + ',' : ''} this is Alisa. I would like to have a quick and simple conversation to understand you better. It will not be a formal interview.`;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
          || voices.find(v => v.lang.startsWith('en'));
        if (preferred) u.voice = preferred;
        u.rate = 0.95;
        u.onend = () => {
          setIntroAccepted(true);
          setStep(0);
        };
        u.onerror = () => {
          setIntroAccepted(true);
          setStep(0);
        };
        window.speechSynthesis.speak(u);
      } catch (e) {
        setIntroAccepted(true);
        setStep(0);
      }
    } else {
      setIntroAccepted(true);
      setStep(0);
    }
  };

  const analyzeAndDecide = () => {
    // Simple rule-based decision following provided 'final truth'
    const c = candidate;
    let score = 0;

    // Strengths quality
    const strengths = (c.strengths || '').toLowerCase();
    const isGeneric = GENERIC_STRINGS.some(g => strengths.includes(g));
    if (!strengths || strengths.trim().length < 3) return { decision: 'reject', reason: 'No clear strengths' };
    // use the provided best example as the proof point
    if (isGeneric && (!c.bestExample || c.bestExample.trim().length < 10)) return { decision: 'reject', reason: 'Generic strengths, no example' };
    score += 30;

    // Commitment
    if (c.commitment && c.commitment.toLowerCase().includes('long')) score += 15; else score += 5;

    // Salary avoidance
    if (!c.salary || !c.expectedSalary) return { decision: 'reject', reason: 'Avoided salary answer' };
    score += 10;

    // Pressure test
    if (c.pressureResponse && c.pressureResponse.length > 20) score += 15; else return { decision: 'reject', reason: 'No real example under pressure' };

    // Best strength example
    if (c.bestExample && c.bestExample.length > 20) score += 20; else score -= 10;

    const final = score >= 60 ? 'shortlist' : (score >= 40 ? 'maybe' : 'reject');
    return { decision: final, score, reason: 'Calculated' };
  };

  const handleSubmitSession = async () => {
    const res = analyzeAndDecide();
    setDecision(res);
    try {
      await addCandidate({ candidate: JSON.stringify({ candidate, techQuestions, decision: res, timeLimit }) });
      setNotes(n => [...n, 'Candidate saved']);
    } catch {
      setNotes(n => [...n, 'Failed to save candidate']);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-[#0f1117] text-slate-200">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">AI Interview — HR + Tech Q generator</h1>

        {!introAccepted && (
          <div className="mb-4 p-5 sm:p-6 bg-[#111218] rounded-2xl border border-white/5 shadow-2xl shadow-black/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white shrink-0">A</div>
              <div className="min-w-0">
                <div className="text-lg sm:text-xl font-bold text-white">Hello {candidate.name?.trim() || '[Name]'}, this is Alisa.</div>
                <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
                  I would like to have a quick and simple conversation to understand you better. It will not be a formal interview.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <button onClick={playIntroAndNext} className="px-4 py-3 bg-indigo-600 rounded-xl font-semibold text-white w-full sm:w-auto">
                    Play Intro & I am ready
                  </button>
                  <button onClick={() => { setIntroAccepted(true); setStep(0); }} className="px-4 py-3 bg-white/5 rounded-xl font-semibold text-slate-200 w-full sm:w-auto border border-white/10">
                    I am ready
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CV Upload / Paste */}
        <div className="mb-4 p-4 bg-[#111218] rounded-lg border border-white/5">
          <label className="block text-sm font-semibold mb-2">Upload CV (PDF) or paste text below</label>
          <input ref={fileRef} onChange={handleFile} type="file" accept="application/pdf" className="mb-2" />
          {fileLoading && <div className="text-sm text-slate-400">Parsing PDF...</div>}
          <textarea value={cvText} onChange={e => setCvText(e.target.value)} rows={6} className="w-full bg-transparent border border-white/5 p-2 mt-2 rounded" placeholder="Or paste CV text here" />
          <div className="flex gap-2 mt-2 items-center">
            <label className="text-xs text-slate-400">Time limit (min)</label>
            <input type="number" min={1} max={240} value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value) || 0)} className="w-24 p-2 bg-transparent border border-white/5 rounded" />
            <button onClick={runGenerateTechQs} className="px-3 py-2 bg-indigo-600 rounded">Generate Tech Qs</button>
            <button onClick={() => setCvText('')} className="px-3 py-2 bg-white/5 rounded">Clear</button>
          </div>
        </div>

        {/* Interview flow UI */}
        {introAccepted && (
        <div className="mb-4 p-4 bg-[#111218] rounded-lg border border-white/5">
          <div className="mb-2 text-sm text-indigo-300 font-semibold">HR Flow</div>
          <div className="mb-4 p-3 bg-[#0f1622] rounded">
            <div className="text-sm text-slate-300 font-medium">{steps[step].text}</div>
          </div>

          <div>
            {/* Input mapping by step id */}
            {steps[step].id === 'where_from' && (
              <input value={candidate.location} onChange={e => setAnswer('location', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {steps[step].id === 'working' && (
              <select value={candidate.currentStatus} onChange={e => setAnswer('currentStatus', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2">
                <option value="">Select</option>
                <option value="working">Working</option>
                <option value="not_working">Not working</option>
              </select>
            )}

            {steps[step].id === 'role_or_left_when' && (
              <div className="flex gap-2">
                <input value={candidate.role} onChange={e => setAnswer('role', e.target.value)} placeholder="Role (if working)" className="flex-1 p-2 bg-transparent border border-white/5 rounded" />
                <input value={candidate.leftWhen} onChange={e => setAnswer('leftWhen', e.target.value)} placeholder="Left when (if not working)" className="flex-1 p-2 bg-transparent border border-white/5 rounded" />
              </div>
            )}

            {steps[step].id === 'why_change' && (
              <input value={candidate.leftReason} onChange={e => setAnswer('leftReason', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {steps[step].id === 'location_stability' && (
              <input value={candidate.location} onChange={e => setAnswer('location', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {steps[step].id === 'work_history' && (
              <textarea value={candidate.workSummary} onChange={e => setAnswer('workSummary', e.target.value)} rows={4} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {steps[step].id === 'strengths' && (
              <textarea value={candidate.strengths} onChange={e => setAnswer('strengths', e.target.value)} rows={3} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" placeholder="List top 3 strengths separated by commas" />
            )}

            {steps[step].id === 'strength_probe' && (
              <>
                <input value={candidate.bestStrength} onChange={e => setAnswer('bestStrength', e.target.value)} placeholder="Which one is best?" className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
                <textarea value={candidate.bestExample} onChange={e => setAnswer('bestExample', e.target.value)} rows={3} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" placeholder="Describe a situation where you did this well" />
              </>
            )}

            {steps[step].id === 'salary_current' && (
              <input value={candidate.salary} onChange={e => setAnswer('salary', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {steps[step].id === 'salary_expect' && (
              <input value={candidate.expectedSalary} onChange={e => setAnswer('expectedSalary', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {steps[step].id === 'commitment' && (
              <input value={candidate.commitment} onChange={e => setAnswer('commitment', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {steps[step].id === 'stay_length' && (
              <input value={candidate.stayYears} onChange={e => setAnswer('stayYears', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {steps[step].id === 'pressure' && (
              <textarea value={candidate.pressureResponse} onChange={e => setAnswer('pressureResponse', e.target.value)} rows={3} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <button disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))} className="px-3 py-2 bg-white/5 rounded">Back</button>
              {step < steps.length - 1 ? (
                <button onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))} className="px-3 py-2 bg-indigo-600 rounded">Next</button>
              ) : (
                <button onClick={handleSubmitSession} className="px-3 py-2 bg-emerald-600 rounded">Finish & Save</button>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Tech Questions preview */}
        <div className="mb-4 p-4 bg-[#111218] rounded-lg border border-white/5">
          <div className="text-sm font-semibold mb-2">Technical Questions</div>
          {techQuestions.length === 0 ? (
            <div className="text-slate-400 text-sm">No technical questions generated yet.</div>
          ) : (
            <ol className="list-decimal ml-5 space-y-2">
              {techQuestions.map((q, i) => <li key={i} className="text-sm text-slate-200">{q}</li>)}
            </ol>
          )}
        </div>

        {/* Decision */}
        {decision && (
          <div className="mb-4 p-4 rounded-lg bg-[#081218] border border-white/5">
            <div className="font-bold">Decision: {decision.decision}</div>
            <div className="text-sm text-slate-400">Score: {decision.score ?? 'n/a'} — Reason: {decision.reason}</div>
          </div>
        )}

        {/* Notes */}
        <div className="text-xs text-slate-500 mt-4">
          <div className="font-semibold mb-1">Notes</div>
          <ul className="list-disc ml-5 space-y-1">
            {notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
