import React from 'react';
import {
  ArrowRight,
  Play,
  Mic,
  RotateCcw,
  StopCircle,
  Check,
  Loader2,
  User,
  Award,
  Shield,
  AlertTriangle,
  Bot,
} from 'lucide-react';
import { INTERVIEW_STATUS } from '../../utils/interviewStates';

export const ProgressBar = ({ total, current, answers }) => {
  return (
    <div className="flex items-center gap-2">
      {[...Array(total)].map((_, idx) => (
        <div
          key={idx}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            idx === current
              ? 'w-8 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
              : answers[idx]
                ? 'w-2 bg-emerald-500'
                : 'w-2 bg-white/10'
          }`}
        />
      ))}
    </div>
  );
};

export const InterviewHeader = ({
  questions,
  status,
  currentQuestionIndex,
  answers,
  timeLeft,
  formatTime,
}) => {
  const isHidden = [
    INTERVIEW_STATUS.IDLE,
    INTERVIEW_STATUS.WELCOME,
    INTERVIEW_STATUS.SYSTEM_CHECK,
    INTERVIEW_STATUS.TUTORIAL,
  ].includes(status);

  return (
    <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-500/20 border border-indigo-500/30 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
          <span className="text-indigo-400 font-black text-sm">H</span>
        </div>
        <span className="text-slate-200 font-bold text-sm tracking-tight hidden sm:inline">
          HireOS AI
        </span>
      </div>

      <div className="flex items-center gap-4">
        {questions.length > 0 && !isHidden && (
          <div className="hidden sm:block">
            <ProgressBar
              total={questions.length}
              current={currentQuestionIndex}
              answers={answers}
            />
          </div>
        )}

        {timeLeft !== null && !isHidden && (
          <div
            className={`px-4 py-1.5 rounded-lg text-xs font-bold border backdrop-blur-md ${
              timeLeft < 60
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                : 'bg-white/5 text-slate-300 border-white/10'
            }`}
          >
            {formatTime(timeLeft)}
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-black uppercase tracking-[0.1em] text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative rounded-full h-2 w-2 bg-cyan-400"></span>
          </span>
          {status.replace(/_/g, ' ')}
        </div>
      </div>
    </div>
  );
};

export const InterviewContentHeader = ({ status, statusMessage, recordingTime, formatTime }) => {
  const isVisible = [
    INTERVIEW_STATUS.RECORDING,
    INTERVIEW_STATUS.TRANSCRIPT_REVIEW,
    INTERVIEW_STATUS.READY_TO_ANSWER,
    INTERVIEW_STATUS.SPEAKING,
  ].includes(status);

  if (!isVisible) return null;

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            status === INTERVIEW_STATUS.RECORDING
              ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]'
              : status === INTERVIEW_STATUS.TRANSCRIPT_REVIEW
                ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]'
          }`}
        />
        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {status === INTERVIEW_STATUS.RECORDING ? 'Recording Active' : statusMessage}
        </span>
      </div>
      {status === INTERVIEW_STATUS.RECORDING && (
        <div className="text-[11px] sm:text-xs font-mono text-cyan-400 font-bold bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20 shadow-inner">
          {formatTime(recordingTime)}
        </div>
      )}
    </div>
  );
};

export const InterviewFooter = ({
  status,
  isSystemReady,
  currentQuestionIndex,
  questions,
  answers,
  transcript,
  submitError,
  isCountingDown,
  setStatus,
  speakQuestion,
  handleStartCountdownManual,
  handleFinishRecording,
  retryAnswer,
  confirmAnswerAction,
  setCurrentQuestionIndex,
  handleFinalSubmit,
  sttInterviewId,
  candidateId,
  saveInterviewAuditEvent,
}) => {
  // SYSTEM_CHECK now handles its own footer within the SystemCheck component

  // TUTORIAL now handles its own footer within the TutorialGuide component

  // PRACTICE_QUESTION handles its own inline button
  // INSTRUCTIONS handles its own inline button

  if (status === INTERVIEW_STATUS.READY_TO_ANSWER) {
    return (
      <div className="flex flex-col items-center gap-4 w-full">
        <button
          onClick={handleStartCountdownManual}
          disabled={isCountingDown}
          className={`w-full sm:w-72 h-[56px] rounded-xl text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg ${
            isCountingDown
              ? 'bg-slate-800/80 cursor-not-allowed opacity-50 border border-white/10'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-[0_0_20px_rgba(34,211,238,0.4)] border border-cyan-300'
          }`}
        >
          {isCountingDown ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-white" /> Get ready...
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" /> Start Answer Now
            </>
          )}
        </button>
        {!isCountingDown && (
          <button
            onClick={() =>
              speakQuestion(
                currentQuestionIndex === -1
                  ? "Please say 'My microphone is working properly' to test your audio."
                  : questions[currentQuestionIndex]
              )
            }
            className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-[0.2em] flex items-center gap-2 py-1 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Replay Question
          </button>
        )}
      </div>
    );
  }

  if (status === INTERVIEW_STATUS.RECORDING) {
    return (
      <div className="flex flex-col items-center gap-4 w-full">
        <button
          onClick={handleFinishRecording}
          className="w-full sm:w-72 h-[56px] rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-indigo-400/50"
        >
          <StopCircle className="w-5 h-5" /> Finish Answer
        </button>
        <button
          onClick={retryAnswer}
          className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-[0.2em] flex items-center gap-2 py-1 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Record Again
        </button>
      </div>
    );
  }

  if (status === INTERVIEW_STATUS.TRANSCRIPT_REVIEW || status === INTERVIEW_STATUS.SAVING_ANSWER) {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xl mx-auto">
        {transcript && (
          <button
            onClick={() =>
              confirmAnswerAction(
                transcript,
                currentQuestionIndex === -1,
                currentQuestionIndex === -1 ? 'Practice' : questions[currentQuestionIndex]
              )
            }
            disabled={status === INTERVIEW_STATUS.SAVING_ANSWER}
            className="w-full sm:flex-1 h-[52px] rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-indigo-400/50"
          >
            {status === INTERVIEW_STATUS.SAVING_ANSWER ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {status === INTERVIEW_STATUS.SAVING_ANSWER ? 'Saving...' : 'Confirm & Continue'}
          </button>
        )}
        <button
          onClick={retryAnswer}
          disabled={status === INTERVIEW_STATUS.SAVING_ANSWER}
          className="w-full sm:w-auto min-w-[180px] h-[52px] rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-black uppercase tracking-widest text-[11px] border border-white/10 flex items-center justify-center gap-2 transition-all active:scale-95 backdrop-blur-sm"
        >
          Record Again
        </button>
      </div>
    );
  }

  // INSTRUCTIONS handles its own inline button

  if (status === INTERVIEW_STATUS.FINAL_REVIEW) {
    const isReadyToSubmit = Object.keys(answers).length === questions.length;
    return (
      <button
        onClick={handleFinalSubmit}
        disabled={!isReadyToSubmit}
        className={`w-full sm:w-80 h-[52px] font-black uppercase tracking-widest text-[11px] rounded-xl shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${
          isReadyToSubmit
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-amber-300'
            : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
        }`}
      >
        <span>Submit Interview</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    );
  }

  return null;
};

