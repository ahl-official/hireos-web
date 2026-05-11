import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getTest, submitTest, gradeTest } from '../utils/googleSheets';
import { useAutoInterviewSession } from '../hooks/useAutoInterviewSession';
import {
  AlertTriangle, CheckCircle, Shield, Timer,
  Mic, Volume2, ChevronRight, ChevronLeft, Send,
  MicOff
} from 'lucide-react';
import SystemCheck from '../components/SystemCheck';


export default function TestPage() {
  const { id } = useParams();
  const [candidateName, setCandidateName] = useState('');
  const [introAccepted, setIntroAccepted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [correctAnswers, setCorrectAnswers] = useState([]);
  const [topics, setTopics] = useState([]);
  const [difficulty, setDifficulty] = useState([]);
  const [questionTypes, setQuestionTypes] = useState([]);
  const [status, setStatus] = useState('loading');
  const [tabSwitches, setTabSwitches] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [systemCheckPassed, setSystemCheckPassed] = useState(false);

  const {
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    setAnswers,
    isSpeaking,
    isRecording,
    isProcessingAudio,
    isAcknowledging,
    statusMessage,
    needsManualRetry,
    lastTranscript,
    audioError,
    speakQuestion,
    toggleRecording,
    handleReRecord,
    handleDoneAndNext,
    handleNext
  } = useAutoInterviewSession(questions, introAccepted && systemCheckPassed);

  const browserSupported = typeof window !== 'undefined' && 'MediaRecorder' in window && 'speechSynthesis' in window;

  const playIntro = useCallback(() => {
    const name = candidateName.trim();
    const introText = `Hello ${name || '[Name]'}. I am Alisa, your interviewer. I will ask a few structured questions about your background and experience. Please answer clearly.`;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIntroAccepted(true);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(introText);
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
        || voices.find(v => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      utterance.onend = () => setIntroAccepted(true);
      utterance.onerror = () => setIntroAccepted(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIntroAccepted(true);
    }
  }, [candidateName]);

  useEffect(() => {
    if (status === 'ready' && systemCheckPassed && !introAccepted) {
      setErrorMessage('Tap begin to hear the introduction.');
    }
  }, [introAccepted, status, systemCheckPassed]);

  const handleSubmit = useCallback(async (e, autoSubmit = false) => {
    if (e?.preventDefault) e.preventDefault();
    if (isRecording) {
      setErrorMessage('Please stop recording before submitting.');
      return;
    }
    window.speechSynthesis.cancel();

    const answeredCount = Object.values(answers).filter(a => a?.trim().length > 0).length;
    if (!autoSubmit && answeredCount < questions.length) {
      if (!window.confirm(`You have answered ${answeredCount} of ${questions.length} questions. Submit anyway?`)) return;
    }

    try {
      setStatus('grading');
      const candidateAnswersList = questions.map((_, i) => answers[i] || '');
      const gradeResult = await gradeTest(questions, correctAnswers, topics, candidateAnswersList, questionTypes);
      setStatus('submitting');
      await submitTest({
        id,
        candidateAnswers: JSON.stringify(candidateAnswersList),
        score: gradeResult.overall_score ?? gradeResult.score ?? 0,
        perQuestionScores: JSON.stringify(gradeResult.per_question_scores || []),
        tabSwitches,
        status: 'Completed'
      });
      setStatus('success');
    } catch {
      setErrorMessage('Failed to submit. Please try again.');
      setStatus('error');
    }
  }, [answers, correctAnswers, id, isRecording, questionTypes, questions, tabSwitches, topics]);

  // ── Load test data ──
  useEffect(() => {
    const fetchTestData = async () => {
      try {
        const data = await getTest(id);
        const parse = (v) => {
          if (!v) return [];
          try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return []; }
        };
        const q = parse(data?.questions);
        if (!q || q.length === 0) {
          setStatus('error');
          setErrorMessage('Test not found. Please check your link.');
          return;
        }
        // Block re-submission of already completed tests
        if (data?.status === 'Completed') {
          setStatus('already_done');
          return;
        }
        setCandidateName((data?.name || '').trim());
        setQuestions(q);
        setCorrectAnswers(parse(data?.answers));
        setTopics(parse(data?.topics));
        setDifficulty(parse(data?.difficulty));
        setQuestionTypes(parse(data?.questionTypes));
        setTimeLeft(Number(data?.timeLimit || 15) * 60);
        setStatus('ready');
      } catch {
        setStatus('error');
        setErrorMessage('Could not load your test. Please try again later.');
      }
    };
    fetchTestData();
  }, [id]);

  // ── Tab-switch protection ──
  useEffect(() => {
    if (!systemCheckPassed) return;
    const onVisibilityChange = () => { if (document.hidden) setTabSwitches(p => p + 1); };
    const block = (e) => e.preventDefault();
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
    };
  }, [systemCheckPassed]);

  // ── Timer ──
  useEffect(() => {
    if (status !== 'ready' || timeLeft === null || !systemCheckPassed) return;
    if (timeLeft <= 0) { setTimeout(() => handleSubmit(null, true), 0); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [handleSubmit, status, timeLeft, systemCheckPassed]);

  const formatTime = (seconds) => {
    if (seconds <= 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── Loading ──
  if (status === 'loading') return (
    <div className="min-h-screen bg-[#060810] flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-900/60">
          <span className="text-white font-black text-2xl">A</span>
        </div>
        <span className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-400 rounded-full border-2 border-[#060810] animate-pulse" />
      </div>
      <div className="text-center">
        <p className="text-white font-semibold text-lg">Preparing your interview</p>
        <p className="text-slate-500 text-sm mt-1">Please wait a moment...</p>
      </div>
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );

  // ── Success ──
  if (status === 'success') return (
    <div className="min-h-screen bg-[#060810] flex items-center justify-center p-4">
      <div className="relative max-w-md w-full text-center">
        <div className="absolute inset-0 bg-emerald-500/10 rounded-3xl blur-3xl" />
        <div className="relative bg-[#0d1117] border border-emerald-500/20 p-12 rounded-3xl shadow-2xl">
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-900/40">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Interview Complete!</h2>
          <p className="text-slate-400 leading-relaxed">Your responses have been recorded and submitted. The HR team will review them shortly.</p>
          <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-slate-500">
            You may safely close this window
          </div>
        </div>
      </div>
    </div>
  );

  // ── Already Completed ──
  if (status === 'already_done') return (
    <div className="min-h-screen bg-[#060810] flex items-center justify-center p-4">
      <div className="relative max-w-md w-full text-center">
        <div className="absolute inset-0 bg-amber-500/8 rounded-3xl blur-3xl" />
        <div className="relative bg-[#0d1117] border border-amber-500/20 p-12 rounded-3xl shadow-2xl">
          <div className="w-20 h-20 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Already Submitted</h2>
          <p className="text-slate-400 text-sm leading-relaxed">This interview has already been completed. Each assessment link can only be used once.</p>
          <p className="text-slate-600 text-xs mt-4">If you think this is an error, please contact your HR team.</p>
        </div>
      </div>
    </div>
  );

  // ── Browser Not Supported ──
  if (!browserSupported) return (
    <div className="min-h-screen bg-[#060810] flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-orange-500/20 p-10 rounded-3xl max-w-md w-full text-center">
        <div className="text-5xl mb-4">ðŸŒ</div>
        <h2 className="text-2xl font-bold text-white mb-3">Unsupported Browser</h2>
        <p className="text-slate-400 text-sm mb-6">This AI Interview requires voice features not available in your browser.</p>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 text-left space-y-2">
          <p className="text-orange-300 text-xs font-bold uppercase tracking-wider mb-3">Please use one of these browsers:</p>
          {['✅ Google Chrome (recommended)', '✅ Microsoft Edge', '✅ Safari (macOS / iOS)'].map(b => (
            <p key={b} className="text-slate-300 text-sm">{b}</p>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Error ──
  if (status === 'error' && !questions.length) return (
    <div className="min-h-screen bg-[#060810] flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-red-500/20 p-10 rounded-3xl max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Something went wrong</h2>
        <p className="text-slate-400 text-sm">{errorMessage}</p>
      </div>
    </div>
  );

  // ── Grading / Submitting ──
  if (status === 'grading' || status === 'submitting') return (
    <div className="min-h-screen bg-[#060810] flex flex-col items-center justify-center gap-8 p-4">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-900/60">
          <span className="text-white font-black text-2xl">A</span>
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30 animate-ping" />
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-xl">{status === 'grading' ? 'Alisa is reviewing your answers...' : 'Submitting your results...'}</p>
        <p className="text-slate-500 text-sm mt-2">Please keep this window open</p>
      </div>
      <div className="flex gap-1.5">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="w-1.5 h-8 bg-indigo-500/60 rounded-full" style={{ animation: `audioBar 0.8s ease-in-out infinite`, animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <style>{`@keyframes audioBar { 0%,100%{transform:scaleY(.3);opacity:.5} 50%{transform:scaleY(1);opacity:1} }`}</style>
    </div>
  );

  // ── System Check ──
  if (status === 'ready' && !systemCheckPassed) {
    return <SystemCheck onComplete={() => setSystemCheckPassed(true)} />;
  }

  // ── Intro Screen ──
  if (status === 'ready' && systemCheckPassed && !introAccepted) {
    return (
      <div className="min-h-screen bg-[#060810] flex items-center justify-center p-4">
        <div className="relative max-w-lg w-full">
          <div className="absolute inset-0 bg-indigo-500/10 rounded-[2.5rem] blur-3xl" />
          <div className="relative bg-[#0d1117] border border-white/8 rounded-[2rem] p-8 sm:p-10 shadow-2xl">
            {/* AI Avatar */}
            <div className="flex items-center gap-4 mb-8">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-900/50">
                  <span className="text-white font-black text-2xl">A</span>
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#0d1117]" />
              </div>
              <div>
                <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">AI Interviewer</p>
                <h2 className="text-xl font-bold text-white">Alisa</h2>
                <p className="text-xs text-emerald-400 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block animate-pulse" />Online</p>
              </div>
            </div>

            {/* Chat Bubble */}
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-5 mb-6">
              <p className="text-slate-200 text-base leading-relaxed">
                Hello <span className="text-indigo-400 font-semibold">{candidateName || 'there'}</span>. I am Alisa, your interviewer.
              </p>
              <p className="text-slate-400 text-sm leading-relaxed mt-3">
                I will ask a few structured questions about your experience. Please answer clearly and directly.
              </p>
            </div>

            <button
              onClick={playIntro}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-base transition-all shadow-lg shadow-indigo-900/40 hover:shadow-indigo-900/60 hover:scale-[1.02] active:scale-[0.99]"
            >
              Begin Interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const currentAnswer = answers[currentQuestionIndex] || '';
  const currentTopic = topics[currentQuestionIndex];
  const currentDiff = difficulty[currentQuestionIndex];
  const answeredCount = Object.values(answers).filter(a => a?.trim().length > 0).length;
  const isTimeLow = timeLeft !== null && timeLeft < 60;
  const diffLabel = { medium: 'Medium', hard: 'Hard', very_hard: 'Very Hard' };

  return (
    <div className="min-h-screen bg-[#060810] flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Top Bar ── */}
      <header className="border-b border-white/5 bg-[#060810]/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xs">H</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-slate-400 text-sm">AI Interview</span>
          </div>

          {/* Progress Pills */}
          <div className="flex items-center gap-1.5">
            {questions.map((_, idx) => (
              <div
                key={idx}
                className={`transition-all duration-300 rounded-full ${
                  idx === currentQuestionIndex ? 'w-6 h-2 bg-indigo-500' :
                  answers[idx]?.trim() ? 'w-2 h-2 bg-emerald-500' : 'w-2 h-2 bg-white/15'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {timeLeft !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                isTimeLow ? 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse' : 'bg-white/5 text-slate-400 border-white/10'
              }`}>
                <Timer className="w-3 h-3" />
                {formatTime(timeLeft)}
              </div>
            )}
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-500 text-xs">
              <Shield className="w-3 h-3" />
              <span>Monitored</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab-switch Warning ── */}
      {tabSwitches > 0 && (
        <div className="bg-red-600/95 backdrop-blur border-b border-red-500/30">
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
            <p className="text-sm font-semibold text-white">Tab switch detected — {tabSwitches} time{tabSwitches > 1 ? 's' : ''}. This has been recorded for HR.</p>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 gap-5">

        {/* ── AI Interviewer Card ── */}
        <div className={`rounded-2xl border p-5 transition-all duration-500 ${
          isSpeaking ? 'border-indigo-500/40 bg-indigo-500/5 shadow-lg shadow-indigo-900/30' : 'border-white/8 bg-white/3'
        }`}>
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center transition-all ${isSpeaking ? 'shadow-lg shadow-indigo-900/60 scale-105' : ''}`}>
                <span className="text-white font-black text-lg">A</span>
              </div>
              {isSpeaking && <span className="absolute inset-0 rounded-2xl bg-indigo-500/40 animate-ping" />}
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#060810]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-slate-500 font-medium">Alisa · AI Interviewer</p>
                {isSpeaking && (
                  <span className="flex items-center gap-1 text-xs text-indigo-400 font-medium">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />speaking
                  </span>
                )}
              </div>

              {/* Question */}
              <div className="flex items-start gap-3">
                <p className="text-white text-base sm:text-lg font-semibold leading-relaxed flex-1">
                  {questions[currentQuestionIndex]}
                </p>
                <button
                  onClick={() => speakQuestion(questions[currentQuestionIndex])}
                  disabled={isSpeaking || isAcknowledging}
                  title="Replay question"
                  className={`shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    isSpeaking ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-500 hover:bg-indigo-500/20 hover:text-indigo-400 border border-white/10'
                  } disabled:opacity-40`}
                >
                  <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-pulse' : ''}`} />
                </button>
              </div>

              {/* Tags */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-slate-500">Q{currentQuestionIndex + 1}/{questions.length}</span>
                {currentTopic && (
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 font-medium uppercase tracking-wider">{currentTopic}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Your Answer Area ── */}
        <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
          isProcessingAudio ? 'border-violet-500/40 bg-violet-500/5' :
          isRecording ? 'border-red-500/30 bg-red-500/4' :
          currentAnswer ? 'border-emerald-500/20 bg-emerald-500/4' :
          'border-white/8 bg-white/3'
        }`}>
          {/* Answer header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Response</p>
            {currentAnswer && !isRecording && !isProcessingAudio && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold">
                <CheckCircle className="w-3 h-3" /> Recorded
              </span>
            )}
            {isRecording && (
              <span className="flex items-center gap-1.5 text-[11px] text-red-400 font-semibold">
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />Recording
              </span>
            )}
            {isProcessingAudio && (
              <span className="flex items-center gap-1.5 text-[11px] text-violet-400 font-semibold">
                <div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />
                Processing
              </span>
            )}
          </div>

          {/* Answer body */}
          <div className="min-h-[120px] p-4 flex items-center justify-center">
            {isSpeaking && (
              <div className="text-center space-y-3">
                <div className="flex items-end gap-1 h-8 justify-center">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="w-1 bg-indigo-400/60 rounded-full" style={{ height: `${25 + Math.sin(i * 0.8) * 50}%`, animation: `audioBar 0.6s ease-in-out infinite`, animationDelay: `${i * 0.09}s` }} />
                  ))}
                </div>
                <p className="text-indigo-400 text-sm font-medium">Alisa is speaking</p>
                <p className="text-slate-600 text-xs">Your mic will activate automatically</p>
              </div>
            )}
            {!isSpeaking && isRecording && !isProcessingAudio && (
              <div className="text-center w-full space-y-3">
                <div className="flex items-end gap-1 h-10 justify-center">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="w-1.5 bg-red-400 rounded-full" style={{ animation: `audioBar 0.5s ease-in-out infinite`, animationDelay: `${i * 0.07}s`, height: `${20 + Math.abs(Math.sin(i * 0.7)) * 80}%` }} />
                  ))}
                </div>
                <p className="text-red-400 text-sm font-semibold">🎙 Listening — speak your answer</p>
                <p className="text-slate-600 text-xs">Will stop automatically after 2.5s of silence</p>
              </div>
            )}
            {isProcessingAudio && (
              <div className="text-center space-y-3">
                <div className="w-10 h-10 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin mx-auto" />
                <p className="text-violet-400 text-sm font-semibold">Transcribing your answer...</p>
              </div>
            )}
            {!isSpeaking && !isRecording && !isProcessingAudio && currentAnswer && (
              <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap w-full">{currentAnswer}</p>
            )}
            {!isSpeaking && !isRecording && !isProcessingAudio && !currentAnswer && (
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                  <Mic className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-slate-500 text-sm">Tap the mic button to start answering</p>
              </div>
            )}
          </div>

          {lastTranscript && (
            <div className="px-4 pb-4 border-t border-white/5 text-xs text-slate-400">
              <div className="font-semibold text-slate-500 mb-1">Last heard</div>
              <p className="whitespace-pre-wrap leading-6">{lastTranscript}</p>
            </div>
          )}
        </div>

        {/* ── Mic Button + Controls ── */}
        <div className="flex flex-col items-center gap-5">
          {/* Big mic button */}
          <div className="relative">
            {isRecording && (
              <>
                <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping scale-150" />
                <span className="absolute inset-0 rounded-full bg-red-500/10 animate-ping scale-125" style={{ animationDelay: '0.3s' }} />
              </>
            )}
            <button
              onClick={toggleRecording}
              disabled={isSpeaking || isAcknowledging || isProcessingAudio}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed ${
                isRecording
                  ? 'bg-red-500 shadow-red-900/60 scale-110'
                  : 'bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-900/60 hover:scale-105'
              }`}
            >
              {isRecording ? (
                <div className="w-6 h-6 bg-white rounded-sm" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </button>
          </div>

          <p className={`text-sm font-semibold transition-colors ${
            isProcessingAudio ? 'text-violet-400' :
            isSpeaking ? 'text-indigo-400' :
            isRecording ? 'text-red-400' : 'text-slate-500'
          }`}>
            {statusMessage || (isProcessingAudio ? 'Processing your answer...' :
             isSpeaking ? 'Alisa is speaking...' :
             isRecording ? 'Tap to stop · Auto-stops on silence' :
             'Tap to speak your answer')}
          </p>
          {audioError && (
            <p className="text-xs text-red-300 mt-1 max-w-md text-center">{audioError}</p>
          )}
          {needsManualRetry && !isRecording && (
            <p className="text-xs text-slate-400 mt-1 max-w-md text-center">The interview has paused so you can retry the response manually.</p>
          )}

          {/* Navigation Actions */}
          {currentAnswer && !isRecording && !isProcessingAudio && (
            <div className="flex items-center gap-3 w-full max-w-sm">
              <button
                onClick={handleReRecord}
                disabled={isAcknowledging}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-40 transition-all border border-white/10 hover:border-white/20"
              >
                ↺ Re-record
              </button>
              <button
                onClick={isLastQuestion ? (e) => handleSubmit(e, false) : handleDoneAndNext}
                disabled={isAcknowledging}
                className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 shadow-lg shadow-indigo-900/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLastQuestion ? 'Submit Interview ✓' : 'Next Question →'}
              </button>
            </div>
          )}
        </div>

        {/* ── Progress Footer ── */}
        <div className="border-t border-white/5 pt-4 mt-auto flex items-center justify-between text-xs text-slate-600">
          <span>{answeredCount} of {questions.length} answered</span>
          <button
            onClick={() => handleSubmit(null, false)}
            className="text-slate-600 hover:text-slate-400 transition-colors"
          >
            Submit all & finish
          </button>
        </div>

        {status === 'error' && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
            {errorMessage}
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes audioBar {
          0%, 100% { transform: scaleY(0.3); opacity: 0.6; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

