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
    fileName,
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

  const panelClass = 'rounded-3xl border border-white/8 bg-[#111218]/90 shadow-2xl shadow-black/20 backdrop-blur-xl';
  const sectionLabelClass = 'text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300';
  const fieldClass = 'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10';
  const textAreaClass = `${fieldClass} min-h-[120px] resize-y`;
  const selectClass = `${fieldClass} appearance-none`;
  const actionPrimaryClass = 'inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition-all hover:scale-[1.01] hover:from-indigo-400 hover:via-violet-400 hover:to-fuchsia-400';
  const actionSecondaryClass = 'inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-all hover:border-white/20 hover:bg-white/10';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_35%),linear-gradient(180deg,_#090b12_0%,_#0f1117_45%,_#0a0d14_100%)] p-4 sm:p-6 text-slate-200">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className={`${panelClass} p-6 sm:p-8`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-300">
                HR + Tech Interview Setup
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">AI Interview builder</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Upload a CV, capture HR context, and generate a structured interview flow with technical questions.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:w-[320px]">
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="text-slate-500 text-xs uppercase tracking-[0.18em]">Mode</div>
                <div className="mt-1 font-semibold text-white">HR guided</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="text-slate-500 text-xs uppercase tracking-[0.18em]">Focus</div>
                <div className="mt-1 font-semibold text-white">CV + skills</div>
              </div>
            </div>
          </div>
        </div>

        {!introAccepted && (
          <div className={`${panelClass} p-5 sm:p-6`}>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-black text-white shrink-0 shadow-lg shadow-indigo-950/40">A</div>
              <div className="min-w-0">
                <div className="text-lg sm:text-xl font-bold text-white">Hello {candidate.name?.trim() || '[Name]'}, this is Alisa.</div>
                <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-300">
                  I would like to have a quick and simple conversation to understand you better. It will not be a formal interview.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <button onClick={playIntroAndNext} className={`${actionPrimaryClass} w-full sm:w-auto`}>
                    Play Intro & I am ready
                  </button>
                  <button onClick={() => { setIntroAccepted(true); setStep(0); }} className={`${actionSecondaryClass} w-full sm:w-auto`}>
                    I am ready
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`${panelClass} p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className={sectionLabelClass}>Input source</div>
              <h2 className="mt-1 text-lg font-bold text-white">CV and timing</h2>
            </div>
            {fileLoading && <div className="text-xs font-semibold text-indigo-300">Parsing PDF...</div>}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <label className="group flex min-h-[180px] cursor-pointer flex-col justify-center rounded-3xl border border-dashed border-white/12 bg-white/4 p-5 text-center transition-all hover:border-indigo-400/50 hover:bg-indigo-500/5">
              <input ref={fileRef} onChange={handleFile} type="file" accept="application/pdf" className="sr-only" />
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-400/20 transition-all group-hover:bg-indigo-500/15 group-hover:text-indigo-200">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="mt-4 text-sm font-semibold text-white">{fileName || 'Click to upload a PDF resume'}</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">PDF only, parsed instantly for question generation.</div>
            </label>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Paste CV text</label>
                <textarea value={cvText} onChange={e => setCvText(e.target.value)} rows={8} className={textAreaClass} placeholder="Paste CV text here if you do not want to upload a PDF." />
              </div>
              <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-end">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Time limit</label>
                  <input type="number" min={1} max={240} value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value) || 0)} className={`${fieldClass} w-full sm:w-28`} />
                </div>
                <button onClick={runGenerateTechQs} className={actionPrimaryClass}>Generate Tech Qs</button>
                <button onClick={() => setCvText('')} className={actionSecondaryClass}>Clear text</button>
              </div>
            </div>
          </div>
        </div>

        {introAccepted && (
        <div className={`${panelClass} p-5 sm:p-6`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className={sectionLabelClass}>HR flow</div>
              <div className="mt-1 text-lg font-bold text-white">Step {step + 1} of {STEPS.length}</div>
            </div>
            <div className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200">
              Guided interview
            </div>
          </div>

          <div className="rounded-3xl border border-white/8 bg-[#0f1622] p-4 sm:p-5">
            <div className="mb-4 text-sm font-medium leading-6 text-slate-200">{STEPS[step].text}</div>

            <div className="space-y-3">
            {STEPS[step].id === 'where_from' && (
              <input value={candidate.location} onChange={e => setAnswer('location', e.target.value)} className={fieldClass} placeholder="Enter city, region, or hometown" />
            )}

            {STEPS[step].id === 'working' && (
              <select value={candidate.currentStatus} onChange={e => setAnswer('currentStatus', e.target.value)} className={selectClass}>
                <option value="">Select current status</option>
                <option value="working">Working</option>
                <option value="not_working">Not working</option>
              </select>
            )}

            {STEPS[step].id === 'role_or_left_when' && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={candidate.role} onChange={e => setAnswer('role', e.target.value)} placeholder="Role (if working)" className={`${fieldClass} flex-1`} />
                <input value={candidate.leftWhen} onChange={e => setAnswer('leftWhen', e.target.value)} placeholder="Left when (if not working)" className={`${fieldClass} flex-1`} />
              </div>
            )}

            {STEPS[step].id === 'why_change' && (
              <input value={candidate.leftReason} onChange={e => setAnswer('leftReason', e.target.value)} className={fieldClass} placeholder="Why are they changing?" />
            )}

            {STEPS[step].id === 'location_stability' && (
              <input value={candidate.location} onChange={e => setAnswer('location', e.target.value)} className={fieldClass} placeholder="Family, rented, alone, etc." />
            )}

            {STEPS[step].id === 'work_history' && (
              <textarea value={candidate.workSummary} onChange={e => setAnswer('workSummary', e.target.value)} rows={4} className={textAreaClass} placeholder="Summarize work history with context and responsibilities" />
            )}

            {STEPS[step].id === 'strengths' && (
              <textarea value={candidate.strengths} onChange={e => setAnswer('strengths', e.target.value)} rows={3} className={textAreaClass} placeholder="List top 3 strengths separated by commas" />
            )}

            {STEPS[step].id === 'strength_probe' && (
              <>
                <input value={candidate.bestStrength} onChange={e => setAnswer('bestStrength', e.target.value)} placeholder="Which one is best?" className={fieldClass} />
                <textarea value={candidate.bestExample} onChange={e => setAnswer('bestExample', e.target.value)} rows={3} className={textAreaClass} placeholder="Describe a situation where you did this well" />
              </>
            )}

            {STEPS[step].id === 'salary_current' && (
              <input value={candidate.salary} onChange={e => setAnswer('salary', e.target.value)} className={fieldClass} placeholder="Current salary / expected context" />
            )}

            {STEPS[step].id === 'salary_expect' && (
              <input value={candidate.expectedSalary} onChange={e => setAnswer('expectedSalary', e.target.value)} className={fieldClass} placeholder="Expected salary" />
            )}

            {STEPS[step].id === 'commitment' && (
              <input value={candidate.commitment} onChange={e => setAnswer('commitment', e.target.value)} className={fieldClass} placeholder="Long term / exploring / immediate" />
            )}

            {STEPS[step].id === 'stay_length' && (
              <input value={candidate.stayYears} onChange={e => setAnswer('stayYears', e.target.value)} className={fieldClass} placeholder="Years you expect to stay" />
            )}

            {STEPS[step].id === 'pressure' && (
              <textarea value={candidate.pressureResponse} onChange={e => setAnswer('pressureResponse', e.target.value)} rows={3} className={textAreaClass} placeholder="Tell me how you respond under pressure" />
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className={`${actionSecondaryClass} sm:flex-1`}>
                Back
              </button>
              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className={`${actionPrimaryClass} sm:flex-1`}>
                  Next
                </button>
              ) : (
                <button onClick={handleSubmitSession} className={`${actionPrimaryClass} sm:flex-1`}>
                  Finish & Save
                </button>
              )}
            </div>
            </div>
          </div>
        </div>
        )}

        <div className={`${panelClass} p-5 sm:p-6`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className={sectionLabelClass}>Technical output</div>
              <div className="mt-1 text-lg font-bold text-white">Generated questions</div>
            </div>
          </div>
          {techQuestions.length === 0 ? (
            <div className="text-slate-400 text-sm">No technical questions generated yet.</div>
          ) : (
            <ol className="list-decimal ml-5 space-y-2 text-slate-200 marker:text-indigo-400">
              {techQuestions.map((q, i) => <li key={i} className="text-sm text-slate-200">{q}</li>)}
            </ol>
          )}
        </div>

        {decision && (
          <div className={`${panelClass} p-5 sm:p-6`}>
            <div className={sectionLabelClass}>Decision</div>
            <div className="mt-2 text-xl font-bold text-white">{decision.decision}</div>
            <div className="mt-1 text-sm text-slate-400">Score: {decision.score ?? 'n/a'} — Reason: {decision.reason}</div>
          </div>
        )}

        <div className={`${panelClass} p-5 sm:p-6 text-xs text-slate-500`}>
          <div className={sectionLabelClass}>Notes</div>
          <ul className="mt-3 list-disc ml-5 space-y-1 text-slate-400">
            {notes.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
