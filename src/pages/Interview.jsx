import { useInterviewFlow } from '../hooks/useInterviewFlow';

export default function Interview() {
  const {
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
  } = useInterviewFlow();

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

        <div className="mb-4 p-4 bg-[#111218] rounded-lg border border-white/5">
          <label className="block text-sm font-semibold mb-2">Upload CV (PDF) or paste text below</label>
          <input ref={fileRef} onChange={handleFile} type="file" accept="application/pdf" className="mb-2" />
          {fileLoading && <div className="text-sm text-slate-400">Parsing PDF...</div>}
          <textarea value={cvText} onChange={e => setCvText(e.target.value)} rows={6} className="w-full bg-transparent border border-white/5 p-2 mt-2 rounded" placeholder="Or paste CV text here" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
            <label className="text-xs text-slate-400">Time limit (min)</label>
            <input type="number" min={1} max={240} value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value) || 0)} className="w-full sm:w-24 p-2 bg-transparent border border-white/5 rounded" />
            <button onClick={runGenerateTechQs} className="w-full sm:w-auto px-3 py-2 bg-indigo-600 rounded">Generate Tech Qs</button>
            <button onClick={() => setCvText('')} className="w-full sm:w-auto px-3 py-2 bg-white/5 rounded">Clear</button>
          </div>
        </div>

        {introAccepted && (
        <div className="mb-4 p-4 bg-[#111218] rounded-lg border border-white/5">
          <div className="mb-2 text-sm text-indigo-300 font-semibold">HR Flow</div>
          <div className="mb-4 p-3 bg-[#0f1622] rounded">
            <div className="text-sm text-slate-300 font-medium">{STEPS[step].text}</div>
          </div>

          <div>
            {STEPS[step].id === 'where_from' && (
              <input value={candidate.location} onChange={e => setAnswer('location', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {STEPS[step].id === 'working' && (
              <select value={candidate.currentStatus} onChange={e => setAnswer('currentStatus', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2">
                <option value="">Select</option>
                <option value="working">Working</option>
                <option value="not_working">Not working</option>
              </select>
            )}

            {STEPS[step].id === 'role_or_left_when' && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={candidate.role} onChange={e => setAnswer('role', e.target.value)} placeholder="Role (if working)" className="flex-1 p-2 bg-transparent border border-white/5 rounded" />
                <input value={candidate.leftWhen} onChange={e => setAnswer('leftWhen', e.target.value)} placeholder="Left when (if not working)" className="flex-1 p-2 bg-transparent border border-white/5 rounded" />
              </div>
            )}

            {STEPS[step].id === 'why_change' && (
              <input value={candidate.leftReason} onChange={e => setAnswer('leftReason', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {STEPS[step].id === 'location_stability' && (
              <input value={candidate.location} onChange={e => setAnswer('location', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {STEPS[step].id === 'work_history' && (
              <textarea value={candidate.workSummary} onChange={e => setAnswer('workSummary', e.target.value)} rows={4} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {STEPS[step].id === 'strengths' && (
              <textarea value={candidate.strengths} onChange={e => setAnswer('strengths', e.target.value)} rows={3} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" placeholder="List top 3 strengths separated by commas" />
            )}

            {STEPS[step].id === 'strength_probe' && (
              <>
                <input value={candidate.bestStrength} onChange={e => setAnswer('bestStrength', e.target.value)} placeholder="Which one is best?" className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
                <textarea value={candidate.bestExample} onChange={e => setAnswer('bestExample', e.target.value)} rows={3} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" placeholder="Describe a situation where you did this well" />
              </>
            )}

            {STEPS[step].id === 'salary_current' && (
              <input value={candidate.salary} onChange={e => setAnswer('salary', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {STEPS[step].id === 'salary_expect' && (
              <input value={candidate.expectedSalary} onChange={e => setAnswer('expectedSalary', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {STEPS[step].id === 'commitment' && (
              <input value={candidate.commitment} onChange={e => setAnswer('commitment', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {STEPS[step].id === 'stay_length' && (
              <input value={candidate.stayYears} onChange={e => setAnswer('stayYears', e.target.value)} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            {STEPS[step].id === 'pressure' && (
              <textarea value={candidate.pressureResponse} onChange={e => setAnswer('pressureResponse', e.target.value)} rows={3} className="w-full p-2 bg-transparent border border-white/5 rounded mb-2" />
            )}

            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="px-3 py-2 bg-white/5 rounded">Back</button>
              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className="px-3 py-2 bg-indigo-600 rounded">Next</button>
              ) : (
                <button onClick={handleSubmitSession} className="px-3 py-2 bg-emerald-600 rounded">Finish & Save</button>
              )}
            </div>
          </div>
        </div>
        )}

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

        {decision && (
          <div className="mb-4 p-4 rounded-lg bg-[#081218] border border-white/5">
            <div className="font-bold">Decision: {decision.decision}</div>
            <div className="text-sm text-slate-400">Score: {decision.score ?? 'n/a'} — Reason: {decision.reason}</div>
          </div>
        )}

        <div className="text-xs text-slate-500 mt-4">
          <div className="font-semibold mb-1">Notes</div>
          <ul className="list-disc ml-5 space-y-1">
            {notes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