export const InterviewBottomBar = ({ candidateName, candidatePosition }) => {
  return (
    <footer className="py-3 px-4 sm:px-10 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 bg-[#0a0e1a]/80 backdrop-blur-xl border-t border-white/5">
      <div className="flex items-center gap-4 sm:gap-8">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5" />
          <span className="truncate max-w-[120px] sm:max-w-none text-slate-300">
            {candidateName || 'Candidate'}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Award className="w-3.5 h-3.5" />
          <span className="text-slate-400">{candidatePosition || 'Role'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 shadow-inner">
        <Shield className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline text-cyan-400/90">Secure Interview Mode</span>
      </div>
    </footer>
  );
};

export const InterviewQuestionCard = ({ status, currentQuestionIndex, questions }) => {
  const isVisible = [
    INTERVIEW_STATUS.PRACTICE_QUESTION,
    INTERVIEW_STATUS.SPEAKING,
    INTERVIEW_STATUS.READY_TO_ANSWER,
    INTERVIEW_STATUS.RECORDING,
    INTERVIEW_STATUS.PROCESSING_AUDIO,
    INTERVIEW_STATUS.TRANSCRIPT_REVIEW,
    INTERVIEW_STATUS.SAVING_ANSWER,
  ].includes(status);

  if (!isVisible) return null;

  const isSpeaking = status === INTERVIEW_STATUS.SPEAKING;

  return (
    <div
      className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl transition-all duration-300 ${
        isSpeaking
          ? 'border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)] bg-indigo-500/10'
          : ''
      }`}
    >
      <div className="flex gap-4 sm:gap-6 items-center">
        <div
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-500 ${
            isSpeaking
              ? 'bg-indigo-600/80 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)] animate-pulse scale-105'
              : 'bg-[#1b1f2c] border-white/10 shadow-lg'
          }`}
        >
          <Bot className="text-indigo-400 w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap gap-2 mb-1 sm:mb-2">
            <span className="text-[10px] sm:text-xs font-black text-cyan-400 uppercase tracking-widest drop-shadow-md">
              {currentQuestionIndex === -1
                ? 'Practice Round'
                : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
            </span>
          </div>
          <div className="max-h-[120px] sm:max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
            <h2 className="text-base sm:text-xl font-bold text-white leading-relaxed tracking-tight">
              {currentQuestionIndex === -1
                ? "Please say 'My microphone is working properly' to test your audio."
                : questions[currentQuestionIndex]}
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
};

export const InterviewWarning = ({ tabSwitches, status }) => {
  const isHidden = [
    INTERVIEW_STATUS.IDLE,
    INTERVIEW_STATUS.WELCOME,
    INTERVIEW_STATUS.SYSTEM_CHECK,
    INTERVIEW_STATUS.TUTORIAL,
  ].includes(status);

  if (tabSwitches === 0 || isHidden) return null;

  return (
    <div className="px-4 py-2 flex items-center gap-2 justify-center bg-amber-500/20 border-b border-amber-500/30 backdrop-blur-md">
      <AlertTriangle className="w-4 h-4 text-amber-400" />
      <p className="text-[10px] font-bold text-amber-100 uppercase tracking-wider">
        Tab switch detected — recorded for HR review
      </p>
    </div>
  );
};

export const ErrorMessage = ({ message }) => {
  return (
    <div className="min-h-screen bg-[#060810] flex items-center justify-center p-6 text-slate-200">
      <div className="bg-[#0d1117] border border-white/5 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl relative overflow-hidden max-w-md text-center">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/0 via-red-500/50 to-red-500/0 opacity-30" />
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400 text-sm">
          {message || 'An error occurred during the interview process.'}
        </p>
      </div>
    </div>
  );
};
