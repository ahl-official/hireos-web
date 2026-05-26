import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getTest } from '../utils/googleSheets';
import {
  startInterviewSession,
  saveInterviewAuditEvent,
  submitInterview,
} from '../services/interviewApi';
import { useInterviewSession } from '../hooks/useInterviewSession';
import { INTERVIEW_STATUS } from '../utils/interviewStates';

// Layout Components
import { ProgressBar, InterviewWarning } from '../components/interview/InterviewLayout';
import AlisaFacePanel from '../components/interview/AlisaFacePanel';
import InterviewActionBar from '../components/interview/InterviewActionBar';

// State Screens
import SystemCheck from '../components/SystemCheck';
import {
  WelcomeScreen,
  TutorialGuide,
  InterviewInstructions,
  PracticeReadyScreen,
} from '../components/interview/PreInterviewScreens';
import {
  InteractionReady,
  RecordingCountdown,
  InteractionSpeaking,
  InteractionRecording,
  InteractionProcessing,
  TranscriptReview,
} from '../components/interview/InteractionScreens';
import {
  FinalReview,
  SubmittingScreen,
  CompletionScreen,
} from '../components/interview/PostInterviewScreens';

import { AlertTriangle, Shield, RefreshCw } from 'lucide-react';

export default function TestPage() {
  const { id } = useParams();
  const [candidateId] = useState(id);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePosition, setCandidatePosition] = useState('');
  const [questions, setQuestions] = useState([]);
  const [appStatus, setAppStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [sttInterviewId, setSttInterviewId] = useState(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [voiceDetected, setVoiceDetected] = useState(false);
  const [lastVoiceTime, setLastVoiceTime] = useState(0);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [submitError, setSubmitError] = useState(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isSystemReady, setIsSystemReady] = useState(false);

  // ── Recording Countdowns ──
  const [prepTimeLeft, setPrepTimeLeft] = useState(20);
  const [countdownTimeLeft, setCountdownTimeLeft] = useState(3);
  const [isCountingDown, setIsCountingDown] = useState(false);

  const {
    status,
    setStatus,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    audioError,
    recordingTime,
    volumeLevel,
    transcript,
    setCurrentTranscript,
    speak,
    speakQuestion,
    stopSpeaking,
    unlockAudio,
    startAnswerRecording,
    finishAnswerRecording,
    retryAnswer,
    confirmAnswerAction,
    jumpToQuestion,
  } = useInterviewSession(questions, sttInterviewId, candidateId, candidateName);

  // ── Initialization ──
  const fetchTestData = useCallback(async () => {
    if (!id) return;
    setAppStatus('loading');
    try {
      const data = await getTest(id);
      if (!data || data.status === 'error') {
        setAppStatus('error');
        setErrorMessage(data?.message || 'Assessment not found.');
        return;
      }
      if (data.status === 'Completed') {
        setAppStatus('completed_already');
        return;
      }

      console.log('[TestPage] fetchTestData success:', data);
      setCandidateName((data.name || '').trim());
      setCandidateEmail(data.email || '');
      setCandidatePosition(data.position || '');

      // Zero-Crash Parsing Helper
      const safeParse = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'object') return [val];
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          console.error('[TestPage] Parse error for value:', val);
          return [];
        }
      };

      setQuestions(safeParse(data.questions));
      setTimeLeft(Number(data.timeLimit || 15) * 60);
      setAppStatus('ready');
      setStatus(INTERVIEW_STATUS.WELCOME);
    } catch (err) {
      console.error('[TestPage] fetchTestData fatal error:', err);
      setAppStatus('error');
      setErrorMessage('Failed to load assessment. Technical error encountered.');
    }
  }, [id, setStatus]);

  useEffect(() => {
    fetchTestData();
  }, [fetchTestData]);

  // ── Audit ──
  useEffect(() => {
    if (sttInterviewId)
      saveInterviewAuditEvent({
        interviewId: sttInterviewId,
        candidateId,
        eventType: 'INTERVIEW_STARTED',
      });
  }, [sttInterviewId, candidateId]);

  // ── Tab Switch ──
  useEffect(() => {
    const ignore = [
      INTERVIEW_STATUS.IDLE,
      INTERVIEW_STATUS.WELCOME,
      INTERVIEW_STATUS.COMPLETED,
      INTERVIEW_STATUS.SYSTEM_CHECK,
      INTERVIEW_STATUS.TUTORIAL,
    ];
    if (ignore.includes(status)) return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches((p) => {
          const count = p + 1;
          if (sttInterviewId)
            saveInterviewAuditEvent({
              interviewId: sttInterviewId,
              candidateId,
              eventType: 'TAB_SWITCH_DETECTED',
              details: `Tab switch detected. Total: ${count}`,
              tabSwitches: count,
            });
          return count;
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [status, sttInterviewId, candidateId]);

  // ── Silence & Voice Detection ──
  useEffect(() => {
    if (volumeLevel > 10) {
      if (!voiceDetected) setVoiceDetected(true);
      setLastVoiceTime(recordingTime);
    } else {
      if (voiceDetected) setVoiceDetected(false);
    }
  }, [volumeLevel, recordingTime, voiceDetected]);

  useEffect(() => {
    if (status !== INTERVIEW_STATUS.RECORDING) {
      if (silenceDuration > 0) setSilenceDuration(0);
      return;
    }
    if (voiceDetected) {
      setSilenceDuration(0);
    } else {
      setSilenceDuration(recordingTime - (lastVoiceTime || 0));
    }
  }, [status, voiceDetected, recordingTime, lastVoiceTime]);

  const handleFinalSubmit = useCallback(
    async (e) => {
      if (status === INTERVIEW_STATUS.SUBMITTING && !submitError) return;
      setStatus(INTERVIEW_STATUS.SUBMITTING);
      setSubmitError(null);
      try {
        console.log('[TestPage] Final submission initiated');
        await submitInterview({ interviewId: sttInterviewId, candidateId, candidateName });
        setStatus(INTERVIEW_STATUS.COMPLETED);
      } catch (err) {
        console.error('[TestPage] handleFinalSubmit error:', err);
        const backendMsg = err.response?.data?.message || err.message || 'Unknown submission error';
        setSubmitError(backendMsg);
      }
    },
    [status, submitError, sttInterviewId, candidateId, candidateName, setStatus]
  );

  // ── Timer ──
  useEffect(() => {
    const ignore = [
      INTERVIEW_STATUS.WELCOME,
      INTERVIEW_STATUS.COMPLETED,
      INTERVIEW_STATUS.SYSTEM_CHECK,
      INTERVIEW_STATUS.TUTORIAL,
    ];
    if (appStatus !== 'ready' || ignore.includes(status)) return;

    if (timeLeft !== null && timeLeft <= 0) {
      handleFinalSubmit(null);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev !== null && prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit(null);
          return 0;
        }
        return prev !== null ? prev - 1 : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appStatus, status]);

  // ── Reset Countdown State on Status Change ──
  if (
    status !== INTERVIEW_STATUS.READY_TO_ANSWER &&
    (prepTimeLeft !== 20 || countdownTimeLeft !== 3 || isCountingDown)
  ) {
    setPrepTimeLeft(20);
    setCountdownTimeLeft(3);
    setIsCountingDown(false);
  }

  // ── Countdown Effect ──
  useEffect(() => {
    if (status !== INTERVIEW_STATUS.READY_TO_ANSWER) return;

    let timer;
    if (!isCountingDown && prepTimeLeft > 0) {
      timer = setInterval(() => setPrepTimeLeft((p) => p - 1), 1000);
    } else if (!isCountingDown && prepTimeLeft === 0) {
      setIsCountingDown(true);
    } else if (isCountingDown && countdownTimeLeft > 0) {
      timer = setInterval(() => setCountdownTimeLeft((c) => c - 1), 1000);
    } else if (isCountingDown && countdownTimeLeft === 0) {
      saveInterviewAuditEvent({
        interviewId: sttInterviewId,
        candidateId,
        eventType: 'ANSWER_RECORDING_STARTED',
        questionNo: currentQuestionIndex + 1,
      });
      startAnswerRecording();
    }

    return () => clearInterval(timer);
  }, [
    status,
    isCountingDown,
    prepTimeLeft,
    countdownTimeLeft,
    sttInterviewId,
    candidateId,
    currentQuestionIndex,
    startAnswerRecording,
  ]);

  const handleStartCountdownManual = () => {
    if (isCountingDown) return;
    setIsCountingDown(true);
    setPrepTimeLeft(0);
  };

  // ── Actions ──
  const handleStartInterview = async () => {
    setIsStartingSession(true);
    try {
      console.log('[TestPage] handleStartInterview initiated');
      const res = await startInterviewSession({
        candidateId,
        candidateName,
        candidateEmail,
        candidatePhone: '',
        roleApplied: candidatePosition,
        totalQuestions: questions.length,
      });

      if (!res.interviewId) {
        throw new Error('No interviewId received from server.');
      }

      setSttInterviewId(res.interviewId);
      setStatus(INTERVIEW_STATUS.SYSTEM_CHECK);
    } catch (e) {
      console.error('[TestPage] handleStartInterview error:', e);
      setAppStatus('error');
      setErrorMessage(e.message || 'Failed to initialize session. Please check your connection.');
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleFinishRecording = () => {
    saveInterviewAuditEvent({
      interviewId: sttInterviewId,
      candidateId,
      eventType: 'ANSWER_RECORDING_FINISHED',
      questionNo: currentQuestionIndex + 1,
    });
    const currentQuestionText =
      currentQuestionIndex === -1
        ? 'Practice'
        : questions[currentQuestionIndex] || 'Question text missing';
    finishAnswerRecording(currentQuestionText, currentQuestionIndex === -1);
  };

  const formatTime = (s) => {
    if (s === null || s === undefined) return '0:00';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Render Helpers ──
  const getAlisaStatus = () => {
    switch (status) {
      case INTERVIEW_STATUS.SPEAKING:
        return 'Speaking';
      case INTERVIEW_STATUS.READY_TO_ANSWER:
        return 'Listening';
      case INTERVIEW_STATUS.RECORDING:
        return 'Listening';
      case INTERVIEW_STATUS.PROCESSING_AUDIO:
        return 'Analyzing';
      case INTERVIEW_STATUS.TRANSCRIPT_REVIEW:
        return 'Reviewing';
      case INTERVIEW_STATUS.SAVING_ANSWER:
        return 'Processing';
      default:
        return 'Ready';
    }
  };

  const getActiveTab = () => {
    switch (status) {
      case INTERVIEW_STATUS.SPEAKING:
        return 'speaking';
      case INTERVIEW_STATUS.READY_TO_ANSWER:
        return 'ready';
      case INTERVIEW_STATUS.RECORDING:
        return 'recording';
      case INTERVIEW_STATUS.PROCESSING_AUDIO:
        return 'processing';
      case INTERVIEW_STATUS.TRANSCRIPT_REVIEW:
        return 'transcript';
      case INTERVIEW_STATUS.SAVING_ANSWER:
        return 'transcript';
      default:
        return '';
    }
  };

  const showTwoColumnLayout = [
    INTERVIEW_STATUS.SPEAKING,
    INTERVIEW_STATUS.READY_TO_ANSWER,
    INTERVIEW_STATUS.RECORDING,
    INTERVIEW_STATUS.PROCESSING_AUDIO,
    INTERVIEW_STATUS.TRANSCRIPT_REVIEW,
    INTERVIEW_STATUS.SAVING_ANSWER,
    INTERVIEW_STATUS.NEXT_QUESTION,
  ].includes(status);

  // ── Render Logic ──

  if (appStatus === 'loading')
    return (
      <div className="h-screen bg-[#060810] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-indigo-900/20 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-bold tracking-widest uppercase text-[10px]">
          Initializing Secure Environment
        </p>
      </div>
    );

  if (appStatus === 'error')
    return (
      <div className="min-h-screen bg-[#060810] flex items-center justify-center p-6 text-slate-200">
        <div className="bg-[#0d1117] border border-white/5 rounded-2xl p-10 shadow-2xl relative overflow-hidden max-w-md w-full text-center">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/0 via-red-500/40 to-red-500/0 opacity-30" />
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Access Restricted</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            {errorMessage || 'This assessment link is invalid or has expired.'}
            <br />
            <span className="text-[10px] text-slate-600 uppercase tracking-widest mt-2 block font-bold">
              Error: {id ? `ID ${id} not found` : 'Missing ID'}
            </span>
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={fetchTestData}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Retry Connection
            </button>
          </div>
        </div>
      </div>
    );

  if (appStatus === 'completed_already' || status === INTERVIEW_STATUS.COMPLETED)
    return (
      <div className="h-screen bg-[#060810] flex items-center justify-center">
        <CompletionScreen candidateName={candidateName} speak={speak} />
      </div>
    );

  return (
    <div className="h-[100dvh] bg-[#060810] text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* 1. SaaS Header */}
      <header className="shrink-0 z-50 border-b border-white/5 bg-[#0B1020]/80 backdrop-blur-2xl px-6 lg:px-10 py-2 flex items-center justify-between h-[52px]">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/20">
            <span className="text-white font-black text-[10px]">H</span>
          </div>
          <h1 className="text-[11px] font-bold tracking-widest text-white uppercase leading-none">
            HireOS
          </h1>
        </div>

        {questions.length > 0 && showTwoColumnLayout && (
          <div className="hidden sm:block">
            <ProgressBar
              total={questions.length}
              current={currentQuestionIndex}
              answers={answers}
            />
          </div>
        )}

        <div className="flex items-center gap-4">
          {timeLeft !== null && showTwoColumnLayout && (
            <div
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
                timeLeft < 60
                  ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
                  : 'bg-white/5 text-slate-400 border-white/10'
              }`}
            >
              {formatTime(timeLeft)}
            </div>
          )}
          <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
          <div className="flex flex-col items-end hidden sm:flex text-right">
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1 truncate max-w-[120px]">
              {candidatePosition || 'Technical Assessment'}
            </span>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-tighter leading-none truncate max-w-[120px]">
              {candidateName || 'Candidate'}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Area */}
      <main className="flex-1 min-h-0 p-4 lg:p-8 overflow-hidden">
        {showTwoColumnLayout ? (
          <div className="h-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 min-h-0 items-start">
            {/* Left Column: Interview Content */}
            <div className="h-full flex flex-col min-h-0 overflow-hidden">
              {/* Mobile Alisa Header */}
              <div className="lg:hidden mb-4 shrink-0 mx-auto w-[160px]">
                <AlisaFacePanel
                  isSpeaking={status === INTERVIEW_STATUS.SPEAKING}
                  status={getAlisaStatus()}
                  posterSrc="/alisa_poster.png"
                  compact={true}
                />
              </div>

              <div className="flex-1 flex flex-col min-h-0 justify-start pt-2 lg:pt-4">
                {status === INTERVIEW_STATUS.SPEAKING && (
                  <InteractionSpeaking
                    questions={questions}
                    currentQuestionIndex={currentQuestionIndex}
                    onSkip={() => {
                      stopSpeaking();
                      setStatus(INTERVIEW_STATUS.READY_TO_ANSWER);
                    }}
                  />
                )}
                {status === INTERVIEW_STATUS.READY_TO_ANSWER &&
                  (isCountingDown ? (
                    <RecordingCountdown seconds={countdownTimeLeft} />
                  ) : (
                    <InteractionReady
                      audioError={audioError}
                      questions={questions}
                      currentQuestionIndex={currentQuestionIndex}
                      speakQuestion={speakQuestion}
                      onStartCountdownManual={handleStartCountdownManual}
                    />
                  ))}
                {status === INTERVIEW_STATUS.RECORDING && (
                  <InteractionRecording
                    formatTime={formatTime}
                    recordingTime={recordingTime}
                    volumeLevel={volumeLevel}
                    questions={questions}
                    currentQuestionIndex={currentQuestionIndex}
                  />
                )}
                {status === INTERVIEW_STATUS.PROCESSING_AUDIO && (
                  <InteractionProcessing transcriptError={audioError} onRetry={retryAnswer} />
                )}
                {(status === INTERVIEW_STATUS.TRANSCRIPT_REVIEW ||
                  status === INTERVIEW_STATUS.SAVING_ANSWER) && (
                  <TranscriptReview
                    transcript={transcript}
                    onTranscriptChange={setCurrentTranscript}
                    isSaving={status === INTERVIEW_STATUS.SAVING_ANSWER}
                    questions={questions}
                    currentQuestionIndex={currentQuestionIndex}
                  />
                )}
                {status === INTERVIEW_STATUS.NEXT_QUESTION && (
                  <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                    <h2 className="text-lg font-bold text-white">Preparing Next Question...</h2>
                  </div>
                )}
                {/* Fallback for unmapped status in two column layout */}
                {![
                  INTERVIEW_STATUS.SPEAKING,
                  INTERVIEW_STATUS.READY_TO_ANSWER,
                  INTERVIEW_STATUS.RECORDING,
                  INTERVIEW_STATUS.PROCESSING_AUDIO,
                  INTERVIEW_STATUS.TRANSCRIPT_REVIEW,
                  INTERVIEW_STATUS.SAVING_ANSWER,
                  INTERVIEW_STATUS.NEXT_QUESTION,
                ].includes(status) && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-indigo-900/20 border-t-indigo-600 rounded-full animate-spin mb-4" />
                    <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">
                      Synchronizing Interview Engine...
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Pinned Alisa */}
            <div className="hidden lg:flex flex-col h-full min-h-0 overflow-hidden py-1">
              <div className="flex-1 flex flex-col items-center justify-start min-h-0">
                <AlisaFacePanel
                  isSpeaking={status === INTERVIEW_STATUS.SPEAKING}
                  status={getAlisaStatus()}
                  posterSrc="/alisa_poster.png"
                />

                <div className="mt-4 w-full p-3 rounded-lg bg-white/[0.01] border border-white/5 opacity-40">
                  <div className="flex items-center justify-between text-[8px] uppercase tracking-widest">
                    <span className="text-slate-600">Secure Session</span>
                    <Shield className="w-3 h-3 text-emerald-500/50" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Full Width Layouts */
          <div className="h-full flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
            {status === INTERVIEW_STATUS.IDLE && (
              <div className="flex-1 flex flex-col items-center justify-center animate-fade-in my-auto">
                <div className="w-12 h-12 border-4 border-indigo-900/20 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">
                  Preparing your interview...
                </p>
              </div>
            )}
            {status === INTERVIEW_STATUS.WELCOME && (
              <WelcomeScreen
                candidateName={candidateName}
                onStart={() => {
                  unlockAudio();
                  handleStartInterview();
                }}
                isStarting={isStartingSession}
                speak={speak}
              />
            )}
            {status === INTERVIEW_STATUS.SYSTEM_CHECK && (
              <SystemCheck
                onStateChange={setIsSystemReady}
                isSystemReady={isSystemReady}
                onContinue={() => setStatus(INTERVIEW_STATUS.TUTORIAL)}
              />
            )}
            {status === INTERVIEW_STATUS.TUTORIAL && (
              <TutorialGuide onContinue={() => setStatus(INTERVIEW_STATUS.PRACTICE_QUESTION)} speak={speak} />
            )}
            {status === INTERVIEW_STATUS.PRACTICE_QUESTION && (
              <PracticeReadyScreen
                setStatus={setStatus}
                onStartCountdownManual={handleStartCountdownManual}
                speakQuestion={speakQuestion}
              />
            )}
            {status === INTERVIEW_STATUS.INSTRUCTIONS && (
              <InterviewInstructions
                questionCount={questions.length}
                onStart={() => {
                  setCurrentQuestionIndex(0);
                  speakQuestion(questions?.[0] || 'Hello, are you ready for the first question?');
                }}
              />
            )}
            {status === INTERVIEW_STATUS.FINAL_REVIEW && (
              <FinalReview
                questions={questions}
                answers={answers}
                tabSwitches={tabSwitches}
                onJumpToQuestion={jumpToQuestion}
                onSubmit={handleFinalSubmit}
              />
            )}
            {status === INTERVIEW_STATUS.SUBMITTING && (
              <SubmittingScreen
                submitError={submitError}
                onRetry={handleFinalSubmit}
                speak={speak}
              />
            )}
            {/* Fallback for unmapped status in full width layout */}
            {![
              INTERVIEW_STATUS.IDLE,
              INTERVIEW_STATUS.WELCOME,
              INTERVIEW_STATUS.SYSTEM_CHECK,
              INTERVIEW_STATUS.TUTORIAL,
              INTERVIEW_STATUS.PRACTICE_QUESTION,
              INTERVIEW_STATUS.INSTRUCTIONS,
              INTERVIEW_STATUS.FINAL_REVIEW,
              INTERVIEW_STATUS.SUBMITTING,
            ].includes(status) && (
              <div className="flex-1 flex flex-col items-center justify-center my-auto">
                <div className="w-12 h-12 border-4 border-indigo-900/20 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">
                  Redirecting to next phase...
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 3. Footer */}
      {(showTwoColumnLayout || status === INTERVIEW_STATUS.SAVING_ANSWER) && (
        <InterviewActionBar
          state={getActiveTab()}
          onStart={handleStartCountdownManual}
          onStop={handleFinishRecording}
          onConfirm={() =>
            confirmAnswerAction(
              transcript,
              currentQuestionIndex === -1,
              currentQuestionIndex === -1
                ? 'PRACTICE'
                : questions?.[currentQuestionIndex] || 'Question text'
            )
          }
          onReplay={() =>
            speakQuestion(
              currentQuestionIndex === -1
                ? "Please say 'My microphone is working properly' to test your audio."
                : questions?.[currentQuestionIndex] || 'Question text'
            )
          }
          onRestart={retryAnswer}
        />
      )}

      {/* Tab Switch Warning Overlay */}
      <InterviewWarning tabSwitches={tabSwitches} status={status} />
    </div>
  );
}
