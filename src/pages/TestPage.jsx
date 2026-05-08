import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getTest, submitTest, gradeTest } from '../utils/googleSheets';
import {
  AlertTriangle, CheckCircle, Shield, Timer,
  Mic, Volume2, ChevronRight, ChevronLeft, Send,
  MicOff
} from 'lucide-react';
import SystemCheck from '../components/SystemCheck';

const ACKNOWLEDGMENTS = [
  'Okay, nice.',
  'Got it, thank you.',
  'I appreciate that.',
  'Great, thanks.',
  'Perfect.',
  'Thank you for that.',
  'Excellent.',
  'I see, good.'
];

const getRandomAcknowledgment = () => ACKNOWLEDGMENTS[Math.floor(Math.random() * ACKNOWLEDGMENTS.length)];

export default function TestPage() {
  const { id } = useParams();
  const [candidateName, setCandidateName] = useState('');
  const [introAccepted, setIntroAccepted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [correctAnswers, setCorrectAnswers] = useState([]);
  const [topics, setTopics] = useState([]);
  const [difficulty, setDifficulty] = useState([]);
  const [questionTypes, setQuestionTypes] = useState([]);
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState('loading');
  const [tabSwitches, setTabSwitches] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);

  const [systemCheckPassed, setSystemCheckPassed] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const recognitionRef = useRef(null);
  const autoStopRef = useRef(null);
  const ttsLockRef = useRef(false);        // true = TTS/ack in progress, block all auto-speak
  const pendingSpeakRef = useRef(null);    // queued question to speak after lock releases
  const browserSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition) && !!window.speechSynthesis;

  const voicesReadyRef = useRef(false);
  // Ensure voices are loaded before speaking (some browsers load asynchronously)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => { voicesReadyRef.current = (window.speechSynthesis.getVoices() || []).length > 0; };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch {} };
  }, []);

  const speakQuestion = useCallback((text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (ttsLockRef.current) return;  // locked during ack transition

    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
      || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
    utterance.rate = 0.92;
    utterance.pitch = 1.05;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    if (!voicesReadyRef.current) {
      setTimeout(() => { try { window.speechSynthesis.speak(utterance); } catch { setIsSpeaking(false); } }, 120);
    } else {
      try { window.speechSynthesis.speak(utterance); } catch { setIsSpeaking(false); }
    }
  }, []);

  const playIntro = useCallback(() => {
    const name = candidateName.trim();
    const introText = `Hello ${name || '[Name]'}, this is Alisa. I would like to have a quick and simple conversation to understand you better. It will not be a formal interview.`;
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
      playIntro();
    }
  }, [introAccepted, playIntro, status, systemCheckPassed]);

  const handleSubmit = useCallback(async (e, autoSubmit = false) => {
    if (e?.preventDefault) e.preventDefault();
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); }
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

  // ── Speech Recognition setup ──
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalAccumulator = '';
    const autoRestartRef = { count: 0 };

    recognition.onstart = () => {
      finalAccumulator = answers[currentQuestionIndex] || '';
    };

    recognition.onresult = (event) => {
      let interim = '';
      let newFinal = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          newFinal += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (newFinal) {
        const cleaned = newFinal.trim();
        const prevAns = finalAccumulator || '';
        // Avoid appending duplicate chunks (common on some mobile browsers)
        const lookback = Math.max(200, cleaned.length * 4);
        const tail = prevAns.slice(-lookback);
        if (cleaned && !tail.endsWith(cleaned)) {
          finalAccumulator = (prevAns + ' ' + cleaned).trim();
          // cap stored length to avoid runaway repeats
          if (finalAccumulator.length > 3000) finalAccumulator = finalAccumulator.slice(-3000);
          setAnswers(prev => ({ ...prev, [currentQuestionIndex]: finalAccumulator }));
        }
      }
      setInterimText(interim);

      // Auto-stop after 8s of silence via re-triggering
      clearTimeout(autoStopRef.current);
      autoStopRef.current = setTimeout(() => {
        // keep listening by default — user can stop manually
      }, 8000);
    };

    recognition.onend = () => {
      // if stopped unexpectedly while user still intends to record, try a few auto-restarts (mobile browsers)
      if (isRecording) {
        if (autoRestartRef.count < 3) {
          autoRestartRef.count += 1;
          setTimeout(() => {
            try { recognition.start(); } catch (e) { setIsRecording(false); }
          }, 250);
          return;
        }
      }
      autoRestartRef.count = 0;
      setIsRecording(false);
      setInterimText('');
    };

    recognition.onerror = () => {
      // treat errors similarly to end - attempt restart only if user expected recording
      if (isRecording && autoRestartRef.count < 3) {
        autoRestartRef.count += 1;
        setTimeout(() => { try { recognition.start(); } catch (e) { setIsRecording(false); } }, 300);
        return;
      }
      autoRestartRef.count = 0;
      setIsRecording(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {};
      clearTimeout(autoStopRef.current);
      try { window.speechSynthesis.cancel(); } catch {}
    };
    // CRITICAL: only depends on currentQuestionIndex, NOT answers
    // answers changes are handled in onresult, not by recreating recognition
  }, [currentQuestionIndex]);

  // ── Auto-start recording and speak question ──
  useEffect(() => {
    if (!systemCheckPassed || !introAccepted || status !== 'ready' || questions.length === 0) return;

    // CRITICAL: check lock ref — not state — avoids stale closure trap
    if (ttsLockRef.current) return;

    // Only auto-speak if question not yet answered
    const speakTimeout = setTimeout(() => {
      if (ttsLockRef.current) return;  // re-check after delay
      if (answers[currentQuestionIndex] === undefined) {
        speakQuestion(questions[currentQuestionIndex]);
      }
    }, 150);

    // Auto-record: By 300ms, TTS will definitely be playing
    // Use fixed timing rather than checking state to avoid effect re-runs
    const recordTimeout = setTimeout(() => {
      if (ttsLockRef.current) return;
      // Only start if: not already recording, question not yet answered
      if (recognitionRef.current && !isRecording && answers[currentQuestionIndex] === undefined) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (e) {
          console.warn('Auto-record failed:', e);
        }
      }
    }, 300);  // By 300ms, TTS will definitely be started

    return () => {
      clearTimeout(speakTimeout);
      clearTimeout(recordTimeout);
    };
    // CRITICAL: NO isSpeaking in deps - that causes re-runs when utterance.onstart fires
    // ONLY dep on question index and system flags. State checks are done inline.
  }, [currentQuestionIndex, systemCheckPassed, introAccepted, status, questions, speakQuestion]);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      try { recognitionRef.current.stop(); } catch (e) { console.warn(e); setIsRecording(false); }
      return;
    }
    // start
    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (error) {
      // some browsers throw InvalidStateError if start called too soon; recreate recognition and try once
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          const newRec = new SpeechRecognition();
          newRec.continuous = true;
          newRec.interimResults = true;
          newRec.lang = 'en-US';
          // copy over handlers from current ref if possible
          recognitionRef.current = newRec;
          newRec.start();
          setIsRecording(true);
        }
      } catch (e) {
        console.error('Speech start failed', e);
        setIsRecording(false);
      }
    }
  };

  const speakAcknowledgment = useCallback((questionCount, currentIdx, onDone) => {
    // Accept args instead of closing over state - no stale closure
    const ack = getRandomAcknowledgment();
    ttsLockRef.current = true;   // LOCK - prevents auto-effect from firing
    setIsAcknowledging(true);

    const finish = () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsAcknowledging(false);
      // delay before releasing lock + advancing index
      setTimeout(() => {
        ttsLockRef.current = false;  // UNLOCK
        onDone();
      }, 400);
    };

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTimeout(() => { ttsLockRef.current = false; onDone(); }, 300);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      const utterance = new SpeechSynthesisUtterance(ack);
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
        || voices.find(v => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    } catch {
      finish();
    }
  }, []);

  const handleDoneAndNext = () => {
    if (!recognitionRef.current) return;
    try { recognitionRef.current.stop(); } catch {}
    setIsRecording(false);

    const isLast = currentQuestionIndex === questions.length - 1;
    speakAcknowledgment(questions.length, currentQuestionIndex, () => {
      if (!isLast) {
        setCurrentQuestionIndex(p => p + 1);
      } else {
        handleSubmit(null, true);
      }
    });
  };

  const handleReRecord = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsRecording(false);
    setInterimText('');
    setAnswers(prev => ({ ...prev, [currentQuestionIndex]: undefined }));
    // Stop TTS if playing
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    // Delay longer to allow proper cleanup before restart
    setTimeout(() => {
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition && recognitionRef.current) {
          recognitionRef.current.start();
          setIsRecording(true);
        }
      } catch (e) {
        console.warn('Re-record restart failed', e);
        // If restart fails, try creating a fresh recognition instance
        try {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          const newRec = new SpeechRecognition();
          newRec.continuous = true;
          newRec.interimResults = true;
          newRec.lang = 'en-US';
          recognitionRef.current = newRec;
          newRec.start();
          setIsRecording(true);
        } catch (e2) {
          console.error('Re-record failed completely', e2);
          setIsRecording(false);
        }
      }
    }, 500);
  };

  const formatTime = (seconds) => {
    if (seconds <= 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleNext = () => {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); }
    if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(p => p + 1);
  };

  const handlePrev = () => {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); }
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(p => p - 1);
  };

  const diffLabel = { medium: 'Medium', hard: 'Hard', very_hard: 'Very Hard' };

  // ── Loading ──
  if (status === 'loading') return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center gap-5">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 bg-indigo-500 rounded-full animate-pulse" />
        </div>
      </div>
      <p className="text-slate-400 font-medium tracking-wide">Loading your interview...</p>
    </div>
  );

  // ── Success ──
  if (status === 'success') return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="relative max-w-md w-full">
        <div className="absolute inset-0 bg-emerald-500/10 rounded-3xl blur-xl" />
        <div className="relative bg-[#1a1d2e] border border-emerald-500/20 p-10 rounded-3xl text-center space-y-5">
          <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/10">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Interview Completed!</h2>
            <p className="text-slate-400 text-sm mt-2">Your responses have been recorded and are being reviewed by the HR team.</p>
          </div>
          <div className="bg-[#0f1117] rounded-2xl p-4 text-xs text-slate-500">
            You may now safely close this window.
          </div>
        </div>
      </div>
    </div>
  );

  // ── Already Completed ──
  if (status === 'already_done') return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="relative max-w-md w-full">
        <div className="absolute inset-0 bg-amber-500/8 rounded-3xl blur-xl" />
        <div className="relative bg-[#1a1d2e] border border-amber-500/20 p-10 rounded-3xl text-center space-y-4">
          <div className="w-16 h-16 bg-amber-500/15 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Already Submitted</h2>
          <p className="text-slate-400 text-sm">This interview has already been completed. Each assessment link can only be used once.</p>
          <p className="text-slate-600 text-xs">If you think this is an error, please contact your HR team.</p>
        </div>
      </div>
    </div>
  );

  // ── Browser Not Supported ──
  if (!browserSupported) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="bg-[#1a1d2e] border border-orange-500/20 p-8 rounded-3xl max-w-md w-full text-center space-y-4">
        <div className="text-4xl">🌐</div>
        <h2 className="text-xl font-bold text-white">Unsupported Browser</h2>
        <p className="text-slate-400 text-sm">This AI Interview requires voice features that are not supported in your browser.</p>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-left">
          <p className="text-orange-300 text-xs font-semibold mb-2">Please use one of these browsers:</p>
          <ul className="text-slate-400 text-xs space-y-1">
            <li>✅ Google Chrome (recommended)</li>
            <li>✅ Microsoft Edge</li>
            <li>✅ Safari (macOS / iOS)</li>
            <li>❌ Firefox (not supported)</li>
          </ul>
        </div>
      </div>
    </div>
  );

  // ── Error ──
  if (status === 'error' && !questions.length) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="bg-[#1a1d2e] border border-red-500/20 p-8 rounded-3xl max-w-md w-full text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">Oops!</h2>
        <p className="text-slate-400 text-sm mt-2">{errorMessage}</p>
      </div>
    </div>
  );

  // ── Grading / Submitting ──
  if (status === 'grading' || status === 'submitting') return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center gap-6">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-white font-semibold text-lg">
          {status === 'grading' ? '🤖 AI is evaluating your answers...' : '📤 Submitting results...'}
        </p>
        <p className="text-slate-500 text-sm mt-2">Please don't close this window.</p>
      </div>
    </div>
  );

  // ── System Check ──
  if (status === 'ready' && !systemCheckPassed) {
    return <SystemCheck onComplete={() => setSystemCheckPassed(true)} />;
  }

  if (status === 'ready' && systemCheckPassed && !introAccepted) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="relative max-w-xl w-full">
          <div className="absolute inset-0 bg-indigo-500/10 rounded-3xl blur-xl" />
          <div className="relative bg-[#1a1d2e] border border-white/10 rounded-3xl p-5 sm:p-8 shadow-2xl shadow-black/40">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0">
                <span className="text-white font-black text-lg sm:text-xl">A</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white">Hello {candidateName || '[Name]'}, this is Alisa.</h2>
                <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
                  I would like to have a quick and simple conversation to understand you better. It will not be a formal interview.
                </p>
                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setIntroAccepted(true)}
                    className="w-full sm:w-auto px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                  >
                    I am ready
                  </button>
                </div>
              </div>
            </div>
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

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">

      {/* ── Top Bar ── */}
      <header className="border-b border-white/5 bg-[#0f1117]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900">
              <span className="text-white font-black text-sm">H</span>
            </div>
            <span className="font-bold text-white text-sm hidden sm:block">AI Interview</span>
          </div>

          {/* Center: Progress dots */}
          <div className="flex items-center gap-1 flex-wrap justify-center max-w-[160px] sm:max-w-xs">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); }
                  setCurrentQuestionIndex(idx);
                }}
                className={`transition-all rounded-full ${
                  idx === currentQuestionIndex
                    ? 'w-5 h-2 bg-indigo-500'
                    : answers[idx]?.trim()
                    ? 'w-2 h-2 bg-emerald-500'
                    : 'w-2 h-2 bg-white/15 hover:bg-white/30'
                }`}
              />
            ))}
          </div>

          {/* Right: Timer + Shield */}
          <div className="flex items-center gap-2">
            {timeLeft !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                isTimeLow
                  ? 'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse'
                  : 'bg-white/5 text-slate-300 border border-white/10'
              }`}>
                <Timer className="w-3.5 h-3.5" />
                {formatTime(timeLeft)}
              </div>
            )}
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs hidden sm:flex">
              <Shield className="w-3 h-3" />
              <span>Monitored</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab-switch Warning ── */}
      {tabSwitches > 0 && (
        <div className="bg-red-600/90 backdrop-blur">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-sm font-semibold text-white">
              ⚠ Tab switch detected — {tabSwitches} time{tabSwitches > 1 ? 's' : ''}. Recorded for HR.
            </p>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col items-center px-3 sm:px-6 py-6 sm:py-8 max-w-3xl mx-auto w-full">

        {/* Question Counter */}
        <div className="w-full flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">
            Question {currentQuestionIndex + 1} / {questions.length}
          </span>
          <span className="text-xs text-slate-500">
            {answeredCount} of {questions.length} answered
          </span>
        </div>

        {/* ── Question Card ── */}
        <div className="w-full rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1d2e] via-[#161926] to-[#0f1119] shadow-2xl shadow-black/50 overflow-hidden mb-6 sm:mb-8">

          {/* Question Header */}
          <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-5 sm:pb-6 border-b border-white/5 bg-gradient-to-r from-indigo-500/5 to-transparent">
            <div className="flex items-start gap-4">
              {/* Replay TTS Button */}
              <button
                onClick={() => speakQuestion(questions[currentQuestionIndex])}
                title="Replay question audio"
                disabled={isSpeaking || isAcknowledging}
                className={`shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all ${
                  isSpeaking
                    ? 'bg-indigo-600 shadow-lg shadow-indigo-900/60'
                    : 'bg-white/5 hover:bg-indigo-600/20 border border-white/10'
                }`}
              >
                <Volume2 className={`w-4 h-4 sm:w-5 sm:h-5 ${isSpeaking ? 'text-white animate-pulse' : 'text-slate-400'}`} />
              </button>

              <div className="flex-1 min-w-0">
                {/* Tags */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {currentTopic && (
                    <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 font-medium uppercase tracking-wider">
                      {currentTopic}
                    </span>
                  )}
                  {currentDiff && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                      currentDiff === 'medium' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      currentDiff === 'hard' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {diffLabel[currentDiff] || currentDiff}
                    </span>
                  )}
                </div>
                {/* Question Text */}
                <p className="text-white font-bold text-lg sm:text-xl leading-relaxed">
                  {questions[currentQuestionIndex]}
                </p>
              </div>
            </div>
          </div>

          {/* Answer Display */}
          <div className="px-4 sm:px-8 py-5 sm:py-7">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Your Answer</span>
              {currentAnswer && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <CheckCircle className="w-3.5 h-3.5" /> Recorded
                </span>
              )}
            </div>

            {/* Answer Box - read-only display */}
            <div className={`relative min-h-[140px] rounded-2xl border p-5 transition-all backdrop-blur-sm ${
              isSpeaking
                ? 'border-indigo-500/40 bg-indigo-500/5'
                : isRecording
                ? 'border-red-500/40 bg-red-500/5'
                : currentAnswer
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-white/8 bg-white/3'
            }`}>
              {isSpeaking && (
                <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                    <p className="text-indigo-300 text-sm font-medium">Alisa is speaking...</p>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <p className="text-xs text-slate-500">Listening will start after</p>
                </div>
              )}
              {!isSpeaking && isRecording && interimText && (
                <p className="text-slate-300 text-sm leading-relaxed font-medium">
                  {currentAnswer && <span className="text-slate-200">{currentAnswer} </span>}
                  <span className="text-slate-400">{interimText}</span>
                  <span className="animate-pulse ml-1 text-red-400">|</span>
                </p>
              )}
              {!isSpeaking && !isRecording && currentAnswer && (
                <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-medium">{currentAnswer}</p>
              )}
              {!isSpeaking && !isRecording && !currentAnswer && !isSpeaking && (
                <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-slate-300 text-sm font-medium">Tap the mic to speak</p>
                    <p className="text-xs text-slate-500 mt-1">Keep it natural and conversational</p>
                  </div>
                </div>
              )}
              {!isSpeaking && isRecording && !interimText && !currentAnswer && (
                <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-center gap-3">
                  <div className="flex gap-1 h-6 items-end">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-red-400 rounded-full"
                        style={{
                          animation: `bounce 0.6s ease-in-out infinite`,
                          animationDelay: `${i * 0.1}s`,
                          height: `${30 + (i % 2) * 10}%`
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-red-400 text-sm font-medium">🎙 Listening... speak now</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Microphone Button ── */}
        <div className="flex flex-col items-center gap-4 mb-8 sm:mb-10">
          <button
            onClick={toggleRecording}
            disabled={isSpeaking || isAcknowledging}
            className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl active:scale-95 disabled:opacity-50 ${
              isRecording
                ? 'bg-red-500 shadow-red-900/60 scale-110'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/60 hover:scale-105'
            }`}
            style={{ width: isSpeaking ? '80px' : isRecording ? '80px' : '80px' }}
          >
            {/* Pulse rings when recording */}
            {isRecording && (
              <>
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />
                <span className="absolute inset-[-8px] rounded-full border border-red-500/30 animate-ping opacity-20" />
              </>
            )}
            {isRecording ? (
              <div className="flex items-end gap-1 h-8 px-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-white rounded-full"
                    style={{
                      animation: `bounce 0.6s ease-in-out infinite`,
                      animationDelay: `${i * 0.1}s`,
                      height: `${40 + Math.sin(i * 1.5) * 30}%`
                    }}
                  />
                ))}
              </div>
            ) : (
              <Mic className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            )}
          </button>
          <div className="text-center">
            <p className={`text-sm font-semibold transition-colors ${
              isSpeaking
                ? 'text-indigo-400'
                : isRecording
                ? 'text-red-400'
                : 'text-slate-400'
            }`}>
              {isSpeaking ? 'Alisa is speaking...' : isRecording ? 'Tap to stop recording' : 'Tap the mic to speak'}
            </p>
            {!isSpeaking && !isRecording && (
              <p className="text-xs text-slate-500 mt-1">Answer naturally and conversationally</p>
            )}
          </div>
        </div>

        {/* ── Navigation ── */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
          {currentAnswer ? (
            <>
              <button
                onClick={handleReRecord}
                disabled={isRecording || isAcknowledging}
                className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-50 transition-all border border-white/10 hover:border-white/20"
              >
                ↺ Re-record
              </button>
              <button
                onClick={handleDoneAndNext}
                disabled={isRecording || isAcknowledging}
                className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 shadow-lg shadow-indigo-900/40 transition-all hover:shadow-indigo-900/60"
              >
                I'm done, Next →
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500 italic">Waiting for your answer...</p>
          )}
        </div>

        {status === 'error' && (
          <div className="mt-4 w-full text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
            {errorMessage}
          </div>
        )}
      </main>

      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        @keyframes bounce {
          0%, 100% { transform: scaleY(0.4); opacity: 0.8; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .animate-wave {
          animation: wave 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
